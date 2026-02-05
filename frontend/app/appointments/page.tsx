'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointments } from '@/store/slices/appointmentSlice'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'

export default function AppointmentsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { appointments, pagination } = useSelector((state: RootState) => state.appointments)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDoctor, setFilterDoctor] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterAppointmentAt, setFilterAppointmentAt] = useState('')
  const [dateFilterMode, setDateFilterMode] = useState<'created' | 'appointment'>('appointment')

  useEffect(() => {
    dispatch(getAppointments({ page, limit }))
  }, [dispatch, page, limit])

  const getServiceName = (appointment: any) =>
    typeof appointment.appointmentType === 'string'
      ? appointment.appointmentType
      : appointment.appointmentType?.name || 'N/A'

  const getDoctorName = (appointment: any) =>
    typeof appointment.doctor_id === 'object'
      ? appointment.doctor_id?.name
      : ''

  const getDisplayStatus = (appointment: any) => {
    const isIntakePending =
      !appointment.intakeSubmitted &&
      appointment.status !== 'completed' &&
      appointment.status !== 'cancelled'
    return isIntakePending ? 'Intake Pending' : appointment.status
  }

  const parseDateValue = (value?: string) => {
    if (!value) return null
    const raw = String(value).trim()

    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed

    const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*([AP]M))?)?$/i)
    if (match) {
      const month = Number(match[1]) - 1
      const day = Number(match[2])
      const year = Number(match[3])
      let hours = match[4] ? Number(match[4]) : 0
      const minutes = match[5] ? Number(match[5]) : 0
      const meridiem = match[6]?.toUpperCase()
      if (meridiem === 'PM' && hours < 12) hours += 12
      if (meridiem === 'AM' && hours === 12) hours = 0
      const date = new Date(year, month, day, hours, minutes, 0, 0)
      return Number.isNaN(date.getTime()) ? null : date
    }

    return null
  }

  const toDateInputValue = (value?: string) => {
    const date = parseDateValue(value)
    if (!date) return ''
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDisplayDate = (value?: string) => {
    const date = parseDateValue(value)
    if (!date) return 'N/A'
    return date.toLocaleDateString('en-US')
  }

  const formatDisplayTime = (value?: string) => {
    if (!value) return ''
    const raw = String(value).trim()

    const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i)
    if (timeMatch) {
      let hours = Number(timeMatch[1])
      const minutes = Number(timeMatch[2])
      const meridiem = timeMatch[3]?.toUpperCase()

      if (meridiem) {
        return `${hours}:${String(minutes).padStart(2, '0')} ${meridiem}`
      }

      const date = new Date()
      date.setHours(hours, minutes, 0, 0)
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    const parsed = parseDateValue(raw)
    if (parsed) {
      return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    return raw
  }

  const doctorOptions = useMemo(() => {
    const names = appointments
      .map(getDoctorName)
      .filter((name: string) => name)
    return Array.from(new Set(names)).sort()
  }, [appointments])

  const stateOptions = useMemo(() => {
    const states = appointments
      .map((appointment: any) => appointment.state)
      .filter((state: string) => state)
    return Array.from(new Set(states)).sort()
  }, [appointments])

  const statusOptions = useMemo(() => {
    const statuses = appointments
      .map(getDisplayStatus)
      .filter((status: string) => status)
      .map((status: string) => status.toLowerCase())
    return Array.from(new Set(statuses)).sort()
  }, [appointments])

  const filteredAppointments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return appointments.filter((appointment: any) => {
      const serviceName = getServiceName(appointment)
      const patientName = typeof appointment.patient_id === 'object'
        ? appointment.patient_id?.name || ''
        : ''
      const doctorName = getDoctorName(appointment)
      const stateName = appointment.state || ''
      const couponCode = appointment.couponCode || ''
      const displayStatus = getDisplayStatus(appointment)

      const matchesSearch = !search || [
        serviceName,
        patientName,
        doctorName,
        stateName,
        couponCode
      ].some((value) => value?.toLowerCase().includes(search))

      const matchesDoctor = !filterDoctor || doctorName === filterDoctor
      const matchesState = !filterState || stateName === filterState
      const matchesStatus = !filterStatus || displayStatus.toLowerCase() === filterStatus
      const appointmentAtDate = appointment.scheduledDate || appointment.appointmentDate
      const matchesDate = dateFilterMode !== 'created' || !filterDate || toDateInputValue(appointment.createdAt) === filterDate
      const matchesAppointmentAt = dateFilterMode !== 'appointment' || !filterAppointmentAt || toDateInputValue(appointmentAtDate) === filterAppointmentAt

      return matchesSearch && matchesDoctor && matchesState && matchesStatus && matchesDate && matchesAppointmentAt
    })
  }, [appointments, searchTerm, filterDoctor, filterState, filterStatus, filterDate, filterAppointmentAt])

  const sortedAppointments = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const getAppointmentAt = (appointment: any) => {
      const raw =
        appointment.scheduledDate ||
        appointment.appointmentDate ||
        appointment.scheduled_date ||
        appointment.appointment_date
      const date = parseDateValue(raw)
      if (!date) return null

      const timeValue = appointment.scheduledTime || appointment.appointmentTime
      if (timeValue) {
        const timeMatch = String(timeValue).match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i)
        if (timeMatch) {
          let hours = Number(timeMatch[1])
          const minutes = Number(timeMatch[2])
          const meridiem = timeMatch[3]?.toUpperCase()
          if (meridiem === 'PM' && hours < 12) hours += 12
          if (meridiem === 'AM' && hours === 12) hours = 0
          date.setHours(hours, minutes, 0, 0)
        }
      }

      return date
    }

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()

    const list = [...filteredAppointments]
    list.sort((a, b) => {
      const aDate = getAppointmentAt(a)
      const bDate = getAppointmentAt(b)

      const aDay = aDate ? new Date(aDate.getFullYear(), aDate.getMonth(), aDate.getDate()) : null
      const bDay = bDate ? new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate()) : null

      const aGroup = aDay
        ? (isSameDay(aDay, today) ? 0 : aDay > today ? 1 : 2)
        : 3
      const bGroup = bDay
        ? (isSameDay(bDay, today) ? 0 : bDay > today ? 1 : 2)
        : 3

      if (aGroup !== bGroup) return aGroup - bGroup

      if (!aDate || !bDate || !aDay || !bDay) return 0

      if (aGroup === 2) {
        if (aDay.getTime() !== bDay.getTime()) {
          return bDay.getTime() - aDay.getTime()
        }
        return aDate.getTime() - bDate.getTime()
      }

      if (aDay.getTime() !== bDay.getTime()) {
        return aDay.getTime() - bDay.getTime()
      }

      return aDate.getTime() - bDate.getTime()
    })

    return list
  }, [filteredAppointments])

  const filtersActive =
    !!searchTerm ||
    !!filterDoctor ||
    !!filterState ||
    !!filterStatus ||
    !!filterDate ||
    !!filterAppointmentAt

  const showPagination = !filtersActive && pagination && sortedAppointments.length > 0
  const totalAppointmentsCount = pagination?.totalItems ?? appointments.length
  const displayCount = filtersActive
    ? `${sortedAppointments.length} / ${totalAppointmentsCount}`
    : `${totalAppointmentsCount}`

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilterDoctor('')
    setFilterState('')
    setFilterStatus('')
    setFilterDate('')
    setFilterAppointmentAt('')
    setPage(1)
  }

  const handleDateFilterModeChange = (mode: 'created' | 'appointment') => {
    setDateFilterMode(mode)
    if (mode === 'created') {
      setFilterAppointmentAt('')
    } else {
      setFilterDate('')
    }
  }

  return (
    <DashboardLayout>
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">All Appointments</h1>
            <p className="text-sm text-gray-600 mt-1">
              Appointments: {displayCount}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="page-size" className="text-gray-600">Per page:</label>
            <select
              id="page-size"
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value))
                setPage(1)
              }}
              className="input w-24"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-full md:w-64 xl:w-80">
            <label className="block text-sm text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by service, patient, doctor, state, coupon"
              className="input w-full"
            />
          </div>
          <div className="w-full md:w-44">
            <label className="block text-sm text-gray-600 mb-1">Doctor</label>
            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="input w-full"
            >
              <option value="">All doctors</option>
              {doctorOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-36">
            <label className="block text-sm text-gray-600 mb-1">State</label>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="input w-full"
            >
              <option value="">All states</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-36">
            <label className="block text-sm text-gray-600 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-full"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-52">
            <label className="block text-sm text-gray-600 mb-1">Date Filter</label>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => handleDateFilterModeChange('appointment')}
                className={`px-1 py-2 text-sm ${dateFilterMode === 'appointment' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'}`}
              >
                Appointment At
              </button>
              <button
                type="button"
                onClick={() => handleDateFilterModeChange('created')}
                className={`px-1 py-2 text-sm border-l ${dateFilterMode === 'created' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'}`}
              >
                Created At
              </button>
            </div>
          </div>
          {dateFilterMode === 'appointment' ? (
            <div className="w-full md:w-44">
              <label className="block text-sm text-gray-600 mb-1">Appointment At</label>
              <input
                type="date"
                value={filterAppointmentAt}
                onChange={(e) => setFilterAppointmentAt(e.target.value)}
                className="input w-full"
              />
            </div>
          ) : (
            <div className="w-full md:w-44">
              <label className="block text-sm text-gray-600 mb-1">Created Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="input w-full"
              />
            </div>
          )}
          <div className="w-full md:w-auto">
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        </div>
        {sortedAppointments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No appointments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sr.No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doctor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coupon Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAppointments.map((appointment: any, index: number) => {
                  const isIntakePending =
                    !appointment.intakeSubmitted &&
                    appointment.status !== 'completed' &&
                    appointment.status !== 'cancelled'
                  const statusLabel = isIntakePending
                    ? 'Intake Pending'
                    : appointment.status
                  const statusClass = isIntakePending
                    ? 'bg-orange-100 text-orange-800'
                    : appointment.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : appointment.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : appointment.status === 'canceled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                  const serviceName = getServiceName(appointment)
                  const servicePrice =
                    appointment.adjustedAmount ??
                    (typeof appointment.appointmentType === 'object' ? appointment.appointmentType?.price : undefined) ??
                    appointment.medicalCardType?.price ??
                    appointment.payment_id?.amount ??
                    appointment.amount ??
                    0
                  const formattedPrice = typeof servicePrice === 'number'
                    ? `$${servicePrice.toFixed(2)}`
                    : 'N/A'

                  return (
                  <tr key={appointment._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {serviceName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="text-gray-900">
                        {typeof appointment.patient_id === 'object'
                          ? appointment.patient_id?.name
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDisplayDate(appointment.scheduledDate || appointment.appointmentDate)}
                        {appointment.scheduledTime || appointment.appointmentTime
                          ? ` ${formatDisplayTime(appointment.scheduledTime || appointment.appointmentTime)}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getDoctorName(appointment) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appointment.state || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appointment.couponCode || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formattedPrice}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appointment.createdAt
                        ? new Date(appointment.createdAt).toLocaleString('en-US')
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 capitalize whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}
                      >
                        {statusLabel}
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
                  )
                })}
              </tbody>
            </table>
            {showPagination && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-t">
                <p className="text-sm text-gray-600">
                  Showing {(pagination.currentPage - 1) * pagination.itemsPerPage + 1}–
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(pagination.prevPage || 1)}
                    disabled={!pagination.hasPrevPage}
                    className="btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(pagination.nextPage || pagination.currentPage)}
                    disabled={!pagination.hasNextPage}
                    className="btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
