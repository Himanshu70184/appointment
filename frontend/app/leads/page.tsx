'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import { getLeads, updateLead, convertLead, deleteLead } from '@/store/slices/leadSlice'
import type { AppDispatch, RootState } from '@/store/store'

export default function LeadsPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth)
  const { leads, loading, success, error } = useSelector((state: RootState) => state.leads)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    if (user && (user.role_id === 1 || user.role_id === 4)) {
      dispatch(getLeads())
    } else {
      router.push('/dashboard')
    }
  }, [isAuthenticated, user, router, dispatch])

  const handleUpdateStatus = async () => {
    if (!selectedLead || !newStatus) return

    try {
      await dispatch(updateLead({ id: selectedLead._id, data: { status: newStatus } })).unwrap()
      setShowStatusModal(false)
      setSelectedLead(null)
      dispatch(getLeads())
    } catch (err) {
      console.error('Update status failed:', err)
    }
  }

  const handleConvertLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to convert this lead to a patient?')) return

    try {
      await dispatch(convertLead(leadId)).unwrap()
      dispatch(getLeads())
      alert('Lead converted successfully! A patient account has been created.')
    } catch (err: any) {
      alert(err.message || 'Failed to convert lead')
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return

    try {
      await dispatch(deleteLead(leadId)).unwrap()
      dispatch(getLeads())
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'contacted': return 'bg-green-100 text-green-800'
      case 'follow-up-required': return 'bg-yellow-100 text-yellow-800'
      case 'converted': return 'bg-purple-100 text-purple-800'
      case 'not-interested': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Leads Management</h1>
        <p className="text-gray-600 mt-2">Track and convert potential patients</p>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-center py-12">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No leads found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead: any) => (
                  <tr key={lead._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {lead.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.state}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="capitalize">{lead.leadFrom}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                        {lead.status.replace(/-/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedLead(lead)
                            setNewStatus(lead.status)
                            setShowStatusModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Update
                        </button>
                        {lead.status !== 'converted' && (
                          <button
                            onClick={() => handleConvertLead(lead._id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Convert
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteLead(lead._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status Update Modal */}
      {showStatusModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Update Lead Status</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status for {selectedLead.name}
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="input-field"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="follow-up-required">Follow-up Required</option>
                <option value="converted">Converted</option>
                <option value="not-interested">Not Interested</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowStatusModal(false)
                  setSelectedLead(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                className="btn-primary"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
