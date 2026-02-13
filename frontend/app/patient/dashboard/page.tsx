'use client'

import { useEffect, useMemo, useState } from 'react'
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

const formatAppointmentDate = (value?: string) => {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const isIntakePending = (appointment: any) =>
  !appointment?.intakeSubmitted &&
  appointment?.status !== 'completed' &&
  appointment?.status !== 'cancelled'

const resolveStatusLabel = (appointment: any) => {
  if (!appointment) return ''
  if (isIntakePending(appointment)) return 'Intake Pending'
  if (appointment.status === 'cancelled') return 'Canceled'
  return appointment.status
    ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)
    : ''
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

  const upcomingAppointment = useMemo(() => {
    if (!appointments || appointments.length === 0) return null
    const upcoming = [...appointments]
      .filter((appointment) => appointment.scheduledDate)
      .sort((a, b) =>
        new Date(a.scheduledDate as string).getTime() - new Date(b.scheduledDate as string).getTime()
      )
    return (upcoming[0] || appointments[0]) ?? null
  }, [appointments])

  const statHighlights = stats
    ? [
        { title: 'Total Appointments', value: stats.total, icon: '📊', subtitle: 'All time' },
        { title: 'Scheduled', value: stats.scheduled, icon: '✅', subtitle: 'Confirmed visits' },
        { title: 'Awaiting Approval', value: stats.approval, icon: '⏳', subtitle: 'Admin review' },
        { title: 'Pending Tasks', value: stats.pending, icon: '📝', subtitle: 'To be finalized' },
      ]
    : []

  useEffect(() => {
    dispatch(getDashboardStats())
    dispatch(getPatientAppointments())
  }, [dispatch])

  const quickActions = [
    {
      title: 'Book A Visit',
      description: 'Need a renewal or follow-up? Secure the next slot in seconds.',
      icon: '🌿',
      cta: 'Book now',
      action: () => router.push('/patient/book'),
    },
    {
      title: 'Update Profile',
      description: 'Keep contact details fresh so your doctor can reach you instantly.',
      icon: '🧾',
      cta: 'Edit profile',
      action: () => router.push('/patient/profile'),
    },
    {
      title: 'Inbox & Reminders',
      description: 'Review notifications, intake reminders, and admin decisions.',
      icon: '🔔',
      cta: 'View alerts',
      action: () => router.push('/patient/notifications'),
    },
  ]

  const upcomingServiceName =
    typeof upcomingAppointment?.appointmentType === 'string'
      ? upcomingAppointment?.appointmentType
      : upcomingAppointment?.appointmentType?.name

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

  const StatCard = ({
    title,
    value,
    icon,
    subtitle,
  }: {
    title: string
    value: number
    icon: string
    subtitle?: string
  }) => (
    <div className="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className="text-4xl drop-shadow-sm">{icon}</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10 lg:space-y-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 p-8 text-white shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -right-10 top-0 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">Patient Portal</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">Welcome back, {user?.firstName || user?.name || 'Patient'}!</h1>
              <p className="mt-4 text-lg text-white/85">
                Track appointments, finish intake steps, and unlock renewal perks from one friendly hub.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/patient/book')}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5"
                >
                  📅 Book appointment
                </button>
                <button
                  onClick={() => router.push('/patient/notifications')}
                  className="inline-flex items-center justify-center rounded-full border border-white/50 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                >
                  🔔 Visit notifications
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white/80 transition hover:-translate-y-0.5"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-white/15 p-5 backdrop-blur-md shadow-lg ring-1 ring-white/20">
              {upcomingAppointment ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-white/70">Next appointment</p>
                  <h3 className="mt-2 text-2xl font-semibold">{upcomingServiceName || 'Medical Card Visit'}</h3>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-white/85">
                    <span className="text-lg font-semibold">{formatAppointmentDate(upcomingAppointment.scheduledDate)}</span>
                    <span className="text-white/50">•</span>
                    <span>{upcomingAppointment.scheduledTime ? formatTime12Hour(upcomingAppointment.scheduledTime) : 'Time TBD'}</span>
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/90">
                    <div>
                      <p className="text-white/60">State</p>
                      <p className="font-semibold">{upcomingAppointment.state || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Status</p>
                      <p className="font-semibold">{resolveStatusLabel(upcomingAppointment)}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-white/90">
                    <p className="mb-1 font-semibold">Friendly reminder</p>
                    <p>Upload documents before arrival and join 5 minutes early to breeze through check-in.</p>
                  </div>
                </>
              ) : (
                <div className="text-white/85">
                  <p className="text-sm uppercase tracking-wide">No visits yet</p>
                  <h3 className="mt-2 text-2xl font-semibold">Let’s schedule your first appointment</h3>
                  <p className="mt-4 text-sm">
                    Booking takes less than a minute—choose your state, grab an available slot, and we’ll send confirmations instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
            {error}
          </div>
        )}

        {stats && statHighlights.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statHighlights.map((stat) => (
              <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} subtitle={stat.subtitle} />
            ))}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <div
              key={action.title}
              className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl">{action.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Ready</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">{action.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{action.description}</p>
              <button
                onClick={action.action}
                className="mt-6 inline-flex items-center text-sm font-semibold text-emerald-600 transition group-hover:text-emerald-700"
              >
                {action.cta}
                <span className="ml-1 transition group-hover:translate-x-1">→</span>
              </button>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
            <h3 className="text-2xl font-semibold text-gray-900">Stay ahead of paperwork</h3>
            <p className="mt-3 text-gray-600">
              Keep your intake, guardian approvals, and PDMP notes organized so staff can fast-track your certification.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                Upload IDs and medical records directly from here
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                Track guardian approvals for minor patients
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✔</span>
                See PDMP verification or document requests instantly
              </li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 p-6 text-white shadow-lg lg:p-8">
            <p className="text-xs uppercase tracking-[0.4em] text-white/80">Loyalty perks</p>
            <h3 className="mt-3 text-3xl font-semibold">Save more on renewals</h3>
            <p className="mt-4 text-white/90">
              Admin and staff often unlock promo codes for returning patients. Watch your notifications for coupon drops and apply
              them during checkout.
            </p>
            <div className="mt-6 rounded-2xl bg-white/15 p-4 backdrop-blur-md">
              <p className="text-sm uppercase tracking-wide text-white/70">Featured offer</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-black">$25</span>
                <span className="text-white/80">off renewal bookings*</span>
              </div>
              <p className="mt-2 text-xs text-white/80">*When admin publishes seasonal coupons. Keep an eye on your inbox!</p>
            </div>
          </div>
        </section>

        {/* Appointments List */}
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">My Appointments</h2>
              <p className="text-sm text-gray-500">Every booking, intake status, and payment in one list.</p>
            </div>
            <button onClick={() => router.push('/patient/book')} className="btn-primary">
              + Schedule visit
            </button>
          </div>
          <div className="mt-6">

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
                    const intakePending = isIntakePending(appointment)
                    const statusLabel = resolveStatusLabel(appointment)
                    const statusClass = intakePending
                      ? 'bg-orange-100 text-orange-800'
                      : getStatusBadgeColor(appointment.status)
                    const canModifyAppointment =
                      appointment.status !== 'cancelled' && appointment.status !== 'completed'

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
                          {canModifyAppointment ? (
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
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        router.push(`/patient/appointment/${appointment._id}`)
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <span>👁️</span>
                                      View Details
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleOpenReschedule(appointment)
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <span>🗓️</span>
                                      Reschedule
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        handleCancelAppointment(appointment)
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <span>🗑️</span>
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => router.push(`/patient/appointment/${appointment._id}`)}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                            >
                              View details
                              <span aria-hidden>→</span>
                            </button>
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
      </section>
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
