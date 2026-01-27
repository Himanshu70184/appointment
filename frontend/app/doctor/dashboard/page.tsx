'use client';

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  fetchDashboard,
  selectDashboardStats,
  selectUpcomingAppointments,
  selectDoctorPortalLoading,
  selectDoctorPortalError,
} from '@/store/slices/doctorPortalSlice';
import { AppDispatch } from '@/store/store';
import DashboardLayout from '@/components/DashboardLayout';

export default function DoctorDashboardPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const stats = useSelector(selectDashboardStats);
  const upcomingAppointments = useSelector(selectUpcomingAppointments);
  const loading = useSelector(selectDoctorPortalLoading);
  const error = useSelector(selectDoctorPortalError);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      'on-hold': 'bg-orange-100 text-orange-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Doctor Dashboard</h1>
            <p className="text-gray-600">Overview of your appointments and schedule</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Statistics Cards */}
          {loading && !stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="text-gray-600 text-sm font-medium mb-2">Total Appointments</div>
                <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="text-gray-600 text-sm font-medium mb-2">Scheduled</div>
                <div className="text-3xl font-bold text-green-600">{stats.scheduled}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="text-gray-600 text-sm font-medium mb-2">Pending</div>
                <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="text-gray-600 text-sm font-medium mb-2">On Hold</div>
                <div className="text-3xl font-bold text-orange-600">{stats.onHold}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="text-gray-600 text-sm font-medium mb-2">Canceled</div>
                <div className="text-3xl font-bold text-red-600">{stats.cancelled}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="text-gray-600 text-sm font-medium mb-2">Completed</div>
                <div className="text-3xl font-bold text-blue-600">{stats.completed}</div>
              </div>
            </div>
          ) : null}

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Upcoming Appointments</h2>
              <button
                onClick={() => router.push('/doctor/appointments')}
                className="text-green-600 hover:text-green-700 font-medium text-sm"
              >
                View All →
              </button>
            </div>

            {loading && upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                <p className="text-gray-600 mt-4">Loading appointments...</p>
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center text-gray-600">
                <p>No upcoming appointments scheduled</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sr.No</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Patient Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Appointment Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">State</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingAppointments.map((appointment: any, index: number) => (
                      <tr key={appointment._id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {appointment.patient_id.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {typeof appointment.appointmentType === 'string' 
                            ? appointment.appointmentType 
                            : appointment.appointmentType?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {appointment.state}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(appointment.scheduledDate)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{appointment.scheduledTime}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              appointment.status
                            )}`}
                          >
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => router.push(`/doctor/appointments/${appointment._id}`)}
                            className="text-green-600 hover:text-green-900 font-medium"
                            title="View Details"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
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
    </DashboardLayout>
  );
}
