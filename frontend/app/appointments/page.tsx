'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    dispatch(getAppointments({ page, limit }))
  }, [dispatch, page, limit])

  return (
    <DashboardLayout>
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">All Appointments</h1>
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
        {appointments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No appointments found.</p>
        ) : (
          <div className="overflow-x-auto">
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
                {appointments.map((appointment: any) => {
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

                  return (
                  <tr key={appointment._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.scheduledDate
                        ? new Date(appointment.scheduledDate).toLocaleDateString('en-US')
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
            {pagination && (
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
