'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getCurrentUser } from '@/store/slices/authSlice'
import { getAppointments } from '@/store/slices/appointmentSlice'
import DashboardLayout from '@/components/DashboardLayout'
import StatCard from '@/components/StatCard'
import AppointmentChart from '@/components/AppointmentChart'
import RevenueChart from '@/components/RevenueChart'
import api from '@/lib/api'
import type { AppDispatch, RootState } from '@/store/store'

export default function DashboardPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { appointments } = useSelector((state: RootState) => state.appointments)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  useEffect(() => {
    if (user) {
      if (user.role_id === 3) {
        router.replace('/patient/dashboard')
        return
      }
      dispatch(getAppointments())
      if (user.role_id === 1) {
        fetchAdminStats()
      }
    }
  }, [user, dispatch, router])

  const fetchAdminStats = async () => {
    try {
      const response = await api.get('/api/admin/dashboard')
      setDashboardData(response.data || null)
    } catch (error: any) {
      console.error('Failed to fetch admin stats:', error)
      // Don't block dashboard rendering if stats fail
      // Stats will be null, but dashboard will still render
      setDashboardData(null)
    }
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-xl">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  // Calculate appointment statistics
  const totalAppointments = appointments.length
  const scheduledAppointments = appointments.filter((a: any) => a.status === 'scheduled').length
  const approvalAppointments = appointments.filter((a: any) => a.status === 'approval').length
  const rescheduledAppointments = appointments.filter((a: any) => a.status === 'rescheduled').length
  const canceledAppointments = appointments.filter((a: any) => a.status === 'cancelled').length
  const completedAppointments = appointments.filter((a: any) => a.status === 'completed').length
  const pendingAppointments = appointments.filter((a: any) => a.status === 'pending').length
  const onHoldAppointments = appointments.filter((a: any) => a.status === 'on-hold').length

  const buildMonthlyAppointments = () => {
    const monthly = Array(12).fill(0)
    appointments.forEach((appointment: any) => {
      const dateValue = appointment.scheduledDate || appointment.createdAt
      if (!dateValue) return
      const date = new Date(dateValue)
      if (!Number.isNaN(date.getTime())) {
        monthly[date.getMonth()] += 1
      }
    })
    return monthly
  }

  const appointmentChartData = user?.role_id === 1 && dashboardData?.monthlyAppointments?.length === 12
    ? dashboardData.monthlyAppointments
    : buildMonthlyAppointments()

  const revenueMonthlyData = dashboardData?.revenue?.monthly || []
  const revenueTotal = dashboardData?.revenue?.total || 0

  return (
    <DashboardLayout>
      {/* Quick Actions - Admin/Staff */}
      {(user?.role_id === 1 || user?.role_id === 4) && (
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => router.push('/appointments/book')}
            className="btn-primary"
          >
            📅 Book Appointment for Patient
          </button>
          <button
            onClick={() => router.push('/appointments')}
            className="btn-secondary"
          >
            📋 View All Appointments
          </button>
        </div>
      )}

      {/* Appointment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="📅"
          label="Total Appointment"
          value={totalAppointments}
          color="green"
        />
        <StatCard
          icon="✅"
          label="Scheduled Appointment"
          value={scheduledAppointments}
          color="green"
        />
        <StatCard
          icon="📋"
          label="Approval Appointment"
          value={approvalAppointments}
          color="green"
        />
        <StatCard
          icon="🔄"
          label="Rescheduled Appointment"
          value={rescheduledAppointments}
          color="green"
        />
        <StatCard
          icon="❌"
          label="Canceled Appointments"
          value={canceledAppointments}
          color="red"
        />
        <StatCard
          icon="✅"
          label="Completed Appointment"
          value={completedAppointments}
          color="orange"
        />
        <StatCard
          icon="⏰"
          label="Pending Appointment"
          value={pendingAppointments}
          color="orange"
        />
        <StatCard
          icon="⏸️"
          label="On Hold Appointment"
          value={onHoldAppointments}
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className={`grid gap-6 mb-6 ${user?.role_id === 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Recent Appointments Chart */}
        <AppointmentChart data={appointmentChartData} />

        {/* Revenue Chart - Only for Admin */}
        {user?.role_id === 1 && (
          <RevenueChart data={revenueMonthlyData} total={revenueTotal} />
        )}
      </div>

      {/* Recent Appointments List/Calendar View */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Recent Appointments</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              List View
            </button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            {appointments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No appointments found.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointments.slice(0, 10).map((appointment: any) => (
                    <tr key={appointment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.scheduledDate
                          ? new Date(appointment.scheduledDate).toLocaleDateString()
                          : 'Not scheduled'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {typeof appointment.patient_id === 'object'
                          ? appointment.patient_id?.name
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {typeof appointment.appointmentType === 'string' 
                          ? appointment.appointmentType 
                          : appointment.appointmentType?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            appointment.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : appointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'canceled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {appointment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a
                          href={`/appointments/${appointment._id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Calendar view coming soon...
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
