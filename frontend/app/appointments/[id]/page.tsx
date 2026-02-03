'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointment, clearCurrentAppointment } from '@/store/slices/appointmentSlice'
import { getSubmissionByAppointment, clearError as clearIntakeError } from '@/store/slices/intakeFormSubmissionSlice'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'
import api from '@/lib/api'

export default function AppointmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const appointmentId = params.id as string
  const { currentAppointment, loading } = useSelector((state: RootState) => state.appointments)
  const { currentSubmission, loading: intakeLoading, error: intakeError } = useSelector(
    (state: RootState) => state.intakeFormSubmissions
  )
  const [activeTab, setActiveTab] = useState<'emailLogs' | 'tasks' | 'notes'>('notes')
  const [notes, setNotes] = useState('')
  const [documentRequest, setDocumentRequest] = useState('')
  const [showIntakeDetails, setShowIntakeDetails] = useState(false)
  const [emailLogs, setEmailLogs] = useState<Array<{ title: string; message: string; createdAt: string }>>([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)
  const [emailLogsError, setEmailLogsError] = useState<string | null>(null)

  useEffect(() => {
    if (appointmentId) {
      dispatch(getAppointment(appointmentId))
    }
    
    // Cleanup when component unmounts
    return () => {
      dispatch(clearCurrentAppointment())
      dispatch(clearIntakeError())
    }
  }, [appointmentId, dispatch])

  useEffect(() => {
    // Load existing notes if available (check both adminNotes and clinicalNotes for backwards compatibility)
    if (currentAppointment?.adminNotes) {
      setNotes(currentAppointment.adminNotes)
    } else if (currentAppointment?.clinicalNotes) {
      setNotes(currentAppointment.clinicalNotes)
    }
  }, [currentAppointment])

  useEffect(() => {
    const fetchEmailLogs = async () => {
      if (!appointmentId) return
      setEmailLogsLoading(true)
      setEmailLogsError(null)
      try {
        const response = await api.get(`/api/appointments/${appointmentId}/email-logs`)
        setEmailLogs(response.data?.logs || [])
      } catch (error: any) {
        setEmailLogsError(error.response?.data?.message || 'Failed to load email logs')
      } finally {
        setEmailLogsLoading(false)
      }
    }

    if (activeTab === 'emailLogs') {
      fetchEmailLogs()
    }
  }, [activeTab, appointmentId])

  const handleSendDocumentRequest = () => {
    // TODO: Implement document request functionality
    console.log('Requesting document:', documentRequest)
    alert('Document request sent to patient')
    setDocumentRequest('')
  }

  const handleSaveNotes = async () => {
    if (!notes.trim()) {
      alert('Please enter some notes before saving')
      return
    }
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]
      const apiUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? `http://${window.location.hostname}:5000`
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      
      const response = await fetch(`${apiUrl}/api/appointments/${appointmentId}/notes`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminNotes: notes })
      })
      if (response.ok) {
        alert('Notes saved successfully')
        // Refresh appointment data
        dispatch(getAppointment(appointmentId))
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save notes')
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      alert('Failed to save notes. Please try again.')
    }
  }

  const handleViewIntakeForm = () => {
    if (!currentAppointment) return
    if (!currentAppointment.intakeSubmitted) {
      alert('Intake form has not been submitted yet.')
      return
    }

    dispatch(getSubmissionByAppointment(appointmentId))
      .unwrap()
      .then(() => setShowIntakeDetails(true))
      .catch(() => setShowIntakeDetails(true))
  }

  const getFileUrl = (url: string) => {
    if (!url) return url
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : 'http://localhost:5000')
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }

  const getOptionLabels = (fieldId: string, value: any) => {
    const template = currentSubmission?.template_id as any
    const sections = template?.sections || []
    const field = sections
      .flatMap((section: any) => section.fields || [])
      .find((f: any) => f.fieldId === fieldId)

    if (!field || !field.options || field.options.length === 0) {
      return null
    }

    const mapValueToLabel = (val: any) => {
      const option = field.options.find((opt: any) => opt.value === val)
      return option?.label || val
    }

    if (Array.isArray(value)) {
      return value.map(mapValueToLabel).join(', ')
    }

    return mapValueToLabel(value)
  }

  const formatIntakeValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'N/A'
    }
    if (value === true) return 'Yes'
    if (value === false) return 'No'
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const handleSendEmail = async () => {
    if (!currentAppointment) return
    try {
      const isIntakePending =
        !currentAppointment.intakeSubmitted &&
        currentAppointment.status !== 'completed' &&
        currentAppointment.status !== 'cancelled'

      const template = isIntakePending
        ? 'pending-intake'
        : currentAppointment.status === 'approval' || currentAppointment.status === 'need_admin_approval'
        ? 'need-approval'
        : 'scheduled'

      await api.post(`/api/appointments/${appointmentId}/send-email`, { template })

      alert(`Email sent successfully (${template})`)

      if (activeTab === 'emailLogs') {
        const response = await api.get(`/api/appointments/${appointmentId}/email-logs`)
        setEmailLogs(response.data?.logs || [])
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send email')
    }
  }

  const handleCompleteAppointment = async () => {
    if (!currentAppointment) return
    if (currentAppointment.status === 'completed') {
      alert('Appointment is already completed')
      return
    }

    const confirmComplete = confirm('Mark this appointment as completed?')
    if (!confirmComplete) return

    try {
      await api.put(`/api/appointments/${appointmentId}/status`, { status: 'completed' })
      await dispatch(getAppointment(appointmentId))
      alert('Appointment marked as completed')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to complete appointment')
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {loading || !currentAppointment ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading appointment details...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Appointment Details</h1>
              <p className="text-sm text-gray-500 mt-1">
                Dashboard / <span className="text-gray-900">Appointments</span>
              </p>
            </div>

            <div className="flex gap-4 mb-4">
              <button 
                onClick={handleSendEmail}
                className="btn-primary"
              >
                Send Email
              </button>
              <button 
                onClick={handleViewIntakeForm}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
              >
                View Intake Form
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                Download Document
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Patient Info & Notes */}
              <div className="lg:col-span-2 space-y-6">
                {showIntakeDetails && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Intake Form Submission</h2>
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

                {/* Patient Information */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Patient Information</h2>
                    <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                      Edit Profile
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm text-gray-600">First Name</label>
                      <p className="font-medium">
                        {typeof currentAppointment.patient_id === 'object' 
                          ? currentAppointment.patient_id?.name?.split(' ')[0] || 'N/A'
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Last Name</label>
                      <p className="font-medium">
                        {typeof currentAppointment.patient_id === 'object' 
                          ? currentAppointment.patient_id?.name?.split(' ').slice(1).join(' ') || 'N/A'
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Date of Birth</label>
                      <p className="font-medium">
                        {typeof currentAppointment.patient_id === 'object' && currentAppointment.patient_id?.dateOfBirth
                          ? new Date(currentAppointment.patient_id.dateOfBirth).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Email Address</label>
                      <p className="font-medium">
                        {typeof currentAppointment.patient_id === 'object' 
                          ? currentAppointment.patient_id?.email || 'N/A'
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Phone Number</label>
                      <p className="font-medium">
                        {typeof currentAppointment.patient_id === 'object' 
                          ? currentAppointment.patient_id?.phone || 'N/A'
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm text-gray-600 mb-2 block">
                      Request patient to upload additional document
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={documentRequest}
                        onChange={(e) => setDocumentRequest(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter document name or description"
                      />
                      <button
                        onClick={handleSendDocumentRequest}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="card">
                  <div className="border-b mb-4">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setActiveTab('emailLogs')}
                        className={`pb-2 px-1 ${
                          activeTab === 'emailLogs'
                            ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Email Logs
                      </button>
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className={`pb-2 px-1 ${
                          activeTab === 'tasks'
                            ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Tasks
                      </button>
                      <button
                        onClick={() => setActiveTab('notes')}
                        className={`pb-2 px-1 ${
                          activeTab === 'notes'
                            ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Notes
                      </button>
                    </div>
                  </div>

                  {activeTab === 'notes' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={6}
                        placeholder="Enter your notes here..."
                      />
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleSaveNotes}
                          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'emailLogs' && (
                    <div>
                      {emailLogsLoading ? (
                        <div className="text-gray-500 text-center py-8">Loading email logs...</div>
                      ) : emailLogsError ? (
                        <div className="text-red-600 text-center py-8">{emailLogsError}</div>
                      ) : emailLogs.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">No email logs available</div>
                      ) : (
                        <ul className="space-y-4">
                          {emailLogs.map((log, index) => (
                            <li key={`${log.createdAt}-${index}`} className="border rounded p-4">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-900">{log.title}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{log.message}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {activeTab === 'tasks' && (
                    <div className="text-gray-500 text-center py-8">
                      No tasks available
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Appointment & Doctor Details */}
              <div className="space-y-6">
                {/* Appointment Details */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Appointment Details</h2>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600">Appointment Type</label>
                      <p className="font-medium">
                        {typeof currentAppointment.appointmentType === 'string' 
                          ? currentAppointment.appointmentType 
                          : currentAppointment.appointmentType?.name || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Appointment Date</label>
                      <p className="font-medium">
                        {currentAppointment.scheduledDate 
                          ? new Date(currentAppointment.scheduledDate).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric'
                            })
                          : 'N/A'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Appointment Time</label>
                      <p className="font-medium">
                        {currentAppointment.scheduledTime || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">PRN</label>
                      <p className="font-medium">
                        {typeof currentAppointment.patient_id === 'object' 
                          ? currentAppointment.patient_id?.prn || 'Not assigned'
                          : 'Not assigned'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Status</label>
                      <p className="mt-1">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            currentAppointment.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : currentAppointment.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-800'
                              : currentAppointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {currentAppointment.status.charAt(0).toUpperCase() + currentAppointment.status.slice(1)}
                        </span>
                      </p>
                    </div>

                    <div className="pt-3 border-t">
                      <button className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        Change Status & Time
                      </button>
                    </div>
                    <button
                      onClick={handleCompleteAppointment}
                      className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                    >
                      Complete Appointment
                    </button>
                  </div>
                </div>

                {/* Doctor Information */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Doctor Information</h2>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600">Name</label>
                      <p className="font-medium">
                        {typeof currentAppointment.doctor_id === 'object' 
                          ? currentAppointment.doctor_id?.name || 'Not assigned'
                          : 'Not assigned'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Email</label>
                      <p className="font-medium">
                        {typeof currentAppointment.doctor_id === 'object' 
                          ? currentAppointment.doctor_id?.email || 'N/A'
                          : 'N/A'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Phone Number</label>
                      <p className="font-medium">
                        {typeof currentAppointment.doctor_id === 'object' && currentAppointment.doctor_id?.phone
                          ? currentAppointment.doctor_id.phone
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
