'use client';

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  fetchAppointments,
  selectAppointments,
  selectDoctorPortalLoading,
  selectDoctorPortalError,
} from '@/store/slices/doctorPortalSlice';
import { AppDispatch } from '@/store/store';
import DashboardLayout from '@/components/DashboardLayout';

export default function DoctorAppointmentsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const appointments = useSelector(selectAppointments);
  const loading = useSelector(selectDoctorPortalLoading);
  const error = useSelector(selectDoctorPortalError);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    dispatch(fetchAppointments({}));
  }, [dispatch]);

  const handleFilter = () => {
    dispatch(
      fetchAppointments({
        status: filterStatus,
        state: filterState,
        date: filterDate,
        search: searchTerm,
      })
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFilter();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, filterState, filterStatus, filterDate]);

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

  // Get unique states from appointments
  const availableStates = Array.from(new Set(appointments.map((a: any) => a.state))).sort() as string[];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Appointments</h1>
            <p className="text-gray-600">Manage and review your patient appointments</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <input
                type="text"
                placeholder="Search by Patient Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select State</option>
                {availableStates.map((state: string) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="pending">Pending</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                    viewMode === 'list'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                    viewMode === 'calendar'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Calendar
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterState('');
                  setFilterStatus('');
                  setFilterDate('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                  <p className="text-gray-600 mt-4">Loading appointments...</p>
                </div>
              ) : appointments.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  <p>No appointments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sr.No</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Patient Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Appointment Type
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">State</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appointment: any, index: number) => (
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
                          <td className="px-6 py-4 text-sm">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {appointment.state}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {appointment.scheduledDate ? formatDate(appointment.scheduledDate) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {appointment.scheduledTime || 'N/A'}
                          </td>
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
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-center py-12">
                Calendar view will be implemented with a calendar library
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
