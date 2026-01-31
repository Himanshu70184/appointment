'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import api from '@/lib/api'
import type { RootState } from '@/store/store'

const bookingSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().regex(/^\d{10}$/, 'Enter 10-digit phone number'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianAddress: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

export default function AdminBookAppointmentPage() {
  const router = useRouter()
  const { user } = useSelector((state: RootState) => state.auth)

  const [step, setStep] = useState(1)
  const [states, setStates] = useState<any[]>([])
  const [selectedState, setSelectedState] = useState('')
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([])
  const [selectedCardType, setSelectedCardType] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotDuration, setSlotDuration] = useState<number | null>(null)
  const [showMinorFields, setShowMinorFields] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  })

  const dateOfBirth = watch('dateOfBirth')

  useEffect(() => {
    if (user && user.role_id !== 1 && user.role_id !== 4) {
      router.push('/dashboard')
      return
    }
    fetchStates()
  }, [user, router])

  useEffect(() => {
    if (selectedState) {
      fetchAppointmentTypes()
    }
  }, [selectedState])

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

  const fetchStates = async () => {
    try {
      const response = await api.get('/api/states?isActive=true')
      setStates(response.data.states || [])
    } catch (error) {
      console.error('Failed to fetch states:', error)
    }
  }

  const fetchAppointmentTypes = async () => {
    try {
      const response = await api.get('/api/patient-portal/appointment-types', {
        params: selectedState ? { state: selectedState } : {},
      })
      setAppointmentTypes(response.data.appointmentTypes || [])
    } catch (error) {
      console.error('Failed to fetch appointment types:', error)
    }
  }

  const handleSlotSelection = async () => {
    if (!selectedState || !selectedDate || !selectedCardType) {
      alert('Please select state, appointment type, and date')
      return
    }

    setLoading(true)
    try {
      const response = await api.get('/api/patient-portal/available-slots', {
        params: {
          state: selectedState,
          date: selectedDate,
          cardType: selectedCardType,
        },
      })
      setAvailableSlots(response.data.slots || [])
      setSlotDuration(response.data.slotDuration ?? null)
    } catch (error) {
      console.error('Failed to fetch available slots:', error)
      alert('Failed to load available slots')
    } finally {
      setLoading(false)
    }
  }

  const handleSlotConfirm = () => {
    if (!selectedSlot) {
      alert('Please select a time slot')
      return
    }
    setStep(2)
  }

  const formatTimeRange = (startTime: string, duration: number | null) => {
    if (!duration) return startTime
    const [startHour, startMin] = startTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = startMinutes + duration
    const endHour = Math.floor(endMinutes / 60) % 24
    const endMin = endMinutes % 60

    const format12h = (hour: number, min: number) => {
      const period = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 === 0 ? 12 : hour % 12
      return `${String(hour12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`
    }

    return `${format12h(startHour, startMin)} - ${format12h(endHour, endMin)}`
  }

  const onSubmit = async (data: BookingFormData) => {
    if (!selectedSlot || !selectedCardType) return

    if (showMinorFields) {
      if (!data.guardianName || !data.guardianPhone || !data.guardianAddress) {
        alert('Guardian information is required for patients under 18')
        return
      }
    }

    setLoading(true)
    try {
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
        scheduledTime: selectedSlot,
        isMinor: showMinorFields,
        guardianName: showMinorFields ? data.guardianName : undefined,
        guardianPhone: showMinorFields ? data.guardianPhone : undefined,
        guardianAddress: showMinorFields ? data.guardianAddress : undefined,
      }

      const response = await api.post('/api/appointments/admin-book-patient', bookingData)

      if (response.data.success) {
        alert(`Patient registered and appointment created successfully!\nAppointment ID: ${response.data.appointment._id}`)
        router.push(`/appointments/${response.data.appointment._id}/intake`)
      }
    } catch (error: any) {
      if (error.response?.data?.slotConflict) {
        alert(error.response.data.message)
        setStep(1)
        handleSlotSelection()
      } else {
        alert(error.response?.data?.message || 'Booking failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const renderStep1 = () => (
    <div className="card">
      <div className="sticky top-0 bg-white z-10 pb-4 border-b">
        <h2 className="text-2xl font-bold mb-4">Step 1: Select Appointment Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select State</label>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value)
                setSelectedSlot(null)
              }}
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
                    setSelectedSlot(null)
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
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setSelectedSlot(null)
              }}
              min={new Date().toISOString().split('T')[0]}
              className="input w-full"
            />
          </div>

          <button
            onClick={handleSlotSelection}
            disabled={!selectedState || !selectedCardType || !selectedDate || loading}
            className="btn-primary w-full"
          >
            {loading ? 'Loading slots...' : 'Find Available Slots'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Available Time Slots</h3>

        {loading ? (
          <p className="text-center py-8">Loading available slots...</p>
        ) : availableSlots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No available slots for selected date</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`p-3 border-2 rounded-lg transition-colors text-left ${
                    selectedSlot === slot.time
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-sm">{formatTimeRange(slot.time, slotDuration)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSlotConfirm}
          disabled={!selectedSlot}
          className="btn-primary flex-1"
        >
          Continue to Patient Information
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Step 2: Patient Information</h2>
        <p className="text-sm text-gray-600 mb-4">
          Register a new patient account (or patient can use existing email/password if they have one)
        </p>

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
            <input {...register('email')} type="email" className="input w-full" />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone (10 digits) *</label>
            <input {...register('phone')} placeholder="5551234567" className="input w-full" />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date of Birth *</label>
            <input {...register('dateOfBirth')} type="date" className="input w-full" />
            {errors.dateOfBirth && (
              <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password *</label>
            <input {...register('password')} type="password" className="input w-full" />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>
        </div>

        {/* Minor Guardian Fields */}
        {showMinorFields && (
          <div className="mt-6 p-4 border-2 border-yellow-300 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-4">
              ⚠️ Guardian Information Required (Patient is under 18)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Guardian Name *</label>
                <input {...register('guardianName')} className="input w-full" />
                {errors.guardianName && (
                  <p className="text-red-500 text-sm mt-1">{errors.guardianName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Guardian Phone *</label>
                <input {...register('guardianPhone')} placeholder="5551234567" className="input w-full" />
                {errors.guardianPhone && (
                  <p className="text-red-500 text-sm mt-1">{errors.guardianPhone.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Guardian Address *</label>
                <input {...register('guardianAddress')} className="input w-full" />
                {errors.guardianAddress && (
                  <p className="text-red-500 text-sm mt-1">{errors.guardianAddress.message}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Booking Summary */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-lg mb-4">📋 Booking Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">State:</span>
            <span className="font-semibold">{states.find(s => s.code === selectedState)?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Appointment Type:</span>
            <span className="font-semibold">{appointmentTypes.find(t => t._id === selectedCardType)?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span className="font-semibold">{selectedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Time:</span>
            <span className="font-semibold">{selectedSlot ? formatTimeRange(selectedSlot, slotDuration) : 'N/A'}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="text-gray-600">Amount:</span>
            <span className="font-semibold text-lg text-blue-600">
              ${appointmentTypes.find(t => t._id === selectedCardType)?.price || 0}
            </span>
          </div>
          <div className="bg-green-100 border border-green-400 rounded-lg p-3 mt-4">
            <p className="text-green-800 font-medium text-sm">
              ✅ No payment required (Admin/Staff booking)
            </p>
            <p className="text-green-700 text-xs mt-1">
              Patient account will be created and appointment will be confirmed
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn-secondary flex-1"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Creating Account & Booking...' : 'Complete Booking'}
          </button>
        </div>
      </div>
    </form>
  )

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Book Appointment for Patient</h1>
          <p className="text-gray-600 mt-2">
            Admin/Staff booking - Register patient and create appointment (no payment required)
          </p>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mt-6 space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium hidden md:inline">Details & Time</span>
            </div>
            <div className={`h-0.5 w-16 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium hidden md:inline">Patient Info</span>
            </div>
          </div>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </div>
    </DashboardLayout>
  )
}
