'use client'

import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import api from '@/lib/api'
import type { RootState } from '@/store/store'
import type { User } from '@/types'

export default function PatientsPage() {
  const router = useRouter()
  const { user } = useSelector((state: RootState) => state.auth)
  const [patients, setPatients] = useState<User[]>([])
  const [filteredPatients, setFilteredPatients] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all')
  const [minorFilter, setMinorFilter] = useState<'all' | 'minor' | 'adult'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    if (user && user.role_id !== 1 && user.role_id !== 4) {
      router.push('/dashboard')
    } else {
      fetchPatients()
    }
  }, [user])

  useEffect(() => {
    filterPatients()
  }, [patients, searchTerm, statusFilter, minorFilter])

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/users?role=patient')
      setPatients(response.data.users || [])
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterPatients = () => {
    let filtered = [...patients]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.includes(searchTerm) ||
        p.prn?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    // Minor filter
    if (minorFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (minorFilter === 'minor') return p.isMinor === true
        if (minorFilter === 'adult') return !p.isMinor
        return true
      })
    }

    setFilteredPatients(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const viewPatientDetails = (patient: User) => {
    setSelectedPatient(patient)
    setShowDetailsModal(true)
  }

  const exportToCSV = () => {
    const headers = ['PRN', 'Name', 'Email', 'Phone', 'State', 'Status', 'Minor', 'Registration Date']
    const rows = filteredPatients.map(p => [
      p.prn || '',
      p.name || '',
      p.email || '',
      p.phone || '',
      p.state || '',
      p.status || 'active',
      p.isMinor ? 'Yes' : 'No',
      new Date(p.createdAt || '').toLocaleDateString()
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `patients-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentPatients = filteredPatients.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Patient Database & Records</h1>
            <p className="text-gray-600 mt-1">Manage and view all registered patients</p>
          </div>
          <button
            onClick={exportToCSV}
            className="btn-primary"
          >
            📥 Export to CSV
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="text-sm text-gray-600">Total Patients</div>
            <div className="text-2xl font-bold">{patients.length}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {patients.filter(p => p.status === 'active').length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Minors</div>
            <div className="text-2xl font-bold text-blue-600">
              {patients.filter(p => p.isMinor).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Inactive</div>
            <div className="text-2xl font-bold text-gray-600">
              {patients.filter(p => p.status === 'inactive').length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Name, email, phone, PRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="input-field"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age Group
              </label>
              <select
                value={minorFilter}
                onChange={(e) => setMinorFilter(e.target.value as any)}
                className="input-field"
              >
                <option value="all">All Ages</option>
                <option value="adult">Adults</option>
                <option value="minor">Minors</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setMinorFilter('all')
                }}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Patients Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PRN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
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
                {currentPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No patients found
                    </td>
                  </tr>
                ) : (
                  currentPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {patient.prn || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {patient.name}
                            </div>
                            {patient.isMinor && (
                              <div className="text-xs text-blue-600">Minor</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.state || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          patient.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : patient.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {patient.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => viewPatientDetails(patient)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => router.push(`/appointments?patient=${patient.id}`)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Appointments
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, filteredPatients.length)}</span> of{' '}
              <span className="font-medium">{filteredPatients.length}</span> patients
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  if (totalPages <= 7) return true
                  if (page === 1 || page === totalPages) return true
                  if (page >= currentPage - 1 && page <= currentPage + 1) return true
                  return false
                })
                .map((page, index, array) => (
                  <>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span key={`ellipsis-${page}`} className="px-2">...</span>
                    )}
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 border rounded ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  </>
                ))
              }
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Patient Details Modal */}
        {showDetailsModal && selectedPatient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">Patient Details</h2>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">PRN</label>
                      <div className="font-medium">{selectedPatient.prn || 'Not assigned'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Status</label>
                      <div>
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          selectedPatient.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedPatient.status || 'active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Full Name</label>
                    <div className="font-medium">{selectedPatient.name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">Email</label>
                      <div className="font-medium">{selectedPatient.email}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Phone</label>
                      <div className="font-medium">{selectedPatient.phone}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">State</label>
                      <div className="font-medium">{selectedPatient.state || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Date of Birth</label>
                      <div className="font-medium">
                        {selectedPatient.dateOfBirth 
                          ? new Date(selectedPatient.dateOfBirth).toLocaleDateString()
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>

                  {selectedPatient.address && (
                    <div>
                      <label className="text-sm text-gray-600">Address</label>
                      <div className="font-medium">{selectedPatient.address}</div>
                    </div>
                  )}

                  {selectedPatient.isMinor && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3 text-blue-600">Guardian Information</h3>
                      <div className="space-y-2">
                        {selectedPatient.guardianName && (
                          <div>
                            <label className="text-sm text-gray-600">Guardian Name</label>
                            <div className="font-medium">{selectedPatient.guardianName}</div>
                          </div>
                        )}
                        {selectedPatient.guardianPhone && (
                          <div>
                            <label className="text-sm text-gray-600">Guardian Phone</label>
                            <div className="font-medium">{selectedPatient.guardianPhone}</div>
                          </div>
                        )}
                        {selectedPatient.guardianAddress && (
                          <div>
                            <label className="text-sm text-gray-600">Guardian Address</label>
                            <div className="font-medium">{selectedPatient.guardianAddress}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Registration Date</label>
                        <div className="font-medium">
                          {selectedPatient.createdAt 
                            ? new Date(selectedPatient.createdAt).toLocaleDateString()
                            : 'N/A'
                          }
                        </div>
                      </div>
                      {selectedPatient.emergencyContact && (
                        <div>
                          <label className="text-sm text-gray-600">Emergency Contact</label>
                          <div className="font-medium">{selectedPatient.emergencyContact}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      router.push(`/appointments?patient=${selectedPatient.id}`)
                    }}
                    className="btn-primary flex-1"
                  >
                    View Appointments
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
