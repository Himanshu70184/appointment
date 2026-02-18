'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  fetchAppointmentDetails,
  verifyPDMP,
  fileCertification,
  issueMMJCard,
  saveClinicalNotes,
  requestDocuments,
  selectCurrentAppointment,
  selectDoctorPortalLoading,
  selectDoctorPortalError,
  clearCurrentAppointment,
} from '@/store/slices/doctorPortalSlice';
import { getSubmissionByAppointment, clearError as clearIntakeError } from '@/store/slices/intakeFormSubmissionSlice';
import { AppDispatch } from '@/store/store';
import DashboardLayout from '@/components/DashboardLayout';

export default function AppointmentDetailsPage({ params }: { params: { id: string } }) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const appointment = useSelector(selectCurrentAppointment);
  const loading = useSelector(selectDoctorPortalLoading);
  const error = useSelector(selectDoctorPortalError);
  const { currentSubmission, loading: intakeLoading, error: intakeError } = useSelector(
    (state: any) => state.intakeFormSubmissions
  );

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [documentRequestMessage, setDocumentRequestMessage] = useState('');
  const [showDocumentRequest, setShowDocumentRequest] = useState(false);
  const [showIntakeDetails, setShowIntakeDetails] = useState(false);
  const [showCertificationConfirm, setShowCertificationConfirm] = useState(false);
  const [showIssueCardModal, setShowIssueCardModal] = useState(false);
  const [issueStartDate, setIssueStartDate] = useState('');
  const [issueEndDate, setIssueEndDate] = useState('');
  const issueStartDatePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    dispatch(fetchAppointmentDetails(params.id));
    return () => {
      dispatch(clearCurrentAppointment());
      dispatch(clearIntakeError());
    };
  }, [dispatch, params.id]);

  useEffect(() => {
    if (appointment) {
      setClinicalNotes(appointment.clinicalNotes || '');
    }
  }, [appointment]);

  useEffect(() => {
    if (!issueStartDate) {
      setIssueEndDate('');
      return;
    }

    const start = new Date(issueStartDate);
    if (Number.isNaN(start.getTime())) {
      setIssueEndDate('');
      return;
    }

    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    setIssueEndDate(end.toISOString().split('T')[0]);
  }, [issueStartDate]);

  const handleVerifyPDMP = async () => {
    try {
      await dispatch(verifyPDMP(params.id)).unwrap();
    } catch (error: any) {
      alert(error || 'Failed to verify PDMP');
    }
  };

  const handleFileCertification = async () => {
    if (!appointment?.pdmpVerified) {
      alert('Please verify PDMP before filing certification');
      return;
    }

    setShowCertificationConfirm(true);
  };

  const handleIssueMMJCard = async () => {
    if (!issueStartDate || !issueEndDate) {
      alert('Please provide both start and end date');
      return;
    }

    if (issueEndDate < issueStartDate) {
      alert('End date must be greater than or equal to start date');
      return;
    }

    try {
      if (!appointment?.certificationFiled) {
        await dispatch(fileCertification(params.id)).unwrap();
      }

      await dispatch(issueMMJCard({ id: params.id, startDate: issueStartDate, endDate: issueEndDate })).unwrap();
      alert('Certification filed and MMJ card issued successfully');
      setShowIssueCardModal(false);
    } catch (error: any) {
      alert(error || 'Failed to complete MMJ card issuance');
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeValue?: string) => {
    if (!timeValue) return 'N/A';

    const trimmed = String(timeValue).trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) return trimmed;

    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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

  const getFileUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : 'http://localhost:5000');
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getOptionLabels = (fieldId: string, value: any) => {
    const template = currentSubmission?.template_id as any;
    const sections = template?.sections || [];
    const field = sections
      .flatMap((section: any) => section.fields || [])
      .find((f: any) => f.fieldId === fieldId);

    if (!field || !field.options || field.options.length === 0) {
      return null;
    }

    const mapValueToLabel = (val: any) => {
      const option = field.options.find((opt: any) => opt.value === val);
      return option?.label || val;
    };

    if (Array.isArray(value)) {
      return value.map(mapValueToLabel).join(', ');
    }

    return mapValueToLabel(value);
  };

  const formatIntakeValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'N/A';
    }
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const hasIntakeForm = appointment?.intakeSubmitted;
  const hasDocuments = appointment?.documents && appointment.documents.length > 0;

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US');
  };

  const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    return `$${value}`;
  };

  const getAppointmentTypeLabel = () => {
    if (!appointment) return 'N/A';
    if (typeof appointment.appointmentType === 'string') {
      return 'N/A';
    }
    return appointment.appointmentType?.name || 'N/A';
  };

  const getAdjustedAmountLabel = () => {
    if (!appointment) return 'N/A';
    const amount = appointment.adjustedAmount ??
      (typeof appointment.appointmentType === 'object' ? appointment.appointmentType?.price : undefined) ??
      appointment.medicalCardType?.price;
    return formatCurrency(amount);
  };

  const formatAsMDY = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const parseMDYToISO = (value: string) => {
    const normalized = value.trim();
    const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleOpenDatePicker = () => {
    if (issueStartDatePickerRef.current?.showPicker) {
      issueStartDatePickerRef.current.showPicker();
      return;
    }
    issueStartDatePickerRef.current?.focus();
  };

  const parseAppointmentDateTime = () => {
    if (!appointment?.scheduledDate) return null;

    const scheduled = new Date(appointment.scheduledDate);
    if (Number.isNaN(scheduled.getTime())) return null;

    const rawTime = appointment?.scheduledTime;
    if (!rawTime) return scheduled;

    const timeValue = String(rawTime).trim();
    const twelveHour = timeValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const twentyFourHour = timeValue.match(/^(\d{1,2}):(\d{2})$/);

    let hours = 0;
    let minutes = 0;

    if (twelveHour) {
      hours = Number(twelveHour[1]) % 12;
      minutes = Number(twelveHour[2]);
      if (twelveHour[3].toUpperCase() === 'PM') {
        hours += 12;
      }
    } else if (twentyFourHour) {
      hours = Number(twentyFourHour[1]);
      minutes = Number(twentyFourHour[2]);
    }

    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled;
  };

  const appointmentDateTime = parseAppointmentDateTime();
  const isBeforeAppointmentDateTime = appointmentDateTime ? new Date() < appointmentDateTime : false;

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
                onClick={() => {
                  if (!appointment?.intakeSubmitted) {
                    alert('Intake form has not been submitted yet.');
                    return;
                  }
                  dispatch(getSubmissionByAppointment(params.id))
                    .unwrap()
                    .then(() => setShowIntakeDetails(true))
                    .catch(() => setShowIntakeDetails(true));
                }}
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
          {showIntakeDetails && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Intake Form Submission</h2>
                <button
                  onClick={() => setShowIntakeDetails(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Hide
                </button>
              </div>

              {intakeLoading && (
                <p className="text-gray-600">Loading intake submission...</p>
              )}

              {intakeError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                  {intakeError}
                </div>
              )}

              {!intakeLoading && (currentSubmission?.formData?.length || 0) > 0 && (
                <div className="space-y-3">
                  {currentSubmission?.formData?.map((field: any) => (
                    <div key={field.fieldId} className="flex flex-col md:flex-row md:items-start md:gap-4 border-b pb-3">
                      <div className="md:w-1/3 text-sm font-medium text-gray-700">
                        {field.label || field.fieldId || 'Field'}
                      </div>
                      <div className="md:w-2/3 text-sm text-gray-900">
                        {field.fileUrls && field.fileUrls.length > 0 ? (
                          <ul className="list-disc pl-5">
                            {field.fileUrls.map((url: string, idx: number) => (
                              <li key={`${field.fieldId}-${idx}`}>
                                <a
                                  href={getFileUrl(url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {url.split('/').pop()}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          getOptionLabels(field.fieldId, field.value) ??
                          formatIntakeValue(field.value)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!intakeLoading && !currentSubmission && !intakeError && (
                <p className="text-gray-600">No intake submission found.</p>
              )}
            </div>
          )}

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
                <p className="text-gray-900">{getAppointmentTypeLabel()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                <p className="text-gray-900">{formatDate(appointment.scheduledDate)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Time</label>
                <p className="text-gray-900">{formatTime(appointment.scheduledTime)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
                <p className="text-gray-900">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    {appointment.stateName || appointment.state}
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
                  disabled={appointment.pdmpVerified || isBeforeAppointmentDateTime}
                  className="h-5 w-5 text-green-600 rounded focus:ring-green-500"
                />
                <label className="ml-3 text-gray-900 font-medium">PDMP Verified</label>
                {appointment.pdmpVerified && (
                  <span className="ml-3 text-sm text-gray-500">
                    (Verified on {formatDate(appointment.pdmpVerifiedAt)})
                  </span>
                )}
              </div>
              {isBeforeAppointmentDateTime && !appointment.pdmpVerified && (
                <p className="text-sm text-orange-700">
                  PDMP can be verified only after scheduled appointment date &amp; time.
                </p>
              )}

              <button
                onClick={handleFileCertification}
                disabled={!appointment.pdmpVerified || appointment.mmjCardIssued}
                className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium ${
                  appointment.mmjCardIssued
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : appointment.pdmpVerified
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {appointment.mmjCardIssued ? 'MMJ Card Issued ✓' : 'File Certification'}
              </button>
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
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveClinicalNotes}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Save Clinical Notes
                </button>
              </div>
              {appointment.mmjCardIssued && (
                <p className="mt-3 text-sm text-gray-600">
                  MMJ Card validity: {formatDate(appointment.mmjCardStartDate)} to {formatDate(appointment.mmjCardEndDate)}
                </p>
              )}
            </div>
          </div>

          {showIssueCardModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Issue MMJ Card</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select MMJ card validity period to complete certification.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formatAsMDY(issueStartDate)}
                        onChange={(e) => {
                          const parsedIso = parseMDYToISO(e.target.value);
                          setIssueStartDate(parsedIso || '');
                        }}
                        placeholder="MM-DD-YYYY"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={handleOpenDatePicker}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        aria-label="Open calendar"
                      >
                        📅
                      </button>
                    </div>
                    <input
                      ref={issueStartDatePickerRef}
                      type="date"
                      value={issueStartDate}
                      onChange={(e) => setIssueStartDate(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                    />
                    <p className="mt-1 text-xs text-gray-500">Format: MM-DD-YYYY</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="text"
                      value={formatAsMDY(issueEndDate)}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Auto-filled: 1 year from start date ({formatDateShort(issueEndDate)})</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowIssueCardModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleIssueMMJCard}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  >
                    Confirm & Issue
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCertificationConfirm && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Issue MMJ Card</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to proceed with MMJ card issuance?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCertificationConfirm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      setIssueStartDate(today.toISOString().split('T')[0]);
                      setShowCertificationConfirm(false);
                      setShowIssueCardModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
