'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { getAppointment, clearCurrentAppointment } from '@/store/slices/appointmentSlice'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'

export default function AppointmentDetailPage() {
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const appointmentId = params.id as string
  const { currentAppointment, loading } = useSelector((state: RootState) => state.appointments)
  const [activeTab, setActiveTab] = useState<'items' | 'tasks' | 'notes'>('notes')
  const [notes, setNotes] = useState('')
  const [documentRequest, setDocumentRequest] = useState('')

  useEffect(() => {
    if (appointmentId) {
      dispatch(getAppointment(appointmentId))
    }
    
    // Cleanup when component unmounts
    return () => {
      dispatch(clearCurrentAppointment())
    }
  }, [appointmentId, dispatch])

  const handleSendDocumentRequest = () => {
    // TODO: Implement document request functionality
    console.log('Requesting document:', documentRequest)
    alert('Document request sent to patient')
    setDocumentRequest('')
  }

  const handleSaveNotes = () => {
    // TODO: Implement save notes functionality
    console.log('Saving notes:', notes)
    alert('Notes saved successfully')
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
              <button className="btn-primary">Send Email</button>
              <button className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
                View Intake Form
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                Download Document
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Patient Info & Notes */}
              <div className="lg:col-span-2 space-y-6">
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
                          : '01-01-2000'}
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
                        onClick={() => setActiveTab('items')}
                        className={`pb-2 px-1 ${
                          activeTab === 'items'
                            ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Items
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

                  {activeTab === 'items' && (
                    <div className="text-gray-500 text-center py-8">
                      No items available
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
                      <label className="text-sm text-gray-600">Appointment Date & Time</label>
                      <p className="font-medium">
                        {currentAppointment.scheduledDate 
                          ? new Date(currentAppointment.scheduledDate).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
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
                    <button className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
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
