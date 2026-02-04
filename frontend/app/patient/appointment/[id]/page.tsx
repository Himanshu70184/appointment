'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointmentDetails, clearCurrentAppointment } from '@/store/slices/patientPortalSlice'
import { getSubmissionByAppointment, clearError as clearIntakeError } from '@/store/slices/intakeFormSubmissionSlice'
import type { AppDispatch, RootState } from '@/store/store'
import api from '@/lib/api'

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

  const statusLabel = isIntakePending
    ? 'Intake Pending'
    : currentAppointment?.status === 'cancelled'
      ? 'Canceled'
      : currentAppointment?.status
        ? currentAppointment.status.charAt(0).toUpperCase() + currentAppointment.status.slice(1)
        : 'N/A'

  const formatTime12Hour = (time?: string) => {
    if (!time) return 'Not scheduled'
    const [hourStr, minuteStr] = time.split(':')
    const hour = Number(hourStr)
    if (Number.isNaN(hour)) return time
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:${minuteStr} ${period}`
  }

  const getAppointmentTypeId = (appointment: any) => {
    if (typeof appointment.appointmentType === 'object') {
      return appointment.appointmentType?._id
    }
    return appointment.appointmentType
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button onClick={() => router.push('/patient/dashboard')} className="text-blue-600 hover:text-blue-800 mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Appointment Details</h1>
        </div>

        <div className="grid gap-6">
          {/* Status Badge */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Status</h2>
              <span
                className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                  isIntakePending ? 'intake-pending' : currentAppointment.status
                )}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Appointment Info */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Appointment Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Service Type:</span>
                <span className="font-semibold">
                  {typeof currentAppointment.appointmentType === 'string' 
                    ? currentAppointment.appointmentType 
                    : currentAppointment.appointmentType?.name || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Appointment Date:</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {currentAppointment.scheduledDate
                      ? new Date(currentAppointment.scheduledDate).toLocaleDateString('en-US')
                      : 'Not scheduled'}
                  </span>
                  {currentAppointment.status !== 'cancelled' && currentAppointment.status !== 'completed' && (
                    <button
                      onClick={() => {
                        setRescheduleOpen(true)
                        setRescheduleDate('')
                        setAvailableSlots([])
                        setSelectedSlot('')
                        setRescheduleError(null)
                      }}
                      className="btn-secondary"
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Appointment Time:</span>
                <span className="font-semibold">
                  {formatTime12Hour(currentAppointment.scheduledTime)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">State:</span>
                <span className="font-semibold">
                  {currentAppointment.stateName || currentAppointment.state}
                </span>
              </div>
              {/* Doctor info hidden for patient view */}
            </div>
          </div>

          {/* Patient Info */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Patient Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Patient Name:</span>
                <span className="font-semibold">
                  {currentAppointment.patient_id?.name ||
                    `${currentAppointment.patient_id?.firstName || ''} ${currentAppointment.patient_id?.lastName || ''}`.trim() ||
                    'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Email:</span>
                <span className="font-semibold">
                  {currentAppointment.patient_id?.email || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">
                  {currentAppointment.patient_id?.phone || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Date of Birth:</span>
                <span className="font-semibold">
                  {currentAppointment.patient_id?.dateOfBirth
                    ? new Date(currentAppointment.patient_id.dateOfBirth).toLocaleDateString('en-US')
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {currentAppointment.payment_id && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-green-600">
                    ${currentAppointment.payment_id.amount}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Payment Status:</span>
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
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono text-sm">
                    {currentAppointment.payment_id.transactionId}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Intake Status */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Intake Form</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Status:</span>
                {currentAppointment.intakeSubmitted ? (
                  <span className="font-semibold text-green-600">✓ Submitted</span>
                ) : (
                  <span className="font-semibold text-orange-600">⚠ Pending</span>
                )}
              </div>
            </div>
            {!currentAppointment.intakeSubmitted && currentAppointment.paymentCompleted && (
              <button
                onClick={() => router.push(`/patient/intake-form/${currentAppointment._id}`)}
                className="btn-primary w-full mt-4"
              >
                Complete Intake Form
              </button>
            )}
            {currentAppointment.intakeSubmitted && (
              <div className="mt-4">
                {intakeLoading && <p className="text-gray-600">Loading intake form...</p>}
                {intakeError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                    {intakeError}
                  </div>
                )}
                {showIntakeDetails && (currentSubmission?.formData?.length || 0) > 0 && (
                  <div className="space-y-3">
                    {currentSubmission?.formData?.map((field: any) => (
                      <div key={field.fieldId} className="flex flex-col md:flex-row md:items-start md:gap-4 border-b pb-3">
                        <div className="md:w-1/3 text-sm font-medium text-gray-700">
                          {field.label || field.fieldId || 'Field'}
                        </div>
                        <div className="md:w-2/3 text-sm text-gray-900">
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
                            getOptionLabels(field.fieldId, field.value) ??
                            formatIntakeValue(field.value)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {(currentAppointment.notes || currentAppointment.adminNotes) && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Notes</h2>
              {currentAppointment.notes && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">Patient Notes:</p>
                  <p className="text-gray-800">{currentAppointment.notes}</p>
                </div>
              )}
              {currentAppointment.adminNotes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Admin Notes:</p>
                  <p className="text-gray-800">{currentAppointment.adminNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Minor Patient Info */}
          {currentAppointment.isMinor && (
            <div className="card bg-yellow-50 border border-yellow-200">
              <h2 className="text-xl font-semibold mb-2 text-yellow-800">Minor Patient</h2>
              <p className="text-sm text-yellow-700">
                This appointment requires guardian approval and documentation.
              </p>
            </div>
          )}
        </div>
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
    </div>
  )
}
