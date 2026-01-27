'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  getDashboardStats,
  getPatientAppointments,
  clearError,
} from '@/store/slices/patientPortalSlice'
import type { AppDispatch, RootState } from '@/store/store'

export default function PatientDashboardPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { stats, appointments, loading, error } = useSelector(
    (state: RootState) => state.patientPortal
  )
  const { user } = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    if (!user || user.role_id !== 3) {
      router.push('/login')
      return
    }

    dispatch(getDashboardStats())
    dispatch(getPatientAppointments())
  }, [dispatch, user, router])

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Patient Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user?.name || 'Patient'}!</p>
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
                  {appointments.map((appointment, index) => (
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
                        ${appointment.medicalCardType?.price || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            appointment.status
                          )}`}
                        >
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                        {appointment.status === 'pending' && !appointment.intakeSubmitted && (
                          <div className="mt-1">
                            <span className="text-xs text-orange-600">⚠ Intake Pending</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/patient/appointment/${appointment._id}`)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          View Details
                        </button>
                        {appointment.status === 'pending' && !appointment.intakeSubmitted && (
                          <button
                            onClick={() =>
                              router.push(`/patient/intake/${appointment._id}`)
                            }
                            className="text-green-600 hover:text-green-800"
                          >
                            Complete Intake
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
