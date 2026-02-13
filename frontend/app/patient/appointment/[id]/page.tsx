'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointmentDetails, clearCurrentAppointment } from '@/store/slices/patientPortalSlice'
import { getSubmissionByAppointment, clearError as clearIntakeError } from '@/store/slices/intakeFormSubmissionSlice'
import type { AppDispatch, RootState } from '@/store/store'
import api from '@/lib/api'

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const asNumber = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const summarizePrice = (appointment: any) => {
  if (!appointment) {
    return { finalAmount: 0, originalAmount: 0, discountAmount: 0 }
  }
  const discountAmount = asNumber(appointment.couponDiscountAmount) || 0
  const appointmentTypePrice =
    typeof appointment.appointmentType === 'object'
      ? asNumber(appointment.appointmentType?.price)
      : null
  const fallbackBase =
    appointmentTypePrice ??
    asNumber(appointment.medicalCardType?.price) ??
    asNumber(appointment.amount) ??
    asNumber(appointment.payment_id?.amount) ??
    0

  const finalAmount =
    asNumber(appointment.adjustedAmount) ??
    asNumber(appointment.payment_id?.amount) ??
    (discountAmount > 0 ? Math.max(fallbackBase - discountAmount, 0) : fallbackBase)

  const originalAmount = discountAmount > 0
    ? Math.max((finalAmount || 0) + discountAmount, fallbackBase ?? 0)
    : (fallbackBase || finalAmount || 0)

  return {
    finalAmount: finalAmount || 0,
    originalAmount,
    discountAmount,
  }
}

