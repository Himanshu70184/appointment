'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointment, clearCurrentAppointment } from '@/store/slices/appointmentSlice'
import { getSubmissionByAppointment, clearError as clearIntakeError } from '@/store/slices/intakeFormSubmissionSlice'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'
import api from '@/lib/api'

// Utility to get user id from user object
const getUserId = (user: any) => user?._id || user?.id || user?.user_id || null;

// Auto-save debounce hook
const useAutoSaveNotes = (notes: string, appointmentId: string, onStatusChange: (status: string) => void) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!notes.trim() || !appointmentId) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    onStatusChange('saving')

    timeoutRef.current = setTimeout(async () => {
      try {
        const apiUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
          ? `http://${window.location.hostname}:5000`
          : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]
        
        const response = await fetch(`${apiUrl}/api/appointments/${appointmentId}/notes`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ adminNotes: notes })
        })

        if (response.ok) {
          onStatusChange('saved')
          setTimeout(() => onStatusChange(''), 2000)
        } else {
          const errorData = await response.json()
          onStatusChange(`error: ${errorData.message || 'Failed to save'}`)
        }
      } catch (error: any) {
        onStatusChange(`error: ${error.message || 'Save failed'}`)
      }
    }, 1500)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [notes, appointmentId, onStatusChange])
}

