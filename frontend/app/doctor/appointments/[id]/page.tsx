'use client';

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  fetchAppointmentDetails,
  verifyPDMP,
  fileCertification,
  saveClinicalNotes,
  requestDocuments,
  updateAppointmentStatus,
  selectCurrentAppointment,
  selectDoctorPortalLoading,
  selectDoctorPortalError,
  clearCurrentAppointment,
} from '@/store/slices/doctorPortalSlice';
import { AppDispatch } from '@/store/store';
import DashboardLayout from '@/components/DashboardLayout';

export default function AppointmentDetailsPage({ params }: { params: { id: string } }) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const appointment = useSelector(selectCurrentAppointment);
  const loading = useSelector(selectDoctorPortalLoading);
  const error = useSelector(selectDoctorPortalError);

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [documentRequestMessage, setDocumentRequestMessage] = useState('');
  const [showDocumentRequest, setShowDocumentRequest] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    dispatch(fetchAppointmentDetails(params.id));
    return () => {
      dispatch(clearCurrentAppointment());
    };
  }, [dispatch, params.id]);

  useEffect(() => {
    if (appointment) {
      setClinicalNotes(appointment.clinicalNotes || '');
      setSelectedStatus(appointment.status);
    }
  }, [appointment]);

  const handleVerifyPDMP = async () => {
    if (confirm('Are you sure you want to verify PDMP for this appointment?')) {
      try {
        await dispatch(verifyPDMP(params.id)).unwrap();
        alert('PDMP verified successfully');
      } catch (error: any) {
        alert(error || 'Failed to verify PDMP');
      }
    }
  };

  const handleFileCertification = async () => {
    if (!appointment?.pdmpVerified) {
      alert('Please verify PDMP before filing certification');
      return;
    }
    if (confirm('Are you sure you want to file the certification? This will mark the appointment as completed.')) {
      try {
        await dispatch(fileCertification(params.id)).unwrap();
        alert('Certification filed successfully');
      } catch (error: any) {
        alert(error || 'Failed to file certification');
      }
    }
  };

  const handleSaveClinicalNotes = async () => {
    try {
      await dispatch(saveClinicalNotes({ id: params.id, clinicalNotes })).unwrap();
      alert('Clinical notes saved successfully');
    } catch (error: any) {
      alert(error || 'Failed to save clinical notes');
    }
  };

  const handleRequestDocuments = async () => {
    if (!documentRequestMessage.trim()) {
      alert('Please enter a message for the document request');
      return;
    }
    try {
      await dispatch(requestDocuments({ id: params.id, message: documentRequestMessage })).unwrap();
      alert('Document request sent to admin successfully');
      setDocumentRequestMessage('');
      setShowDocumentRequest(false);
    } catch (error: any) {
      alert(error || 'Failed to request documents');
    }
  };

  const handleStatusChange = async () => {
    if (selectedStatus === appointment?.status) return;
    try {
      await dispatch(updateAppointmentStatus({ id: params.id, status: selectedStatus })).unwrap();
      alert('Status updated successfully');
    } catch (error: any) {
      alert(error || 'Failed to update status');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
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

  const hasIntakeForm = appointment?.intakeForm && Object.keys(appointment.intakeForm).length > 0;
  const hasDocuments = appointment?.documents && appointment.documents.length > 0;

  if (loading && !appointment) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="text-gray-600 mt-4">Loading appointment details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
              <p className="text-red-800">Appointment not found</p>
              <button
                onClick={() => router.push('/doctor/appointments')}
                className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Back to Appointments
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push('/doctor/appointments')}
                className="text-green-600 hover:text-green-700 font-medium mb-2 inline-flex items-center"
              >
                ← Back to Appointments
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Appointment Details</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                disabled={!hasIntakeForm}
              >
                View Intake Form
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium ${
                  hasDocuments
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!hasDocuments}
              >
                Additional Documents
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Intake Pending Alert */}
          {!hasIntakeForm && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">⚠️ Note: Intake Pending</p>
            </div>
          )}

          {/* Patient Information */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                <p className="text-gray-900">{appointment.patient_id.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                <p className="text-gray-900">{appointment.patient_id.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth</label>
                <p className="text-gray-900">{formatDate(appointment.patient_id.dateOfBirth)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                <p className="text-gray-900">{appointment.patient_id.phone || 'N/A'}</p>
              </div>
            </div>

            {/* Document Request Section */}
            <div className="mt-6 pt-6 border-t">
              <label className="block text-sm font-medium text-gray-900 mb-2">Request Document</label>
              {!showDocumentRequest ? (
                <button
                  onClick={() => setShowDocumentRequest(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Request Additional Documents
                </button>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={documentRequestMessage}
                    onChange={(e) => setDocumentRequestMessage(e.target.value)}
                    placeholder="Describe what documents you need..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestDocuments}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Send Request
                    </button>
                    <button
                      onClick={() => {
                        setShowDocumentRequest(false);
                        setDocumentRequestMessage('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Appointment Data & Certification */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Appointment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Appointment Type</label>
                <p className="text-gray-900">{appointment.appointmentType}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Adjusted Amount</label>
                <p className="text-gray-900">${appointment.adjustedAmount || appointment.medicalCardType.price}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                <p className="text-gray-900">{formatDate(appointment.scheduledDate)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Time</label>
                <p className="text-gray-900">{appointment.scheduledTime || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
                <p className="text-gray-900">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    {appointment.state}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                <p className="text-gray-900">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.status)}`}>
                    {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                  </span>
                </p>
              </div>
            </div>

            {/* Certification Actions */}
            <div className="pt-6 border-t space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={appointment.pdmpVerified}
                  onChange={handleVerifyPDMP}
                  disabled={appointment.pdmpVerified}
                  className="h-5 w-5 text-green-600 rounded focus:ring-green-500"
                />
                <label className="ml-3 text-gray-900 font-medium">PDMP Verified</label>
                {appointment.pdmpVerified && (
                  <span className="ml-3 text-sm text-gray-500">
                    (Verified on {formatDate(appointment.pdmpVerifiedAt)})
                  </span>
                )}
              </div>

              <button
                onClick={handleFileCertification}
                disabled={!appointment.pdmpVerified || appointment.certificationFiled}
                className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium ${
                  appointment.certificationFiled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : appointment.pdmpVerified
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {appointment.certificationFiled ? 'Certification Filed ✓' : 'File Certification'}
              </button>

              <div className="flex items-center gap-4">
                <label className="text-gray-900 font-medium">Change Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
                {selectedStatus !== appointment.status && (
                  <button
                    onClick={handleStatusChange}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Update Status
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Clinical Notes</h2>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Enter your clinical observations and notes here..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 min-h-[200px]"
            />
            <div className="mt-4">
              <button
                onClick={handleSaveClinicalNotes}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Save Clinical Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
