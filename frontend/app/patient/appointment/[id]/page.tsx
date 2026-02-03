'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointmentDetails, clearCurrentAppointment } from '@/store/slices/patientPortalSlice'
import type { AppDispatch, RootState } from '@/store/store'

export default function AppointmentDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const { currentAppointment, loading, error } = useSelector(
    (state: RootState) => state.patientPortal
  )
  const appointmentId = params?.id as string

  useEffect(() => {
    if (appointmentId) {
      dispatch(getAppointmentDetails(appointmentId))
    }

    return () => {
      dispatch(clearCurrentAppointment())
    }
  }, [appointmentId, dispatch])

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
    currentAppointment?.status !== 'cancelled' &&
    currentAppointment?.status !== 'canceled'

  const statusLabel = isIntakePending
    ? 'Intake Pending'
    : currentAppointment?.status
      ? currentAppointment.status.charAt(0).toUpperCase() + currentAppointment.status.slice(1)
      : 'N/A'

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
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Date:</span>
                <span className="font-semibold">
                  {currentAppointment.scheduledDate
                    ? new Date(currentAppointment.scheduledDate).toLocaleDateString()
                    : 'Not scheduled'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Time:</span>
                <span className="font-semibold">
                  {currentAppointment.scheduledTime || 'Not scheduled'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">State:</span>
                <span className="font-semibold">{currentAppointment.state}</span>
              </div>
              {currentAppointment.doctor_id && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Doctor:</span>
                  <span className="font-semibold">{currentAppointment.doctor_id.name}</span>
                </div>
              )}
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
    </div>
  )
}
