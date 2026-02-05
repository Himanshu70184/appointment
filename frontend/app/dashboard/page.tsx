'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [appointmentRange, setAppointmentRange] = useState<'monthly' | 'weekly' | 'yearly'>('monthly')
  const [revenueRange, setRevenueRange] = useState<'monthly' | 'weekly' | 'yearly'>('monthly')

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
    const currentYear = new Date().getFullYear()
    appointments.forEach((appointment: any) => {
      const dateValue = appointment.scheduledDate || appointment.appointmentDate || appointment.createdAt
      if (!dateValue) return
      const date = new Date(dateValue)
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === currentYear) {
        monthly[date.getMonth()] += 1
      }
    })
    return monthly
  }

  const appointmentDate = (appointment: any) => {
    const dateValue =
      appointment.scheduledDate ||
      appointment.appointmentDate ||
      appointment.scheduled_date ||
      appointment.appointment_date ||
      appointment.createdAt
    if (!dateValue) return null
    const date = new Date(dateValue)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const appointmentAmount = (appointment: any) => {
    const paymentAmount = typeof appointment.payment_id === 'object'
      ? appointment.payment_id?.amount
      : undefined
    const typePrice = typeof appointment.appointmentType === 'object'
      ? appointment.appointmentType?.price
      : undefined
    return Number(
      appointment.adjustedAmount ??
      paymentAmount ??
      appointment.amount ??
      typePrice ??
      appointment.medicalCardType?.price ??
      0
    )
  }

  const weeklyLabels = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (6 - index))
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    })
  }, [])

  const yearlyLabels = useMemo(() => {
    const year = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, index) => String(year - (4 - index)))
  }, [])

  const appointmentChart = useMemo(() => {
    if (appointmentRange === 'monthly') {
      const data = user?.role_id === 1 && dashboardData?.monthlyAppointments?.length === 12
        ? dashboardData.monthlyAppointments
        : buildMonthlyAppointments()
      return { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], data }
    }

    if (appointmentRange === 'weekly') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const buckets = Array(7).fill(0)
      appointments.forEach((appointment: any) => {
        const date = appointmentDate(appointment)
        if (!date) return
        const day = new Date(date)
        day.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const index = diffDays + 6
        if (index >= 0 && index < 7) {
          buckets[index] += 1
        }
      })
      return { labels: weeklyLabels, data: buckets }
    }

    const buckets = Array(yearlyLabels.length).fill(0)
    appointments.forEach((appointment: any) => {
      const date = appointmentDate(appointment)
      if (!date) return
      const year = String(date.getFullYear())
      const index = yearlyLabels.indexOf(year)
      if (index >= 0) buckets[index] += 1
    })
    return { labels: yearlyLabels, data: buckets }
  }, [appointmentRange, appointments, dashboardData, user, weeklyLabels, yearlyLabels])

  const revenueChart = useMemo(() => {
    if (revenueRange === 'monthly') {
      const currentYear = new Date().getFullYear()
      const data = dashboardData?.revenue?.monthly?.length === 12
        ? dashboardData.revenue.monthly
        : buildMonthlyAppointments().map((_, index) => {
            const monthRevenue = appointments.reduce((sum: number, appointment: any) => {
              const date = appointmentDate(appointment)
              if (!date || date.getFullYear() !== currentYear || date.getMonth() !== index) return sum
              return sum + appointmentAmount(appointment)
            }, 0)
            return monthRevenue
          })
      return { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], data }
    }

    if (revenueRange === 'weekly') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const buckets = Array(7).fill(0)
      appointments.forEach((appointment: any) => {
        const date = appointmentDate(appointment)
        if (!date) return
        const day = new Date(date)
        day.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const index = diffDays + 6
        if (index >= 0 && index < 7) {
          buckets[index] += appointmentAmount(appointment)
        }
      })
      return { labels: weeklyLabels, data: buckets }
    }

    const buckets = Array(yearlyLabels.length).fill(0)
    appointments.forEach((appointment: any) => {
      const date = appointmentDate(appointment)
      if (!date) return
      const year = String(date.getFullYear())
      const index = yearlyLabels.indexOf(year)
      if (index >= 0) buckets[index] += appointmentAmount(appointment)
    })
    return { labels: yearlyLabels, data: buckets }
  }, [revenueRange, appointments, dashboardData, weeklyLabels, yearlyLabels])

  const revenueTotal = revenueChart.data.reduce((sum: number, value: number) => sum + value, 0)

  return (
    <DashboardLayout>
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
        <AppointmentChart
          data={appointmentChart.data}
          labels={appointmentChart.labels}
          range={appointmentRange}
          onRangeChange={setAppointmentRange}
        />

        {/* Revenue Chart - Only for Admin */}
        {user?.role_id === 1 && (
          <RevenueChart
            data={revenueChart.data}
            labels={revenueChart.labels}
            total={revenueTotal}
            range={revenueRange}
            onRangeChange={setRevenueRange}
          />
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
