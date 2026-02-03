'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import api from '@/lib/api'

export default function DoctorDashboardPage() {
  const params = useParams()
  const doctorId = params.id as string
  const [doctor, setDoctor] = useState<any>(null)
  const [stats, setStats] = useState({
    totalAppointments: 0,
    scheduledAppointments: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0
  })
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchDoctorData = async (filters?: { startDate?: string; endDate?: string }) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (filters?.startDate) params.append('startDate', filters.startDate)
      if (filters?.endDate) params.append('endDate', filters.endDate)

      const response = await api.get(`/api/doctors/${doctorId}/dashboard?${params.toString()}`)
      setDoctor(response.data.doctor)
      setStats(response.data.stats)
    } catch (error: any) {
      console.error('Error fetching doctor dashboard:', error)
      setError(error.response?.data?.message || 'Failed to load doctor dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (doctorId) {
      fetchDoctorData()
    }
  }, [doctorId])

  const handleSearch = () => {
    fetchDoctorData({ startDate, endDate })
  }

  const handleClear = () => {
    setStartDate('')
    setEndDate('')
    fetchDoctorData()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Doctor Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {doctor?.user_id?.name || 'Unknown Doctor'}
              </h2>
              <p className="text-gray-600">{doctor?.user_id?.email || 'N/A'}</p>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-right">
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{doctor?.user_id?.phone || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Price</p>
                <p className="font-medium">${doctor?.consultationFee || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Status</p>
                <p className={`font-medium ${doctor?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {doctor?.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
              <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                Add Notes
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="mt-6 border-t pt-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Search
              </button>
              <button
                onClick={handleClear}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAppointments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Scheduled Appointments</p>
                <p className="text-2xl font-bold text-blue-600">{stats.scheduledAppointments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🕐</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Appointments</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingAppointments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed Appointments</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedAppointments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">❌</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cancel Appointments</p>
                <p className="text-2xl font-bold text-red-600">{stats.cancelledAppointments}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
