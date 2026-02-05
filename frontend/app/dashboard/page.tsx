'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getCurrentUser } from '@/store/slices/authSlice'
import { getAppointments } from '@/store/slices/appointmentSlice'
import { getStates } from '@/store/slices/stateSlice'
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
  const { states: statesFromStore } = useSelector((state: RootState) => state.states)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [appointmentRange, setAppointmentRange] = useState<'monthly' | 'weekly' | 'yearly' | 'all'>('all')
  const [selectedState, setSelectedState] = useState('')

  useEffect(() => {
    if (user) {
      if (user.role_id === 3) {
        router.replace('/patient/dashboard')
        return
      }
      dispatch(getAppointments())
      dispatch(getStates({}))
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

  const buildMonthlyAppointments = (list: any[]) => {
    const monthly = Array(12).fill(0)
    const currentYear = new Date().getFullYear()
    list.forEach((appointment: any) => {
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

  const stateMaps = useMemo(() => {
    const byCode: Record<string, { code: string; name: string }> = {}
    const byName: Record<string, { code: string; name: string }> = {}
    statesFromStore.forEach((state) => {
      if (!state.code || !state.name) return
      byCode[state.code] = { code: state.code, name: state.name }
      byName[state.name.toLowerCase()] = { code: state.code, name: state.name }
    })
    return { byCode, byName }
  }, [statesFromStore])

  const filteredByState = useMemo(() => {
    if (!selectedState) return appointments
    return appointments.filter((appointment: any) => {
      const rawState = appointment.state
      if (!rawState) return false
      const normalized = typeof rawState === 'string' ? rawState.trim() : rawState
      const fromCode = stateMaps.byCode[normalized as string]
      const fromName = typeof normalized === 'string'
        ? stateMaps.byName[normalized.toLowerCase()]
        : undefined
      const appointmentStateCode = fromCode?.code || fromName?.code || normalized
      return appointmentStateCode === selectedState
    })
  }, [appointments, selectedState, stateMaps])

  const stateOptions = useMemo(() => {
    if (statesFromStore.length > 0) {
      return [...statesFromStore]
        .filter((state) => state.code && state.name)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((state) => ({ code: state.code, name: state.name }))
    }

    const fallbackStates = appointments
      .map((appointment: any) => appointment.state)
      .filter((state: string) => state)
    return Array.from(new Set(fallbackStates)).sort().map((state) => ({ code: state, name: state }))
  }, [appointments, statesFromStore])

  const filterAppointmentsByRange = (range: 'monthly' | 'weekly' | 'yearly' | 'all') => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (range === 'weekly') {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      return filteredByState.filter((appointment: any) => {
        const date = appointmentDate(appointment)
        if (!date) return false
        const day = new Date(date)
        day.setHours(0, 0, 0, 0)
        return day >= start && day <= now
      })
    }

    if (range === 'yearly') {
      const currentYear = now.getFullYear()
      return filteredByState.filter((appointment: any) => {
        const date = appointmentDate(appointment)
        return date && date.getFullYear() === currentYear
      })
    }

    return filteredByState
  }

  const scopedAppointments = useMemo(
    () => filterAppointmentsByRange(appointmentRange),
    [appointmentRange, filteredByState]
  )

  // Calculate appointment statistics (scoped to range)
  const totalAppointments = scopedAppointments.length
  const scheduledAppointments = scopedAppointments.filter((a: any) => a.status === 'scheduled').length
  const approvalAppointments = scopedAppointments.filter((a: any) => a.status === 'approval').length
  const rescheduledAppointments = scopedAppointments.filter((a: any) => a.status === 'rescheduled').length
  const canceledAppointments = scopedAppointments.filter((a: any) => a.status === 'cancelled').length
  const completedAppointments = scopedAppointments.filter((a: any) => a.status === 'completed').length
  const pendingAppointments = scopedAppointments.filter((a: any) => a.status === 'pending').length
  const onHoldAppointments = scopedAppointments.filter((a: any) => a.status === 'on-hold').length

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

  const allYears = useMemo(() => {
    const years = new Set<string>()
    filteredByState.forEach((appointment: any) => {
      const date = appointmentDate(appointment)
      if (!date) return
      years.add(String(date.getFullYear()))
    })
    const list = Array.from(years).sort()
    return list.length > 0 ? list : yearlyLabels
  }, [filteredByState, yearlyLabels])

  const appointmentChart = useMemo(() => {
    if (appointmentRange === 'monthly') {
      const data = user?.role_id === 1 && dashboardData?.monthlyAppointments?.length === 12 && !selectedState
        ? dashboardData.monthlyAppointments
        : buildMonthlyAppointments(filteredByState)
      return { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], data }
    }

    if (appointmentRange === 'weekly') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const buckets = Array(7).fill(0)
      filteredByState.forEach((appointment: any) => {
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

    if (appointmentRange === 'all') {
      const buckets = Array(allYears.length).fill(0)
      filteredByState.forEach((appointment: any) => {
        const date = appointmentDate(appointment)
        if (!date) return
        const year = String(date.getFullYear())
        const index = allYears.indexOf(year)
        if (index >= 0) buckets[index] += 1
      })
      return { labels: allYears, data: buckets }
    }

    const buckets = Array(yearlyLabels.length).fill(0)
    filteredByState.forEach((appointment: any) => {
      const date = appointmentDate(appointment)
      if (!date) return
      const year = String(date.getFullYear())
      const index = yearlyLabels.indexOf(year)
      if (index >= 0) buckets[index] += 1
    })
    return { labels: yearlyLabels, data: buckets }
  }, [appointmentRange, filteredByState, dashboardData, user, weeklyLabels, yearlyLabels, allYears, selectedState])

  const revenueChart = useMemo(() => {
    if (appointmentRange === 'monthly') {
      const currentYear = new Date().getFullYear()
      const data = dashboardData?.revenue?.monthly?.length === 12 && !selectedState
        ? dashboardData.revenue.monthly
        : buildMonthlyAppointments(filteredByState).map((_, index) => {
            const monthRevenue = filteredByState.reduce((sum: number, appointment: any) => {
              const date = appointmentDate(appointment)
              if (!date || date.getFullYear() !== currentYear || date.getMonth() !== index) return sum
              return sum + appointmentAmount(appointment)
            }, 0)
            return monthRevenue
          })
      return { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], data }
    }

    if (appointmentRange === 'weekly') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const buckets = Array(7).fill(0)
      filteredByState.forEach((appointment: any) => {
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

    if (appointmentRange === 'all') {
      const buckets = Array(allYears.length).fill(0)
      filteredByState.forEach((appointment: any) => {
        const date = appointmentDate(appointment)
        if (!date) return
        const year = String(date.getFullYear())
        const index = allYears.indexOf(year)
        if (index >= 0) buckets[index] += appointmentAmount(appointment)
      })
      return { labels: allYears, data: buckets }
    }

    const buckets = Array(yearlyLabels.length).fill(0)
    filteredByState.forEach((appointment: any) => {
      const date = appointmentDate(appointment)
      if (!date) return
      const year = String(date.getFullYear())
      const index = yearlyLabels.indexOf(year)
      if (index >= 0) buckets[index] += appointmentAmount(appointment)
    })
    return { labels: yearlyLabels, data: buckets }
  }, [appointmentRange, filteredByState, dashboardData, weeklyLabels, yearlyLabels, allYears, selectedState])

  const revenueTotal = revenueChart.data.reduce((sum: number, value: number) => sum + value, 0)

  return (
    <DashboardLayout>
      {/* Range Filter */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All States</option>
          {stateOptions.map((state) => (
            <option key={state.code} value={state.code}>{state.name}</option>
          ))}
        </select>
        <select
          value={appointmentRange}
          onChange={(e) => setAppointmentRange(e.target.value as 'monthly' | 'weekly' | 'yearly' | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="yearly">Yearly</option>
          <option value="all">All</option>
        </select>
      </div>

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
          showRangeSelector={false}
        />

        {/* Revenue Chart - Only for Admin */}
        {user?.role_id === 1 && (
          <RevenueChart
            data={revenueChart.data}
            labels={revenueChart.labels}
            total={revenueTotal}
            range={appointmentRange}
            onRangeChange={setAppointmentRange}
            showRangeSelector={false}
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
