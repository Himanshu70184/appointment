'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  getDashboardStats,
  getPatientAppointments,
  clearError,
} from '@/store/slices/patientPortalSlice'
import { logout } from '@/store/slices/authSlice'
import type { AppDispatch, RootState } from '@/store/store'
import api from '@/lib/api'

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const asNumber = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const summarizePrice = (appointment: any) => {
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

export default function PatientDashboardPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { stats, appointments, loading, error } = useSelector(
    (state: RootState) => state.patientPortal
  )
  const { user } = useSelector((state: RootState) => state.auth)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; date: string }>>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [cancelAppointment, setCancelAppointment] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(getDashboardStats())
    dispatch(getPatientAppointments())
  }, [dispatch])

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
  }

  const getAppointmentTypeId = (appointment: any) => {
    if (typeof appointment.appointmentType === 'object') {
      return appointment.appointmentType?._id
    }
    return appointment.appointmentType
  }

  const handleOpenReschedule = (appointment: any) => {
    setRescheduleAppointment(appointment)
    setRescheduleDate('')
    setAvailableSlots([])
    setSelectedSlot('')
    setRescheduleError(null)
    setOpenMenuId(null)
  }

  const handleFetchSlots = async (date: string, appointment: any) => {
    if (!appointment) return
    const cardType = getAppointmentTypeId(appointment)
    if (!cardType || !appointment.state) {
      setRescheduleError('Missing appointment type or state')
      return
    }
    try {
      setRescheduleLoading(true)
      setRescheduleError(null)
      const response = await api.get('/api/patient-portal/available-slots', {
        params: {
          state: appointment.state,
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
    if (!rescheduleAppointment || !rescheduleDate || !selectedSlot) return
    try {
      setRescheduleLoading(true)
      await api.put(`/api/patient-portal/appointments/${rescheduleAppointment._id}/reschedule`, {
        scheduledDate: rescheduleDate,
        scheduledTime: selectedSlot
      })
      setRescheduleAppointment(null)
      setRescheduleDate('')
      setAvailableSlots([])
      setSelectedSlot('')
      dispatch(getDashboardStats())
      dispatch(getPatientAppointments())
    } catch (error: any) {
      setRescheduleError(error.response?.data?.message || 'Failed to reschedule appointment')
    } finally {
      setRescheduleLoading(false)
    }
  }

  const handleCancelAppointment = async (appointment: any) => {
    setOpenMenuId(null)
    setCancelAppointment(appointment)
    setCancelReason('')
    setCancelError(null)
  }

  const handleConfirmCancel = async () => {
    if (!cancelAppointment) return
    if (!cancelReason.trim()) {
      setCancelError('Cancellation reason is required')
      return
    }
    try {
      await api.put(`/api/patient-portal/appointments/${cancelAppointment._id}/cancel`, {
        reason: cancelReason.trim()
      })
      setCancelAppointment(null)
      setCancelReason('')
      setCancelError(null)
      dispatch(getDashboardStats())
      dispatch(getPatientAppointments())
    } catch (error: any) {
      setCancelError(error.response?.data?.message || 'Failed to cancel appointment')
    }
  }

  const formatTime12Hour = (time: string) => {
    const [hourStr, minuteStr] = time.split(':')
    const hour = Number(hourStr)
    if (Number.isNaN(hour)) return time
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:${minuteStr} ${period}`
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-green-100 text-green-800',
      approval: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-orange-100 text-orange-800',
      'on-hold': 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
      rescheduled: 'bg-purple-100 text-purple-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const StatCard = ({ title, value, icon }: { title: string; value: number; icon: string }) => (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Patient Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.name || 'Patient'}!</p>
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary flex items-center gap-2"
          >
            🚪 Logout
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard title="Total Appointments" value={stats.total} icon="📊" />
            <StatCard title="Scheduled" value={stats.scheduled} icon="✅" />
            <StatCard title="Awaiting Approval" value={stats.approval} icon="⏳" />
            <StatCard title="Pending" value={stats.pending} icon="🔴" />
            <StatCard title="Rescheduled" value={stats.rescheduled} icon="📅" />
            <StatCard title="Completed" value={stats.completed} icon="✔️" />
            <StatCard title="On Hold" value={stats.onHold} icon="⚠️" />
            <StatCard title="Cancelled" value={stats.cancelled} icon="❌" />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={() => router.push('/patient/book')}
            className="btn-primary"
          >
            📅 Book New Appointment
          </button>
          <button
            onClick={() => router.push('/patient/profile')}
            className="btn-secondary"
          >
            👤 Edit Profile
          </button>
        </div>

        {/* Appointments List */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">My Appointments</h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading appointments...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">You don't have any appointments yet.</p>
              <button onClick={() => router.push('/patient/book')} className="btn-primary">
                Book Your First Appointment
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Sr.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      State
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointments.map((appointment, index) => {
                    const { finalAmount, originalAmount, discountAmount } = summarizePrice(appointment)
                    const isIntakePending =
                      !appointment.intakeSubmitted &&
                      appointment.status !== 'completed' &&
                      appointment.status !== 'cancelled'
                    const statusLabel = isIntakePending
                      ? 'Intake Pending'
                      : appointment.status === 'cancelled'
                      ? 'Canceled'
                      : appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)
                    const statusClass = isIntakePending
                      ? 'bg-orange-100 text-orange-800'
                      : getStatusBadgeColor(appointment.status)

                    return (
                      <tr key={appointment._id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm">{index + 1}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {typeof appointment.appointmentType === 'string'
                            ? appointment.appointmentType
                            : appointment.appointmentType?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {appointment.scheduledDate ? (
                            <>
                              {new Date(appointment.scheduledDate).toLocaleDateString()}
                              <br />
                              <span className="text-gray-500">{appointment.scheduledTime}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">Not scheduled</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">{appointment.state}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold">
                          <div>{usdFormatter.format(finalAmount)}</div>
                          {discountAmount > 0 ? (
                            <>
                              <div className="text-xs text-gray-400 line-through">
                                {usdFormatter.format(originalAmount)}
                              </div>
                              <div className="text-xs text-emerald-600">
                                Saved {usdFormatter.format(discountAmount)}
                                {appointment.couponCode ? ` · ${appointment.couponCode}` : ''}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-400">
                              {appointment.couponCode ? `Code · ${appointment.couponCode}` : 'No coupon'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm relative">
                          {appointment.status === 'cancelled' ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === appointment._id ? null : appointment._id)}
                                className="text-gray-600 hover:text-gray-900 font-bold text-lg"
                                title="Actions"
                              >
                                ⋮
                              </button>

                              {openMenuId === appointment._id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setOpenMenuId(null)}
                                  />
                                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 flex flex-col">
                                    <button
                                      onClick={() => router.push(`/patient/appointment/${appointment._id}`)}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <span>👁️</span>
                                      View Details
                                    </button>
                                    <button
                                      onClick={() => handleOpenReschedule(appointment)}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <span>🗓️</span>
                                      Reschedule
                                    </button>
                                    <button
                                      onClick={() => handleCancelAppointment(appointment)}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <span>🗑️</span>
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rescheduleAppointment && (
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
                    handleFetchSlots(date, rescheduleAppointment)
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
                onClick={() => setRescheduleAppointment(null)}
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

      {cancelAppointment && (
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
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Please provide a reason for cancellation"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelAppointment(null)}
                className="btn-secondary flex-1"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="btn-primary flex-1"
                disabled={!cancelReason.trim()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
