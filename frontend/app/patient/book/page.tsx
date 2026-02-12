'use client'

import { useState, useEffect, useRef } from 'react'
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
import Cookies from 'js-cookie'

const bookingSchema = z
  .object({
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().regex(/^[0-9]{10}$/, 'Enter 10-digit phone number'),
    dateOfBirth: z
      .string()
      .regex(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/, 'Use MM/DD/YYYY format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianAddress: z.string().optional(),
    cardNumber: z.string().regex(/^[0-9]{16}$/, 'Enter valid 16-digit card number'),
    expirationDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Format: MM/YY'),
    cvv: z.string().regex(/^\d{3,4}$/, 'Enter 3 or 4 digit CVV'),
    billingAddress: z.string().min(5, 'Billing address is required'),
    city: z.string().min(2, 'City is required'),
    billingState: z.string().length(2, 'Enter 2-letter state code'),
    zip: z.string().regex(/^[0-9]{5}$/, 'Enter 5-digit ZIP code'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type BookingFormData = z.infer<typeof bookingSchema>

interface CouponQuote {
  coupon: {
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    maxDiscount?: number
    minPurchase?: number
  }
  originalAmount: number
  discountAmount: number
  finalAmount: number
}

export default function PatientBookingPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { states, availableSlots, slotDuration, loading, error, success } = useSelector(
    (state: RootState) => state.patientPortal
  )
  const { user } = useSelector((state: RootState) => state.auth)
  const isLoggedInPatient = user?.role_id === 3

  const [step, setStep] = useState(1)
  const [selectedState, setSelectedState] = useState('')
  const [selectedCardType, setSelectedCardType] = useState('')
  const [selectedDateDisplay, setSelectedDateDisplay] = useState('')
  const [selectedDateISO, setSelectedDateISO] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [paidAppointmentId, setPaidAppointmentId] = useState<string | null>(null)
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([])
  const [showMinorFields, setShowMinorFields] = useState(false)
  const [slotsRequested, setSlotsRequested] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponData, setCouponData] = useState<CouponQuote | null>(null)
  const [finalAmount, setFinalAmount] = useState(0)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    null
  )
  const isRescheduleOnly = Boolean(paidAppointmentId)
  const selectedAppointmentType = appointmentTypes.find((type) => type._id === selectedCardType)

  const appointmentDatePickerRef = useRef<HTMLInputElement | null>(null)
  const dobPickerRef = useRef<HTMLInputElement | null>(null)
  const slotFetchTimerRef = useRef<number | null>(null)
  const lastSlotRequestRef = useRef('')
  const lastStateRef = useRef('')

  const {
    register,
    handleSubmit,
    setValue,
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
    fetchAppointmentTypes()
  }, [selectedState])

  useEffect(() => {
    if (couponData) {
      setFinalAmount(Number(couponData.finalAmount.toFixed(2)))
      return
    }

    if (selectedAppointmentType) {
      setFinalAmount(selectedAppointmentType.price)
    } else {
      setFinalAmount(0)
    }
  }, [couponData, selectedAppointmentType])

  useEffect(() => {
    setSelectedSlot(null)
    setSlotsRequested(false)

    if (!selectedState || !selectedCardType || !selectedDateISO) {
      if (slotFetchTimerRef.current !== null) {
        window.clearTimeout(slotFetchTimerRef.current)
        slotFetchTimerRef.current = null
      }
      return
    }

    const requestKey = `${selectedState}|${selectedCardType}|${selectedDateISO}`
    if (lastSlotRequestRef.current === requestKey) {
      return
    }

    if (slotFetchTimerRef.current !== null) {
      window.clearTimeout(slotFetchTimerRef.current)
    }

    slotFetchTimerRef.current = window.setTimeout(() => {
      lastSlotRequestRef.current = requestKey
      setSlotsRequested(true)
      dispatch(
        getAvailableSlots({
          state: selectedState,
          date: selectedDateISO,
          cardType: selectedCardType,
        })
      )
    }, 400)

    return () => {
      if (slotFetchTimerRef.current !== null) {
        window.clearTimeout(slotFetchTimerRef.current)
        slotFetchTimerRef.current = null
      }
    }
  }, [selectedState, selectedCardType, selectedDateISO, dispatch])

  const parseMMDDYYYY = (value?: string) => {
    if (!value) return null
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) return null
    const month = Number(match[1])
    const day = Number(match[2])
    const year = Number(match[3])
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
      return null
    }
    return date
  }

  const formatISOToMMDDYYYY = (value: string) => {
    if (!value) return ''
    const parts = value.split('T')[0].split('-')
    if (parts.length !== 3) return ''
    return `${parts[1]}/${parts[2]}/${parts[0]}`
  }

  const openNativePicker = (ref: { current: HTMLInputElement | null }) => {
    if (!ref.current) return
    const element = ref.current as HTMLInputElement & { showPicker?: () => void }
    if (typeof element.showPicker === 'function') {
      element.showPicker()
    } else {
      element.focus()
    }
  }

  useEffect(() => {
    if (!user || user.role_id !== 3) return

    const fullName = user.name?.trim() || ''
    const [firstNameFromName, ...restName] = fullName.split(' ').filter(Boolean)
    const lastNameFromName = restName.join(' ')

    setValue('firstName', user.firstName || firstNameFromName || '', { shouldValidate: true })
    setValue('lastName', user.lastName || lastNameFromName || '', { shouldValidate: true })
    setValue('email', user.email || '', { shouldValidate: true })
    setValue('phone', user.phone || '', { shouldValidate: true })

    if (user.dateOfBirth) {
      setValue('dateOfBirth', formatISOToMMDDYYYY(user.dateOfBirth), { shouldValidate: true })
    }
  }, [user, setValue])

  useEffect(() => {
    if (dateOfBirth) {
      const birthDate = parseMMDDYYYY(dateOfBirth)
      if (!birthDate) return
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      const isMinor = age < 18 || (age === 18 && monthDiff < 0)
      setShowMinorFields(isMinor)
    }
  }, [dateOfBirth])

  useEffect(() => {
    if (!couponData) {
      lastStateRef.current = selectedState
      return
    }

    if (lastStateRef.current && selectedState && lastStateRef.current !== selectedState) {
      setCouponData(null)
      if (selectedAppointmentType) {
        setFinalAmount(selectedAppointmentType.price)
      }
      showToast('info', 'State changed. Please re-apply your coupon.')
    }

    lastStateRef.current = selectedState
  }, [selectedState, couponData, selectedAppointmentType])

  useEffect(() => {
    if (error) {
      showToast('error', formatEligibleDateMessage(error))
      dispatch(clearError())
    }
  }, [error, dispatch])

  useEffect(() => {
    if (success) {
      showToast('success', success)
      dispatch(clearSuccess())
    }
  }, [success, dispatch])

  const formatDateMMDDYYYY = (value: Date) => {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const year = value.getFullYear()
    return `${month}/${day}/${year}`
  }

  const formatEligibleDateMessage = (message: string) => {
    const match = message.match(/Next eligible date:\s*([0-9/\-.]+)/i)
    if (!match) return message
    const parsed = new Date(match[1])
    if (Number.isNaN(parsed.getTime())) return message
    return message.replace(match[1], formatDateMMDDYYYY(parsed))
  }

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 4000)
  }

  const fetchAppointmentTypes = async () => {
    try {
      const response = await api.get('/api/patient-portal/appointment-types', {
        params: selectedState ? { state: selectedState } : {},
      })
      setAppointmentTypes(response.data.appointmentTypes || [])
    } catch (fetchError) {
      console.error('Failed to fetch appointment types:', fetchError)
    }
  }

  const handleSlotSelection = () => {
    if (!selectedState || !selectedDateISO || !selectedCardType) {
      showToast('error', 'Please select state, card type, and date')
      return
    }
    if (slotFetchTimerRef.current !== null) {
      window.clearTimeout(slotFetchTimerRef.current)
      slotFetchTimerRef.current = null
    }
    lastSlotRequestRef.current = `${selectedState}|${selectedCardType}|${selectedDateISO}`
    setSlotsRequested(true)
    dispatch(
      getAvailableSlots({
        state: selectedState,
        date: selectedDateISO,
        cardType: selectedCardType,
      })
    )
  }

  const handleSlotConfirm = async () => {
    if (!selectedSlot) {
      showToast('error', 'Please select a time slot')
      return
    }

    if (paidAppointmentId) {
      try {
        const response = await api.put(
          `/api/patient-portal/appointments/${paidAppointmentId}/reschedule`,
          {
            scheduledDate: selectedDateISO,
            scheduledTime: selectedSlot,
          }
        )

        if (response.data?.appointment?._id) {
          setPaidAppointmentId(null)
          router.push(`/patient/intake-form/${response.data.appointment._id}`)
          return
        }
      } catch (rescheduleError: any) {
        const message =
          rescheduleError.response?.data?.message ||
          'Unable to reschedule. Please choose another slot.'
        showToast('error', formatEligibleDateMessage(message))
        return
      }
    }

    setStep(2)
  }

  const getSlotTime = (slot: any) => {
    if (!slot) return ''
    if (typeof slot === 'string') return slot
    if (typeof slot.time === 'string') return slot.time
    if (typeof slot.startTime === 'string') return slot.startTime
    return ''
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

  const handleCouponValidation = async () => {
    if (!couponCode.trim()) {
      showToast('error', 'Enter a coupon code to continue')
      return
    }

    if (!selectedState) {
      showToast('error', 'Select your state before applying a coupon')
      return
    }

    if (!selectedAppointmentType) {
      showToast('error', 'Choose an appointment type before applying a coupon')
      return
    }

    const formattedCode = couponCode.trim().toUpperCase()
    setCouponCode(formattedCode)

    try {
      const result = (await dispatch(
        validateCoupon({
          couponCode: formattedCode,
          amount: selectedAppointmentType.price,
          state: selectedState,
          appointmentTypeId: selectedCardType,
        })
      ).unwrap()) as CouponQuote
      setCouponData(result)
      setFinalAmount(Number(result.finalAmount.toFixed(2)))
      showToast(
        'success',
        `${result.coupon.code} applied! You save $${result.discountAmount.toFixed(2)}`
      )
    } catch (couponError: any) {
      const messageText =
        typeof couponError === 'string'
          ? couponError
          : couponError?.message || 'Invalid or ineligible coupon code'
      showToast('error', formatEligibleDateMessage(messageText))
      setCouponData(null)
      setFinalAmount(selectedAppointmentType.price)
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
      dateOfBirth: parseMMDDYYYY(data.dateOfBirth)?.toISOString().split('T')[0] || '',
      password: data.password,
      state: selectedState,
      cardType: selectedCardType,
      scheduledDate: selectedDateISO,
      scheduledTime: selectedSlot,
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
        if (result.token) {
          Cookies.set('token', result.token, { expires: 7, sameSite: 'lax', path: '/' })
        }
        localStorage.setItem('pendingIntakeAppointment', result.appointment._id)
        router.push(`/patient/intake-form/${result.appointment._id}`)
      }
    } catch (submitError: any) {
      if (submitError.token) {
        Cookies.set('token', submitError.token, { expires: 7, sameSite: 'lax', path: '/' })
      }

      if (submitError.slotConflictAfterPayment && submitError.appointmentId) {
        setPaidAppointmentId(submitError.appointmentId)
        showToast('error', formatEligibleDateMessage(submitError.message))
        setStep(1)
        return
      }

      if (submitError.slotConflict) {
        showToast('error', formatEligibleDateMessage(submitError.message))
        setStep(1)
        dispatch(
          getAvailableSlots({
            state: selectedState,
            date: selectedDateISO,
            cardType: selectedCardType,
          })
        )
      } else if (submitError.paymentFailed) {
        showToast('error', 'Payment failed. Please check your card details and try again.')
      } else {
        showToast('error', formatEligibleDateMessage(submitError.message || 'Booking failed'))
      }
    }
  }

  const renderStep1 = () => (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">Step 1: Select Appointment Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                disabled={isRescheduleOnly}
                className="input w-full"
              >
                <option value="">Choose a state...</option>
                {[...states]
                  .sort((a: any, b: any) => a.name.localeCompare(b.name))
                  .map((state: any) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Appointment Type</label>
              <div className="grid grid-cols-2 gap-3">
                {appointmentTypes.map((type) => (
                  <div
                    key={type._id}
                    onClick={() => {
                      if (isRescheduleOnly) return
                      setSelectedCardType(type._id)
                      setFinalAmount(type.price)
                      if (couponData) {
                        setCouponData(null)
                        showToast('info', 'Appointment type changed. Re-apply your coupon for the new price.')
                      }
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
                      <p className="text-xs text-gray-500 mt-1">
                        Valid for {type.cardValidityMonths} months
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Date</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/DD/YYYY"
                  maxLength={10}
                  value={selectedDateDisplay}
                  onChange={(e) => {
                    const value = e.target.value
                    setSelectedDateDisplay(value)
                    const parsed = parseMMDDYYYY(value)
                    setSelectedDateISO(parsed ? parsed.toISOString().split('T')[0] : '')
                    setSelectedSlot(null)
                  }}
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => openNativePicker(appointmentDatePickerRef)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label="Open calendar"
                >
                  📅
                </button>
                <input
                  ref={appointmentDatePickerRef}
                  type="date"
                  value={selectedDateISO}
                  onChange={(e) => {
                    const isoValue = e.target.value
                    setSelectedDateISO(isoValue)
                    setSelectedDateDisplay(formatISOToMMDDYYYY(isoValue))
                    setSelectedSlot(null)
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Select Time</h3>
            {selectedDateISO && (
              <span className="text-sm text-gray-600">
                {formatISOToMMDDYYYY(selectedDateISO)}
              </span>
            )}
          </div>

          {isRescheduleOnly && (
            <div className="mb-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3">
              Payment completed. Please choose a new time to confirm your appointment.
            </div>
          )}

          <div className="max-h-[480px] overflow-y-auto pr-1">
            {!slotsRequested && (
              <div className="text-gray-500 text-sm">
                Choose your state, appointment type, and date to see available times.
              </div>
            )}

            {slotsRequested && !loading && availableSlots.length === 0 && (
              <div className="text-gray-500 text-sm">No available times for the selected date.</div>
            )}

            {availableSlots.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {availableSlots.map((slot: any) => {
                  const slotTime = getSlotTime(slot)
                  if (!slotTime) return null
                  return (
                    <button
                      key={slotTime}
                      type="button"
                      onClick={() => setSelectedSlot(slotTime)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        selectedSlot === slotTime
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">
                        {formatTimeRange(slotTime, slotDuration)}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={handleSlotSelection} className="btn-secondary">
              Refresh Slots
            </button>
            <button
              type="button"
              onClick={handleSlotConfirm}
              disabled={!selectedSlot}
              className="btn-primary flex-1"
            >
              {isRescheduleOnly ? 'Confirm New Time' : 'Continue to Your Information'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-lg mb-4">📋 Booking Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">State:</span>
            <span className="font-semibold">
              {states.find((s: any) => s.code === selectedState)?.name || selectedState || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Appointment Type:</span>
            <span className="font-semibold">
              {appointmentTypes.find((t) => t._id === selectedCardType)?.name || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Appointment Date:</span>
            <span className="font-semibold">
              {selectedDateISO ? formatISOToMMDDYYYY(selectedDateISO) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Appointment Time:</span>
            <span className="font-semibold">
              {selectedSlot ? formatTimeRange(selectedSlot, slotDuration) : '—'}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2 text-sm">
            <span className="text-gray-600">Base price:</span>
            <span className="font-semibold text-gray-900">
              {selectedAppointmentType ? `$${selectedAppointmentType.price.toFixed(2)}` : '—'}
            </span>
          </div>
          {couponData && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Coupon ({couponData.coupon.code})</span>
              <span>- ${couponData.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="text-gray-600">Total due today:</span>
            <span className="font-semibold text-lg text-blue-600">${finalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Step 2: Your Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">First Name *</label>
            <input {...register('firstName')} disabled={isLoggedInPatient} className="input w-full" />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Last Name *</label>
            <input {...register('lastName')} disabled={isLoggedInPatient} className="input w-full" />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input type="email" {...register('email')} disabled={isLoggedInPatient} className="input w-full" />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone (10 digits) *</label>
            <input
              {...register('phone')}
              placeholder="1234567890"
              disabled={isLoggedInPatient}
              className="input w-full"
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date of Birth *</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/DD/YYYY"
                maxLength={10}
                {...register('dateOfBirth')}
                disabled={isLoggedInPatient}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => openNativePicker(dobPickerRef)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                aria-label="Open date of birth calendar"
                disabled={isLoggedInPatient}
              >
                📅
              </button>
              <input
                ref={dobPickerRef}
                type="date"
                value={parseMMDDYYYY(dateOfBirth)?.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const isoValue = e.target.value
                  const formatted = formatISOToMMDDYYYY(isoValue)
                  setValue('dateOfBirth', formatted, { shouldValidate: true })
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
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
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase())
              if (couponData && selectedAppointmentType) {
                setCouponData(null)
                setFinalAmount(selectedAppointmentType.price)
              }
            }}
            placeholder="Enter coupon code"
            className="input flex-1"
          />
          <button type="button" onClick={handleCouponValidation} className="btn-secondary">
            Apply
          </button>
        </div>
        {couponData && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">✓ Coupon applied! Discount: ${couponData.discountAmount.toFixed(2)}</p>
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
            <input {...register('cvv')} placeholder="123" maxLength={4} className="input w-full" />
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
            <input {...register('billingState')} placeholder="CA" maxLength={2} className="input w-full" />
            {errors.billingState && (
              <p className="text-red-500 text-sm mt-1">{errors.billingState.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ZIP Code *</label>
            <input {...register('zip')} placeholder="12345" maxLength={5} className="input w-full" />
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

      <div className="flex gap-3">
        <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
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
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm">
          <div
            className={`rounded-lg shadow-lg px-4 py-3 text-sm font-medium border flex items-start gap-2 ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : toast.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
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
            <div className="w-16 h-1 bg-gray-300" />
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}
            >
              2
            </div>
          </div>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </div>
    </div>
  )
}
