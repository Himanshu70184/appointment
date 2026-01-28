'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'
import {
  getIntakeFormTemplates,
  deleteIntakeFormTemplate,
  duplicateIntakeFormTemplate,
  setDefaultIntakeFormTemplate,
  clearError,
  clearSuccess
} from '@/store/slices/intakeFormTemplateSlice'

export default function IntakeFormTemplatesPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { templates, loading, error, success, message } = useSelector(
    (state: RootState) => state.intakeFormTemplates
  )
  const [filterActive, setFilterActive] = useState<string>('all')

  useEffect(() => {
    dispatch(getIntakeFormTemplates())
  }, [dispatch])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => dispatch(clearSuccess()), 3000)
      return () => clearTimeout(timer)
    }
  }, [success, dispatch])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await dispatch(deleteIntakeFormTemplate(id))
      dispatch(getIntakeFormTemplates())
    }
  }

  const handleDuplicate = async (id: string) => {
    await dispatch(duplicateIntakeFormTemplate(id))
    dispatch(getIntakeFormTemplates())
  }

  const handleSetDefault = async (id: string) => {
    await dispatch(setDefaultIntakeFormTemplate(id))
    dispatch(getIntakeFormTemplates())
  }

  const filteredTemplates = templates.filter(template => {
    if (filterActive === 'active') return template.isActive
    if (filterActive === 'inactive') return !template.isActive
    return true
  })

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Intake Form Templates</h1>
            <p className="text-gray-600 mt-2">Create and manage custom intake forms for patient appointments</p>
          </div>
          <button
            onClick={() => router.push('/intake-forms/create')}
            className="btn-primary"
          >
            + Create New Template
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {message}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setFilterActive('all')}
            className={`px-4 py-2 rounded-lg ${
              filterActive === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Templates ({templates.length})
          </button>
          <button
            onClick={() => setFilterActive('active')}
            className={`px-4 py-2 rounded-lg ${
              filterActive === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active ({templates.filter(t => t.isActive).length})
          </button>
          <button
            onClick={() => setFilterActive('inactive')}
            className={`px-4 py-2 rounded-lg ${
              filterActive === 'inactive'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Inactive ({templates.filter(t => !t.isActive).length})
          </button>
        </div>

        {/* Templates Grid */}
        {loading && templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No intake form templates found.</p>
            <button
              onClick={() => router.push('/intake-forms/create')}
              className="mt-4 btn-primary"
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div key={template._id} className="card hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    )}
                  </div>
                  {template.isDefault && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      DEFAULT
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        template.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Sections:</span>
                    <span className="font-semibold">{template.sections.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Fields:</span>
                    <span className="font-semibold">
                      {template.sections.reduce((acc, section) => acc + section.fields.length, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Version:</span>
                    <span className="font-semibold">v{template.version}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <button
                    onClick={() => router.push(`/intake-forms/edit/${template._id}`)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Template
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDuplicate(template._id)}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
                    >
                      Duplicate
                    </button>
                    {!template.isDefault && (
                      <button
                        onClick={() => handleSetDefault(template._id)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleDelete(template._id)}
                      className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