export default function AppointmentDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const { currentAppointment, loading, error } = useSelector(
    (state: RootState) => state.patientPortal
  )
  const { currentSubmission, loading: intakeLoading, error: intakeError } = useSelector(
    (state: RootState) => state.intakeFormSubmissions
  )
  const appointmentId = params?.id as string
  const [showIntakeDetails, setShowIntakeDetails] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; date: string }>>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    if (appointmentId) {
      dispatch(getAppointmentDetails(appointmentId))
    }

    return () => {
      dispatch(clearCurrentAppointment())
      dispatch(clearIntakeError())
    }
  }, [appointmentId, dispatch])

  useEffect(() => {
    if (currentAppointment?.intakeSubmitted && appointmentId) {
      dispatch(getSubmissionByAppointment(appointmentId))
        .unwrap()
        .then(() => setShowIntakeDetails(true))
        .catch(() => setShowIntakeDetails(true))
    } else {
      setShowIntakeDetails(false)
    }
  }, [appointmentId, currentAppointment?.intakeSubmitted, dispatch])

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-green-100 text-green-800',
      approval: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-orange-100 text-orange-800',
      'intake-pending': 'bg-orange-100 text-orange-800',
      'on-hold': 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
      rescheduled: 'bg-purple-100 text-purple-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const isIntakePending =
    !currentAppointment?.intakeSubmitted &&
    currentAppointment?.status !== 'completed' &&
    currentAppointment?.status !== 'cancelled'

  const isTerminalStatus =
    currentAppointment?.status === 'cancelled' || currentAppointment?.status === 'completed'

  const statusLabel = isIntakePending
    ? 'Intake Pending'
    : currentAppointment?.status === 'cancelled'
      ? 'Canceled'
      : currentAppointment?.status
        ? currentAppointment.status.charAt(0).toUpperCase() + currentAppointment.status.slice(1)
        : 'N/A'

  const canModifyAppointment = !isTerminalStatus

  const { finalAmount, originalAmount, discountAmount } = summarizePrice(currentAppointment)

  const formatTime12Hour = (time?: string) => {
    if (!time) return 'Not scheduled'
    const [hourStr, minuteStr] = time.split(':')
    const hour = Number(hourStr)
    if (Number.isNaN(hour)) return time
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:${minuteStr} ${period}`
  }

  const formatAppointmentDateLabel = (value?: string) => {
    if (!value) return 'Not scheduled'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'Not scheduled'
    return parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getAppointmentTypeId = (appointment: any) => {
    if (typeof appointment.appointmentType === 'object') {
      return appointment.appointmentType?._id
    }
    return appointment.appointmentType
  }

  const openRescheduleModal = () => {
    if (!canModifyAppointment || !currentAppointment) return
    setRescheduleOpen(true)
    setRescheduleDate('')
    setAvailableSlots([])
    setSelectedSlot('')
    setRescheduleError(null)
  }

  const openCancelModal = () => {
    if (!canModifyAppointment) return
    setCancelOpen(true)
    setCancelReason('')
    setCancelError(null)
  }

  const closeCancelModal = () => {
    setCancelOpen(false)
    setCancelReason('')
    setCancelError(null)
  }

  const handleFetchSlots = async (date: string) => {
    if (!currentAppointment) return
    const cardType = getAppointmentTypeId(currentAppointment)
    if (!cardType || !currentAppointment.state) {
      setRescheduleError('Missing appointment type or state')
      return
    }
    try {
      setRescheduleLoading(true)
      setRescheduleError(null)
      const response = await api.get('/api/patient-portal/available-slots', {
        params: {
          state: currentAppointment.state,
          date,
          cardType
        }
      })
      setAvailableSlots(response.data?.slots || [])
    } catch (error: any) {
      setRescheduleError(error.response?.data?.message || 'Failed to fetch slots')
    } finally {
      setRescheduleLoading(false)
    }
  }

  const handleConfirmReschedule = async () => {
    if (!currentAppointment || !rescheduleDate || !selectedSlot) return
    try {
      setRescheduleLoading(true)
      await api.put(`/api/patient-portal/appointments/${currentAppointment._id}/reschedule`, {
        scheduledDate: rescheduleDate,
        scheduledTime: selectedSlot
      })
      setRescheduleOpen(false)
      setRescheduleDate('')
      setAvailableSlots([])
      setSelectedSlot('')
      dispatch(getAppointmentDetails(appointmentId))
    } catch (error: any) {
      setRescheduleError(error.response?.data?.message || 'Failed to reschedule appointment')
    } finally {
      setRescheduleLoading(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!currentAppointment) return
    if (!cancelReason.trim()) {
      setCancelError('Cancellation reason is required')
      return
    }

    try {
      setCancelLoading(true)
      await api.put(`/api/patient-portal/appointments/${currentAppointment._id}/cancel`, {
        reason: cancelReason.trim(),
      })
      closeCancelModal()
      dispatch(getAppointmentDetails(appointmentId))
    } catch (error: any) {
      setCancelError(error.response?.data?.message || 'Failed to cancel appointment')
    } finally {
      setCancelLoading(false)
    }
  }

  const getFileUrl = (url: string) => {
    if (!url) return url
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : 'http://localhost:5000')
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }

  const getOptionLabels = (fieldId: string, value: any) => {
    const template = currentSubmission?.template_id as any
    const sections = template?.sections || []
    const field = sections
      .flatMap((section: any) => section.fields || [])
      .find((f: any) => f.fieldId === fieldId)

    if (!field || !field.options || field.options.length === 0) {
      return null
    }

    const mapValueToLabel = (val: any) => {
      const option = field.options.find((opt: any) => opt.value === val)
      return option?.label || val
    }

    if (Array.isArray(value)) {
      return value.map(mapValueToLabel).join(', ')
    }

    return mapValueToLabel(value)
  }

  const formatIntakeValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'N/A'
    }
    if (value === true) return 'Yes'
    if (value === false) return 'No'
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading appointment details...</p>
        </div>
      </div>
    )
  }

  if (error || !currentAppointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md text-center">
          <p className="text-red-600 mb-4">{error || 'Appointment not found'}</p>
          <button onClick={() => router.push('/patient/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 p-8 text-white shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute -left-10 top-0 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">Appointment</p>
                <h1 className="mt-2 text-4xl font-bold leading-tight">
                  {typeof currentAppointment.appointmentType === 'string'
                    ? currentAppointment.appointmentType
                    : currentAppointment.appointmentType?.name || 'Appointment details'}
                </h1>
                <p className="mt-3 text-white/85">
                  Review your booking, paperwork requirements, and billing history. Everything syncs across the patient portal.
                </p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-white/15 px-4 py-1 text-sm font-semibold text-white">
                {statusLabel}
              </span>
            </div>
            <div className="grid gap-4 text-sm text-white/90 sm:grid-cols-2">
              <div>
                <p className="text-white/60">Next visit</p>
                <p className="text-base font-semibold">{formatAppointmentDateLabel(currentAppointment.scheduledDate)}</p>
                <p className="text-white/75">{formatTime12Hour(currentAppointment.scheduledTime)}</p>
              </div>
              <div>
                <p className="text-white/60">State</p>
                <p className="text-base font-semibold">{currentAppointment.stateName || currentAppointment.state || 'N/A'}</p>
                <p className="text-white/75">
                  Patient portal • {currentAppointment.patient_id?.email || 'No email on file'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/patient/dashboard')}
                className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={openRescheduleModal}
                disabled={!canModifyAppointment}
                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  canModifyAppointment
                    ? 'bg-white/90 text-emerald-700 shadow-sm'
                    : 'bg-white/10 text-white/50 cursor-not-allowed'
                }`}
              >
                🗓️ Reschedule
              </button>
              <button
                onClick={openCancelModal}
                disabled={!canModifyAppointment}
                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  canModifyAppointment
                    ? 'bg-rose-50/90 text-rose-800'
                    : 'bg-white/10 text-white/50 cursor-not-allowed'
                }`}
              >
                🗑️ Cancel Appointment
              </button>
            </div>
            {!canModifyAppointment && (
              <p className="text-sm text-white/80">
                Completed or canceled appointments can only be viewed—changes are disabled.
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Overview</p>
                  <h2 className="text-2xl font-semibold text-gray-900">Appointment information</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeColor(
                    isIntakePending ? 'intake-pending' : currentAppointment.status
                  )}`}
                >
                  {statusLabel}
                </span>
              </div>
              <dl className="mt-6 grid gap-4 text-sm text-gray-600 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Service type</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {typeof currentAppointment.appointmentType === 'string'
                      ? currentAppointment.appointmentType
                      : currentAppointment.appointmentType?.name || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Appointment date</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {formatAppointmentDateLabel(currentAppointment.scheduledDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Time</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {formatTime12Hour(currentAppointment.scheduledTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">State</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {currentAppointment.stateName || currentAppointment.state || 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">🧾</div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Patient</p>
                  <h2 className="text-2xl font-semibold text-gray-900">Contact information</h2>
                </div>
              </div>
              <dl className="mt-6 grid gap-4 text-sm text-gray-600 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Name</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {currentAppointment.patient_id?.name ||
                      `${currentAppointment.patient_id?.firstName || ''} ${currentAppointment.patient_id?.lastName || ''}`.trim() ||
                      'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Email</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {currentAppointment.patient_id?.email || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Phone</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {currentAppointment.patient_id?.phone || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Date of birth</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {currentAppointment.patient_id?.dateOfBirth
                      ? new Date(currentAppointment.patient_id.dateOfBirth).toLocaleDateString('en-US')
                      : 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>

            {(currentAppointment.notes || currentAppointment.adminNotes) && (
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">💬</div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Notes</p>
                    <h2 className="text-2xl font-semibold text-gray-900">Conversation log</h2>
                  </div>
                </div>
                <div className="mt-6 space-y-4 text-sm text-gray-700">
                  {currentAppointment.notes && (
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Patient note</p>
                      <p className="mt-1 text-gray-900">{currentAppointment.notes}</p>
                    </div>
                  )}
                  {currentAppointment.adminNotes && (
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Admin note</p>
                      <p className="mt-1 text-gray-900">{currentAppointment.adminNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentAppointment.isMinor && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm lg:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">🧒</div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-600">Minor patient</p>
                    <h2 className="text-2xl font-semibold text-amber-800">Guardian action required</h2>
                  </div>
                </div>
                <p className="mt-4 text-sm text-amber-800">
                  This appointment requires guardian approval and supporting documentation before the visit can be completed.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Billing</p>
              <h2 className="text-2xl font-semibold text-gray-900">Payment snapshot</h2>
            </div>
            <dl className="mt-6 space-y-4 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <dt>Original price</dt>
                <dd className={`text-base font-semibold ${discountAmount > 0 ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {usdFormatter.format(originalAmount)}
                </dd>
              </div>
              {discountAmount > 0 ? (
                <div className="flex items-center justify-between">
                  <dt>Coupon savings{currentAppointment.couponCode ? ` (${currentAppointment.couponCode})` : ''}</dt>
                  <dd className="text-base font-semibold text-emerald-600">−{usdFormatter.format(discountAmount)}</dd>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <dt>Coupon</dt>
                  <dd className="text-base font-semibold text-gray-900">
                    {currentAppointment.couponCode ? currentAppointment.couponCode : 'Not applied'}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt>Final amount</dt>
                <dd className="text-base font-semibold text-gray-900">{usdFormatter.format(finalAmount)}</dd>
              </div>
            </dl>
            {currentAppointment.payment_id && (
              <div className="mt-6 space-y-3 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Payment status</span>
                  <span
                    className={`font-semibold ${
                      currentAppointment.payment_id.status === 'completed'
                        ? 'text-green-600'
                        : 'text-orange-600'
                    }`}
                  >
                    {currentAppointment.payment_id.status.charAt(0).toUpperCase() +
                      currentAppointment.payment_id.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Transaction ID</span>
                  <span className="font-mono text-sm text-gray-900">
                    {currentAppointment.payment_id.transactionId}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-2xl">📝</div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Intake</p>
              <h2 className="text-2xl font-semibold text-gray-900">Forms & uploads</h2>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
            <span>Status</span>
            {currentAppointment.intakeSubmitted ? (
              <span className="font-semibold text-green-600">✓ Submitted</span>
            ) : (
              <span className="font-semibold text-orange-600">⚠ Pending</span>
            )}
          </div>
          {!currentAppointment.intakeSubmitted && currentAppointment.paymentCompleted && (
            <button
              onClick={() => router.push(`/patient/intake-form/${currentAppointment._id}`)}
              className="btn-primary mt-4 w-full"
            >
              Complete Intake Form
            </button>
          )}
          {currentAppointment.intakeSubmitted && (
            <div className="mt-4">
              {intakeLoading && <p className="text-gray-600">Loading intake form...</p>}
              {intakeError && (
                <div className="mb-3 rounded-2xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-700">
                  {intakeError}
                </div>
              )}
              {showIntakeDetails && (currentSubmission?.formData?.length || 0) > 0 && (
                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                  {currentSubmission?.formData?.map((field: any) => (
                    <div key={field.fieldId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-6">
                      <div className="sm:w-1/3 text-sm font-medium text-gray-700">
                        {field.label || field.fieldId || 'Field'}
                      </div>
                      <div className="sm:w-2/3 text-sm text-gray-900">
                        {field.fileUrls && field.fileUrls.length > 0 ? (
                          <ul className="list-disc pl-5">
                            {field.fileUrls.map((url: string, idx: number) => (
                              <li key={`${field.fieldId}-${idx}`}>
                                <a
                                  href={getFileUrl(url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {url.split('/').pop()}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          getOptionLabels(field.fieldId, field.value) ?? formatIntakeValue(field.value)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {rescheduleOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Reschedule Appointment</h3>

            {rescheduleError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {rescheduleError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => {
                  const date = e.target.value
                  setRescheduleDate(date)
                  setSelectedSlot('')
                  setAvailableSlots([])
                  if (date) {
                    handleFetchSlots(date)
                  }
                }}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Slots</label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={!rescheduleDate || rescheduleLoading}
              >
                <option value="">Select a time</option>
                {availableSlots.map((slot) => (
                  <option key={slot.time} value={slot.time}>
                    {formatTime12Hour(slot.time)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRescheduleOpen(false)}
                className="btn-secondary flex-1"
                disabled={rescheduleLoading}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                className="btn-primary flex-1"
                disabled={!rescheduleDate || !selectedSlot || rescheduleLoading}
              >
                {rescheduleLoading ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Cancel Appointment</h3>

            {cancelError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {cancelError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Please provide a short reason"
                disabled={cancelLoading}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeCancelModal}
                className="btn-secondary flex-1"
                disabled={cancelLoading}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={cancelLoading || !cancelReason.trim()}
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