export default function AppointmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const appointmentId = params.id as string
  const { currentAppointment, loading } = useSelector((state: RootState) => state.appointments)
  const { currentSubmission, loading: intakeLoading, error: intakeError } = useSelector(
    (state: RootState) => state.intakeFormSubmissions
  )
  // Get current user at top-level (fixes hook error)
  const currentUser = useSelector((state: RootState) => state.auth.user)
  const [activeTab, setActiveTab] = useState<'emailLogs' | 'tasks' | 'notes'>('notes')
  const [notes, setNotes] = useState('')
  const [notesSaveStatus, setNotesSaveStatus] = useState('')
  const [documentRequest, setDocumentRequest] = useState('')
  const [showIntakeDetails, setShowIntakeDetails] = useState(false)
  const [emailLogs, setEmailLogs] = useState<Array<{ title: string; message: string; createdAt: string }>>([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)
  const [emailLogsError, setEmailLogsError] = useState<string | null>(null)
  const [isEditingPatient, setIsEditingPatient] = useState(false)
  const [patientSuccess, setPatientSuccess] = useState<string | null>(null)
  const dobPickerRef = useRef<HTMLInputElement | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [staffMembers, setStaffMembers] = useState<any[]>([])
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium'
  })
  const [patientForm, setPatientForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: ''
  })

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

  // Auto-save notes
  useAutoSaveNotes(notes, appointmentId, setNotesSaveStatus)

  useEffect(() => {
    if (typeof currentAppointment?.patient_id === 'object' && currentAppointment.patient_id) {
      const patient = currentAppointment.patient_id as any
      const [nameFirst, ...nameRest] = (patient.name || '').split(' ')
      setPatientForm({
        firstName: patient.firstName || nameFirst || '',
        lastName: patient.lastName || nameRest.join(' ') || '',
        email: patient.email || '',
        phone: patient.phone || '',
        dateOfBirth: patient.dateOfBirth
          ? formatUsDate(patient.dateOfBirth)
          : ''
      })
    }
  }, [currentAppointment])

  const latestPendingDocumentRequest = (currentAppointment?.documentRequests || [])
    .filter((request: any) => request.status === 'pending')
    .sort((a: any, b: any) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime())[0]

  useEffect(() => {
    if (!documentRequest.trim() && latestPendingDocumentRequest?.message) {
      setDocumentRequest(latestPendingDocumentRequest.message)
    }
  }, [documentRequest, latestPendingDocumentRequest])

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

  useEffect(() => {
    const fetchTasks = async () => {
      if (!appointmentId) return
      setTasksLoading(true)
      try {
        const response = await api.get('/api/tasks', {
          params: { appointment: appointmentId }
        })
        setTasks(response.data?.tasks || [])
      } catch (error: any) {
        console.error('Failed to fetch tasks:', error)
      } finally {
        setTasksLoading(false)
      }
    }

    if (activeTab === 'tasks') {
      fetchTasks()
    }
  }, [activeTab, appointmentId])

  useEffect(() => {
    const fetchStaffMembers = async () => {
      try {
        const response = await api.get('/api/users', {
          params: { role: 'staff' }
        })
        console.log('Staff response:', response.data)
        const staffList = response.data?.users || []
        console.log('Staff members:', staffList)
        setStaffMembers(staffList)
      } catch (error: any) {
        console.error('Failed to fetch staff:', error.response?.data || error.message)
      }
    }

    if (showCreateTaskModal) {
      fetchStaffMembers()
    }
  }, [showCreateTaskModal])

  const handleSendDocumentRequest = async () => {
    if (!documentRequest.trim()) {
      alert('Please enter a document request message')
      return
    }

    try {
      await api.post(`/api/appointments/${appointmentId}/send-email`, {
        template: 'request-document',
        customMessage: documentRequest.trim()
      })

      alert('Document request email sent to patient')
      setDocumentRequest('')
      await dispatch(getAppointment(appointmentId))

      if (activeTab === 'emailLogs') {
        const response = await api.get(`/api/appointments/${appointmentId}/email-logs`)
        setEmailLogs(response.data?.logs || [])
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to send document request email')
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

  const handleSavePatient = async () => {
    if (typeof currentAppointment?.patient_id !== 'object' || !currentAppointment.patient_id) {
      alert('Patient details not available')
      return
    }

    const patient = currentAppointment.patient_id as any
    const patientId = patient._id || patient.id

    if (!patientId) {
      alert('Patient ID not found')
      return
    }

    const payload: any = {}
    if (patientForm.firstName.trim()) payload.firstName = patientForm.firstName.trim()
    if (patientForm.lastName.trim()) payload.lastName = patientForm.lastName.trim()
    if (patientForm.phone.trim()) payload.phone = patientForm.phone.trim()
    if (patientForm.email.trim()) payload.email = patientForm.email.trim()
    if (patientForm.dateOfBirth) {
      const parsedDob = parseUsDate(patientForm.dateOfBirth)
      if (!parsedDob) {
        alert('Please enter Date of Birth in MM/DD/YYYY format.')
        return
      }
      payload.dateOfBirth = parsedDob.toISOString()
    }

    if (payload.firstName || payload.lastName) {
      payload.name = `${payload.firstName || patient.firstName || ''} ${payload.lastName || patient.lastName || ''}`.trim()
    }

    try {
      await api.put(`/api/users/${patientId}`, payload)
      await dispatch(getAppointment(appointmentId))
      setIsEditingPatient(false)
      setPatientSuccess('Patient profile updated successfully.')
      setTimeout(() => setPatientSuccess(null), 3000)
      alert('Patient profile updated')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update patient profile')
    }
  }

  const parseFlexibleDate = (value?: string) => {
    if (!value) return null
    const raw = String(value).trim()
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed

    const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (!match) return null
    const part1 = Number(match[1])
    const part2 = Number(match[2])
    const year = Number(match[3])
    const isDayFirst = part1 > 12
    const month = (isDayFirst ? part2 : part1) - 1
    const day = isDayFirst ? part1 : part2
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const formatUsDate = (value?: string) => {
    const date = parseFlexibleDate(value)
    if (!date) return ''
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  const parseUsDate = (value?: string) => {
    if (!value) return null
    const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!match) return null
    const month = Number(match[1])
    const day = Number(match[2])
    const year = Number(match[3])
    const date = new Date(year, month - 1, day)
    if (Number.isNaN(date.getTime())) return null
    return date
  }

  const formatIsoToInput = (value?: string) => {
    const date = parseFlexibleDate(value)
    if (!date) return ''
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const openDobPicker = () => {
    const picker = dobPickerRef.current as HTMLInputElement & { showPicker?: () => void }
    if (picker?.showPicker) {
      picker.showPicker()
    } else {
      picker?.focus()
      picker?.click()
    }
  }

  // Task Handlers
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newTask.title.trim()) {
      alert('Please enter a task title')
      return
    }

    try {
      const payload = {
        title: newTask.title,
        description: newTask.description || '',
        appointment: appointmentId,
        assignedTo: newTask.assignedTo || undefined,
        priority: newTask.priority || 'medium',
        status: 'pending'
      }

      await api.post('/api/tasks', payload)
      
      // Reset form
      setNewTask({
        title: '',
        description: '',
        assignedTo: '',
        priority: 'medium'
      })
      
      // Close modal and refresh tasks
      setShowCreateTaskModal(false)
      const response = await api.get('/api/tasks', {
        params: { appointment: appointmentId }
      })
      setTasks(response.data?.tasks || [])
      
      alert('Task created successfully')
    } catch (error: any) {
      console.error('Error creating task:', error)
      alert(error.response?.data?.message || 'Failed to create task')
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus })
      
      // Refresh task list
      const response = await api.get('/api/tasks', {
        params: { appointment: appointmentId }
      })
      setTasks(response.data?.tasks || [])
      
      alert(`Task marked as ${newStatus}`)
    } catch (error: any) {
      console.error('Error updating task:', error)
      alert(error.response?.data?.message || 'Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      await api.delete(`/api/tasks/${taskId}`)
      
      // Refresh task list
      const response = await api.get('/api/tasks', {
        params: { appointment: appointmentId }
      })
      setTasks(response.data?.tasks || [])
      
      alert('Task deleted successfully')
    } catch (error: any) {
      console.error('Error deleting task:', error)
      alert(error.response?.data?.message || 'Failed to delete task')
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
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold">Patient Information</h2>
                      {isEditingPatient && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Editing
                        </span>
                      )}
                    </div>
                    {!isEditingPatient ? (
                      <button
                        onClick={() => setIsEditingPatient(true)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Edit Profile
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditingPatient(false)}
                          className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSavePatient}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {patientSuccess && (
                    <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                      {patientSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm text-gray-600">First Name</label>
                      {isEditingPatient ? (
                        <input
                          type="text"
                          value={patientForm.firstName}
                          onChange={(e) => setPatientForm({ ...patientForm, firstName: e.target.value })}
                          className="input w-full"
                        />
                      ) : (
                        <p className="font-medium">
                          {typeof currentAppointment.patient_id === 'object'
                            ? currentAppointment.patient_id?.firstName || currentAppointment.patient_id?.name?.split(' ')[0] || 'N/A'
                            : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Last Name</label>
                      {isEditingPatient ? (
                        <input
                          type="text"
                          value={patientForm.lastName}
                          onChange={(e) => setPatientForm({ ...patientForm, lastName: e.target.value })}
                          className="input w-full"
                        />
                      ) : (
                        <p className="font-medium">
                          {typeof currentAppointment.patient_id === 'object'
                            ? currentAppointment.patient_id?.lastName || currentAppointment.patient_id?.name?.split(' ').slice(1).join(' ') || 'N/A'
                            : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Date of Birth</label>
                      {isEditingPatient ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={patientForm.dateOfBirth}
                            onChange={(e) => setPatientForm({ ...patientForm, dateOfBirth: e.target.value })}
                            placeholder="MM/DD/YYYY"
                            className="input w-full pr-10"
                          />
                          <button
                            type="button"
                            onClick={openDobPicker}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            aria-label="Open date picker"
                          >
                            📅
                          </button>
                          <input
                            ref={dobPickerRef}
                            type="date"
                            value={formatIsoToInput(patientForm.dateOfBirth)}
                            onChange={(e) => {
                              const picked = formatUsDate(e.target.value)
                              setPatientForm({ ...patientForm, dateOfBirth: picked })
                            }}
                            className="absolute inset-0 opacity-0 pointer-events-none"
                            tabIndex={-1}
                          />
                        </div>
                      ) : (
                        <p className="font-medium">
                          {typeof currentAppointment.patient_id === 'object' && currentAppointment.patient_id?.dateOfBirth
                            ? formatUsDate(currentAppointment.patient_id.dateOfBirth)
                            : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Email Address</label>
                      {isEditingPatient ? (
                        <input
                          type="email"
                          value={patientForm.email}
                          onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                          className="input w-full"
                        />
                      ) : (
                        <p className="font-medium">
                          {typeof currentAppointment.patient_id === 'object'
                            ? currentAppointment.patient_id?.email || 'N/A'
                            : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Phone Number</label>
                      {isEditingPatient ? (
                        <input
                          type="text"
                          value={patientForm.phone}
                          onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                          className="input w-full"
                        />
                      ) : (
                        <p className="font-medium">
                          {typeof currentAppointment.patient_id === 'object'
                            ? currentAppointment.patient_id?.phone || 'N/A'
                            : 'N/A'}
                        </p>
                      )}
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
                    {latestPendingDocumentRequest && (
                      <p className="mt-2 text-xs text-gray-500">
                        Latest request from doctor on{' '}
                        {latestPendingDocumentRequest.requestedAt
                          ? new Date(latestPendingDocumentRequest.requestedAt).toLocaleDateString('en-US')
                          : 'an unknown date'}.
                      </p>
                    )}
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
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Notes
                        <span className="ml-2 text-xs font-normal">
                          {notesSaveStatus === 'saving' && (
                            <span className="text-blue-600">💾 Saving...</span>
                          )}
                          {notesSaveStatus === 'saved' && (
                            <span className="text-green-600">✓ Saved</span>
                          )}
                          {notesSaveStatus.startsWith('error') && (
                            <span className="text-red-600">{notesSaveStatus}</span>
                          )}
                        </span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={6}
                        placeholder="Enter your notes here... (auto-saves as you type)"
                      />
                      <p className="mt-2 text-xs text-gray-500">💡 Notes auto-save automatically as you type</p>
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
                    <div>
                      <div className="mb-4 flex justify-between items-center">
                        <h3 className="text-md font-semibold text-gray-900">
                          {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                        </h3>
                        <button
                          onClick={() => setShowCreateTaskModal(true)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                        >
                          + Create Task
                        </button>
                      </div>

                      {tasksLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading tasks...</div>
                      ) : tasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No tasks available</div>
                      ) : (
                        <div className="space-y-3">
                          {/* Filter tasks: hide soft-deleted for assignee, show all for creator/admin */}
                          {tasks
                            .filter((task: any) => {
                              const currentUserId = getUserId(currentUser);
                              // If not assignedTo, show
                              if (!task.assignedTo) return true;
                              // If current user is creator, show
                              if (task.createdBy && getUserId(task.createdBy) === currentUserId) return true;
                              // If current user is admin, show
                              if (currentUser?.role_id === 1) return true;
                              // If current user is assignee, hide if deleted
                              if (task.assignedTo && getUserId(task.assignedTo) === currentUserId) {
                                return !task.deleted;
                              }
                              // Otherwise, show
                              return true;
                            })
                            .map((task: any) => (
                              <div key={task._id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{task.title}</h4>
                                  {task.description && (
                                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                                      task.status === 'completed'
                                        ? 'bg-green-100 text-green-800'
                                        : task.status === 'in_progress'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                  </span>
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                                      task.priority === 'high'
                                        ? 'bg-red-100 text-red-800'
                                        : task.priority === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                                <div className="space-x-3">
                                  {task.assignedTo && (
                                    <span>
                                      Assigned to:{' '}
                                      <span className="font-medium text-gray-900">
                                        {typeof task.assignedTo === 'object'
                                          ? task.assignedTo.name || task.assignedTo.email
                                          : task.assignedTo}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                {task.dueDate && (
                                  <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                )}
                              </div>

                              {task.status !== 'completed' && (
                                <div className="flex gap-2 pt-2 border-t">
                                  <button
                                    onClick={() => handleUpdateTaskStatus(task._id, 'in_progress')}
                                    className={`px-3 py-1 text-sm rounded ${
                                      task.status === 'in_progress'
                                        ? 'bg-blue-600 text-white'
                                        : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
                                    }`}
                                  >
                                    In Progress
                                  </button>
                                  <button
                                    onClick={() => handleUpdateTaskStatus(task._id, 'completed')}
                                    className="px-3 py-1 text-sm border border-green-600 text-green-600 rounded hover:bg-green-50"
                                  >
                                    Complete
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task._id)}
                                    className="px-3 py-1 text-sm border border-red-600 text-red-600 rounded hover:bg-red-50 ml-auto"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                              
                              {task.status === 'completed' && (
                                <div className="flex gap-2 pt-2 border-t">
                                  <button
                                    onClick={() => handleDeleteTask(task._id)}
                                    className="px-3 py-1 text-sm border border-red-600 text-red-600 rounded hover:bg-red-50 ml-auto"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Create Task Modal */}
                      {showCreateTaskModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">Create New Task</h3>
                              <button
                                onClick={() => setShowCreateTaskModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                              >
                                ✕
                              </button>
                            </div>

                            <form onSubmit={handleCreateTask} className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Task Title *
                                </label>
                                <input
                                  type="text"
                                  value={newTask.title}
                                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="Enter task title"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Description
                                </label>
                                <textarea
                                  value={newTask.description}
                                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="Enter task description"
                                  rows={3}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Priority
                                </label>
                                <select
                                  value={newTask.priority}
                                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Assign To
                                </label>
                                <select
                                  value={newTask.assignedTo}
                                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="">Select staff member...</option>
                                  {staffMembers.map((staff: any) => (
                                    <option key={staff._id} value={staff._id}>
                                      {staff.name || staff.email}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex gap-2 pt-4 border-t">
                                <button
                                  type="button"
                                  onClick={() => setShowCreateTaskModal(false)}
                                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                >
                                  Create Task
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
