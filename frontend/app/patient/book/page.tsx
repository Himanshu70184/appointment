'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDispatch, useSelector } from 'react-redux'
import {
  getActiveStates,
  getAvailableSlots,
  bookAppointment,
  validateCoupon,
  clearError,
  clearSuccess,
} from '@/store/slices/patientPortalSlice'
import type { AppDispatch, RootState } from '@/store/store'
import api from '@/lib/api'

const bookingSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().regex(/^\d{10}$/, 'Enter 10-digit phone number'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianAddress: z.string().optional(),
  cardNumber: z.string().regex(/^\d{16}$/, 'Enter valid 16-digit card number'),
  expirationDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Format: MM/YY'),
  cvv: z.string().regex(/^\d{3,4}$/, 'Enter 3 or 4 digit CVV'),
  billingAddress: z.string().min(5, 'Billing address is required'),
  city: z.string().min(2, 'City is required'),
  billingState: z.string().length(2, 'Enter 2-letter state code'),
  zip: z.string().regex(/^\d{5}$/, 'Enter 5-digit ZIP code'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type BookingFormData = z.infer<typeof bookingSchema>

export default function PatientBookingPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { states, availableSlots, loading, error, success } = useSelector(
    (state: RootState) => state.patientPortal
  )

  const [step, setStep] = useState(1)
  const [selectedState, setSelectedState] = useState('')
  const [selectedCardType, setSelectedCardType] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([])
  const [showMinorFields, setShowMinorFields] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponData, setCouponData] = useState<any>(null)
  const [finalAmount, setFinalAmount] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  })

  const dateOfBirth = watch('dateOfBirth')

  useEffect(() => {
    dispatch(getActiveStates())
    fetchAppointmentTypes()
  }, [dispatch])

  useEffect(() => {
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      const isMinor = age < 18 || (age === 18 && monthDiff < 0)
      setShowMinorFields(isMinor)
    }
  }, [dateOfBirth])

  const fetchAppointmentTypes = async () => {
    try {
      const response = await api.get('/api/patient-portal/appointment-types', {
        params: selectedState ? { state: selectedState } : {}
      })
      setAppointmentTypes(response.data.appointmentTypes || [])
    } catch (error) {
      console.error('Failed to fetch appointment types:', error)
    }
  }

  const handleSlotSelection = () => {
    if (!selectedState || !selectedDate || !selectedCardType) {
      alert('Please select state, card type, and date')
      return
    }

    dispatch(
      getAvailableSlots({
        state: selectedState,
        date: selectedDate,
        cardType: selectedCardType,
      })
    )
    setStep(2)
  }

  const handleSlotConfirm = () => {
    if (!selectedSlot) {
      alert('Please select a time slot')
      return
    }
    setStep(3)
  }

  const handleCouponValidation = async () => {
    if (!couponCode) return

    const appointmentType = appointmentTypes.find((c) => c._id === selectedCardType)
    if (!appointmentType) return

    try {
      const result = await dispatch(
        validateCoupon({ couponCode, amount: appointmentType.price })
      ).unwrap()
      setCouponData(result)
      setFinalAmount(result.finalAmount)
      alert(`Coupon applied! You save $${result.discountAmount.toFixed(2)}`)
    } catch (err: any) {
      alert(err.message || 'Invalid coupon code')
      setCouponData(null)
      setFinalAmount(appointmentType.price)
    }
  }

  const onSubmit = async (data: BookingFormData) => {
    const appointmentType = appointmentTypes.find((c) => c._id === selectedCardType)
    if (!appointmentType || !selectedSlot) return

    const bookingData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      password: data.password,
      state: selectedState,
      cardType: selectedCardType,
      scheduledDate: selectedDate,
      scheduledTime: selectedSlot.time,
      doctor_id: selectedSlot.doctor_id,
      couponCode: couponData ? couponCode : undefined,
      guardianName: showMinorFields ? data.guardianName : undefined,
      guardianPhone: showMinorFields ? data.guardianPhone : undefined,
      guardianAddress: showMinorFields ? data.guardianAddress : undefined,
      payment: {
        cardNumber: data.cardNumber,
        expirationDate: data.expirationDate,
        cvv: data.cvv,
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.billingAddress,
        city: data.city,
        state: data.billingState,
        zip: data.zip,
      },
    }

    try {
      const result = await dispatch(bookAppointment(bookingData)).unwrap()
      
      if (result.success) {
        // Store appointment ID and redirect to intake form
        localStorage.setItem('pendingIntakeAppointment', result.appointment._id)
        router.push(`/patient/intake/${result.appointment._id}`)
      }
    } catch (err: any) {
      if (err.slotConflict) {
        alert(err.message)
        setStep(2) // Go back to slot selection
        dispatch(
          getAvailableSlots({
            state: selectedState,
            date: selectedDate,
            cardType: selectedCardType,
          })
        )
      } else if (err.paymentFailed) {
        alert('Payment failed. Please check your card details and try again.')
      } else {
        alert(err.message || 'Booking failed')
      }
    }
  }

  const renderStep1 = () => (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">Step 1: Select Appointment Details</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Select State</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="input w-full"
          >
            <option value="">Choose a state...</option>
            {states.map((state: any) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select Appointment Type</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appointmentTypes.map((type) => (
              <div
                key={type._id}
                onClick={() => {
                  setSelectedCardType(type._id)
                  setFinalAmount(type.price)
                }}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedCardType === type._id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <h3 className="font-semibold">{type.name}</h3>
                <p className="text-gray-600 text-sm mt-1">{type.description}</p>
                <div className="mt-2 flex justify-between items-center">
                  <p className="text-2xl font-bold text-blue-600">${type.price}</p>
                  <p className="text-sm text-gray-500">{type.duration} min</p>
                </div>
                {type.cardValidityMonths && (
                  <p className="text-xs text-gray-500 mt-1">Valid for {type.cardValidityMonths} months</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="input w-full"
          />
        </div>

        <button
          onClick={handleSlotSelection}
          disabled={!selectedState || !selectedCardType || !selectedDate}
          className="btn-primary w-full"
        >
          Continue to Time Selection
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">Step 2: Select Time Slot</h2>

      {loading ? (
        <p className="text-center py-8">Loading available slots...</p>
      ) : availableSlots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No available slots for selected date</p>
          <button onClick={() => setStep(1)} className="btn-secondary">
            Choose Different Date
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {availableSlots.map((slot, index) => (
              <button
                key={index}
                onClick={() => setSelectedSlot(slot)}
                className={`p-3 border-2 rounded-lg transition-colors ${
                  selectedSlot?.time === slot.time && selectedSlot?.doctor_id === slot.doctor_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-semibold">{slot.time}</div>
                <div className="text-xs text-gray-600">{slot.doctorName}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={handleSlotConfirm}
              disabled={!selectedSlot}
              className="btn-primary flex-1"
            >
              Continue to Registration
            </button>
          </div>
        </>
      )}
    </div>
  )

  const renderStep3 = () => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Step 3: Your Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">First Name *</label>
            <input {...register('firstName')} className="input w-full" />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Last Name *</label>
            <input {...register('lastName')} className="input w-full" />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input type="email" {...register('email')} className="input w-full" />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone (10 digits) *</label>
            <input {...register('phone')} placeholder="1234567890" className="input w-full" />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date of Birth *</label>
            <input type="date" {...register('dateOfBirth')} className="input w-full" />
            {errors.dateOfBirth && (
              <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password *</label>
            <input type="password" {...register('password')} className="input w-full" />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirm Password *</label>
            <input type="password" {...register('confirmPassword')} className="input w-full" />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        {showMinorFields && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-4">
              Guardian Information Required (Patient is under 18)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Guardian Name *</label>
                <input {...register('guardianName')} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Guardian Phone *</label>
                <input {...register('guardianPhone')} className="input w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Guardian Address *</label>
                <input {...register('guardianAddress')} className="input w-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Coupon Code (Optional)</h3>
        <div className="flex gap-2">
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            className="input flex-1"
          />
          <button type="button" onClick={handleCouponValidation} className="btn-secondary">
            Apply
          </button>
        </div>
        {couponData && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">
              ✓ Coupon applied! Discount: ${couponData.discountAmount.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Payment Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Card Number *</label>
            <input
              {...register('cardNumber')}
              placeholder="1234567890123456"
              maxLength={16}
              className="input w-full"
            />
            {errors.cardNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.cardNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Expiration Date *</label>
            <input
              {...register('expirationDate')}
              placeholder="MM/YY"
              maxLength={5}
              className="input w-full"
            />
            {errors.expirationDate && (
              <p className="text-red-500 text-sm mt-1">{errors.expirationDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">CVV *</label>
            <input
              {...register('cvv')}
              placeholder="123"
              maxLength={4}
              className="input w-full"
            />
            {errors.cvv && <p className="text-red-500 text-sm mt-1">{errors.cvv.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Billing Address *</label>
            <input {...register('billingAddress')} className="input w-full" />
            {errors.billingAddress && (
              <p className="text-red-500 text-sm mt-1">{errors.billingAddress.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">City *</label>
            <input {...register('city')} className="input w-full" />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">State *</label>
            <input
              {...register('billingState')}
              placeholder="CA"
              maxLength={2}
              className="input w-full"
            />
            {errors.billingState && (
              <p className="text-red-500 text-sm mt-1">{errors.billingState.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ZIP Code *</label>
            <input
              {...register('zip')}
              placeholder="12345"
              maxLength={5}
              className="input w-full"
            />
            {errors.zip && <p className="text-red-500 text-sm mt-1">{errors.zip.message}</p>}
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total Amount:</span>
            <span className="text-blue-600">${finalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">
          Back
        </button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Processing...' : 'Complete Booking & Pay'}
        </button>
      </div>
    </form>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Book Your Appointment</h1>

        <div className="mb-8 flex justify-center">
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}
            >
              1
            </div>
            <div className="w-16 h-1 bg-gray-300"></div>
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}
            >
              2
            </div>
            <div className="w-16 h-1 bg-gray-300"></div>
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}
            >
              3
            </div>
          </div>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  )
}
