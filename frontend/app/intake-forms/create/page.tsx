'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'
import type { IntakeFormTemplate, IntakeFormSection, IntakeFormField } from '@/types'
import {
  createIntakeFormTemplate,
  updateIntakeFormTemplate,
  getIntakeFormTemplate,
  clearError,
  clearSuccess
} from '@/store/slices/intakeFormTemplateSlice'
import { getAppointmentTypes } from '@/store/slices/appointmentTypeSlice'
import { getStates } from '@/store/slices/stateSlice'

export default function IntakeFormBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const isEditMode = !!params?.id

  const { currentTemplate, loading, error, success } = useSelector(
    (state: RootState) => state.intakeFormTemplates
  )
  const { appointmentTypes } = useSelector((state: RootState) => state.appointmentTypes)
  const { states } = useSelector((state: RootState) => state.states)

  const [formData, setFormData] = useState<Partial<IntakeFormTemplate>>({
    name: '',
    description: '',
    isActive: true,
    isDefault: false,
    appointmentTypes: [],
    states: [],
    sections: [],
    settings: {
      allowSaveProgress: true,
      showProgressBar: true,
      submitButtonText: 'Submit Intake Form',
      successMessage: 'Your intake form has been submitted successfully!',
      pdfHeaderText: 'Medical Intake Form',
      pdfFooterText: ''
    }
  })

  const [currentSection, setCurrentSection] = useState<IntakeFormSection | null>(null)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null)

  useEffect(() => {
    dispatch(getAppointmentTypes())
    dispatch(getStates({ isActive: true }))
    
    if (isEditMode && params.id) {
      dispatch(getIntakeFormTemplate(params.id as string))
    }
  }, [dispatch, isEditMode, params.id])

  useEffect(() => {
    if (isEditMode && currentTemplate) {
      setFormData(currentTemplate)
    }
  }, [currentTemplate, isEditMode])

  useEffect(() => {
    if (success) {
      setTimeout(() => {
        dispatch(clearSuccess())
        router.push('/intake-forms')
      }, 2000)
    }
  }, [success, dispatch, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.sections || formData.sections.length === 0) {
      alert('Please provide a template name and at least one section')
      return
    }

    if (isEditMode && params.id) {
      await dispatch(updateIntakeFormTemplate({ id: params.id as string, data: formData }))
    } else {
      await dispatch(createIntakeFormTemplate(formData))
    }
  }

  const addSection = () => {
    const newSection: IntakeFormSection = {
      sectionId: `section-${Date.now()}`,
      title: '',
      description: '',
      order: formData.sections?.length || 0,
      fields: []
    }
    setCurrentSection(newSection)
    setEditingSectionIndex(null)
    setShowSectionModal(true)
  }

  const editSection = (index: number) => {
    setCurrentSection(formData.sections![index])
    setEditingSectionIndex(index)
    setShowSectionModal(true)
  }

  const deleteSection = (index: number) => {
    if (confirm('Delete this section and all its fields?')) {
      const newSections = formData.sections!.filter((_, i) => i !== index)
      setFormData({ ...formData, sections: newSections })
    }
  }

  const saveSection = (section: IntakeFormSection) => {
    let newSections = [...(formData.sections || [])]
    
    if (editingSectionIndex !== null) {
      newSections[editingSectionIndex] = section
    } else {
      newSections.push(section)
    }
    
    setFormData({ ...formData, sections: newSections })
    setShowSectionModal(false)
    setCurrentSection(null)
    setEditingSectionIndex(null)
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...formData.sections!]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newSections.length) return
    
    ;[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]
    
    // Update order
    newSections.forEach((section, i) => {
      section.order = i
    })
    
    setFormData({ ...formData, sections: newSections })
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Templates
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? 'Edit' : 'Create'} Intake Form Template
          </h1>
          <p className="text-gray-600 mt-2">Build custom intake forms with drag-and-drop fields</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            Template saved successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Template Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                />
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Set as Default Template</span>
                </label>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Template Assignment (Optional)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Leave empty to use for all appointment types and states
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Appointment Types</label>
                <select
                  multiple
                  value={formData.appointmentTypes as string[]}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    setFormData({ ...formData, appointmentTypes: selected })
                  }}
                  className="input w-full h-32"
                >
                  {appointmentTypes.map((type) => (
                    <option key={type._id} value={type._id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">States</label>
                <select
                  multiple
                  value={formData.states as string[]}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    setFormData({ ...formData, states: selected })
                  }}
                  className="input w-full h-32"
                >
                  {states.map((state) => (
                    <option key={state._id} value={state._id}>
                      {state.name} ({state.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
            </div>
          </div>

          {/* Form Sections */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Form Sections *</h2>
              <button
                type="button"
                onClick={addSection}
                className="btn-primary"
              >
                + Add Section
              </button>
            </div>

            {formData.sections && formData.sections.length > 0 ? (
              <div className="space-y-4">
                {formData.sections.map((section, index) => (
                  <div key={section.sectionId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{section.title}</h3>
                        {section.description && (
                          <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-2">
                          {section.fields.length} field(s)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => moveSection(index, 'up')}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                            title="Move up"
                          >
                            ↑
                          </button>
                        )}
                        {index < formData.sections!.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveSection(index, 'down')}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                            title="Move down"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => editSection(index)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSection(index)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-600 mb-4">No sections added yet</p>
                <button
                  type="button"
                  onClick={addSection}
                  className="btn-primary"
                >
                  Add Your First Section
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Form Settings</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.settings?.allowSaveProgress}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings!, allowSaveProgress: e.target.checked }
                      })}
                    />
                    <span className="text-sm font-medium">Allow Save Progress (Draft)</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.settings?.showProgressBar}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings!, showProgressBar: e.target.checked }
                      })}
                    />
                    <span className="text-sm font-medium">Show Progress Bar</span>
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Submit Button Text</label>
                  <input
                    type="text"
                    value={formData.settings?.submitButtonText}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings!, submitButtonText: e.target.value }
                    })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Success Message</label>
                  <input
                    type="text"
                    value={formData.settings?.successMessage}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings!, successMessage: e.target.value }
                    })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">PDF Header Text</label>
                  <input
                    type="text"
                    value={formData.settings?.pdfHeaderText}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings!, pdfHeaderText: e.target.value }
                    })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">PDF Footer Text</label>
                  <input
                    type="text"
                    value={formData.settings?.pdfFooterText || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings!, pdfFooterText: e.target.value }
                    })}
                    className="input w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-8"
            >
              {loading ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>

        {/* Section Builder Modal */}
        {showSectionModal && currentSection && (
          <SectionBuilderModal
            section={currentSection}
            onSave={saveSection}
            onClose={() => {
              setShowSectionModal(false)
              setCurrentSection(null)
              setEditingSectionIndex(null)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

// Section Builder Modal Component
function SectionBuilderModal({
  section,
  onSave,
  onClose
}: {
  section: IntakeFormSection
  onSave: (section: IntakeFormSection) => void
  onClose: () => void
}) {
  const [sectionData, setSectionData] = useState<IntakeFormSection>(section)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [currentField, setCurrentField] = useState<IntakeFormField | null>(null)
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null)

  const addField = () => {
    const newField: IntakeFormField = {
      fieldId: `field-${Date.now()}`,
      fieldType: 'text',
      label: '',
      required: false,
      order: sectionData.fields.length
    }
    setCurrentField(newField)
    setEditingFieldIndex(null)
    setShowFieldModal(true)
  }

  const editField = (index: number) => {
    setCurrentField(sectionData.fields[index])
    setEditingFieldIndex(index)
    setShowFieldModal(true)
  }

  const deleteField = (index: number) => {
    const newFields = sectionData.fields.filter((_, i) => i !== index)
    setSectionData({ ...sectionData, fields: newFields })
  }

  const saveField = (field: IntakeFormField) => {
    let newFields = [...sectionData.fields]
    
    if (editingFieldIndex !== null) {
      newFields[editingFieldIndex] = field
    } else {
      newFields.push(field)
    }
    
    setSectionData({ ...sectionData, fields: newFields })
    setShowFieldModal(false)
    setCurrentField(null)
    setEditingFieldIndex(null)
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...sectionData.fields]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newFields.length) return
    
    ;[newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]]
    
    // Update order
    newFields.forEach((field, i) => {
      field.order = i
    })
    
    setSectionData({ ...sectionData, fields: newFields })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <h2 className="text-2xl font-bold">Edit Section</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Section Title *</label>
            <input
              type="text"
              value={sectionData.title}
              onChange={(e) => setSectionData({ ...sectionData, title: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Section Description</label>
            <textarea
              value={sectionData.description}
              onChange={(e) => setSectionData({ ...sectionData, description: e.target.value })}
              className="input w-full"
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fields</h3>
              <button
                type="button"
                onClick={addField}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add Field
              </button>
            </div>

            {sectionData.fields.length > 0 ? (
              <div className="space-y-3">
                {sectionData.fields.map((field, index) => (
                  <div key={field.fieldId} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.label}</span>
                          {field.required && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Type: {field.fieldType}</p>
                      </div>
                      <div className="flex gap-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => moveField(index, 'up')}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                          >
                            ↑
                          </button>
                        )}
                        {index < sectionData.fields.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveField(index, 'down')}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => editField(index)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteField(index)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-600 mb-3">No fields added yet</p>
                <button
                  type="button"
                  onClick={addField}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Field
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!sectionData.title) {
                alert('Section title is required')
                return
              }
              onSave(sectionData)
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Section
          </button>
        </div>

        {/* Field Builder Modal */}
        {showFieldModal && currentField && (
          <FieldBuilderModal
            field={currentField}
            onSave={saveField}
            onClose={() => {
              setShowFieldModal(false)
              setCurrentField(null)
              setEditingFieldIndex(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// Field Builder Modal Component
function FieldBuilderModal({
  field,
  onSave,
  onClose
}: {
  field: IntakeFormField
  onSave: (field: IntakeFormField) => void
  onClose: () => void
}) {
  const [fieldData, setFieldData] = useState<IntakeFormField>(field)

  const fieldTypes = [
    { value: 'text', label: 'Text Input' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'date', label: 'Date' },
    { value: 'checkbox', label: 'Checkbox (Yes/No)' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'select', label: 'Dropdown Select' },
    { value: 'multiselect', label: 'Multi-Select' },
    { value: 'checkboxGroup', label: 'Checkbox Group' },
    { value: 'file', label: 'File Upload' },
  ]

  const needsOptions = ['radio', 'select', 'multiselect', 'checkboxGroup'].includes(fieldData.fieldType)

  const addOption = () => {
    const newOptions = [...(fieldData.options || []), { value: '', label: '' }]
    setFieldData({ ...fieldData, options: newOptions })
  }

  const updateOption = (index: number, key: 'value' | 'label', value: string) => {
    const newOptions = [...(fieldData.options || [])]
    newOptions[index] = { ...newOptions[index], [key]: value }
    setFieldData({ ...fieldData, options: newOptions })
  }

  const removeOption = (index: number) => {
    const newOptions = fieldData.options?.filter((_, i) => i !== index) || []
    setFieldData({ ...fieldData, options: newOptions })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <h3 className="text-xl font-bold">Edit Field</h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Field Label *</label>
              <input
                type="text"
                value={fieldData.label}
                onChange={(e) => setFieldData({ ...fieldData, label: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Field Type *</label>
              <select
                value={fieldData.fieldType}
                onChange={(e) => setFieldData({ ...fieldData, fieldType: e.target.value as any })}
                className="input w-full"
              >
                {fieldTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Placeholder</label>
            <input
              type="text"
              value={fieldData.placeholder || ''}
              onChange={(e) => setFieldData({ ...fieldData, placeholder: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Help Text</label>
            <input
              type="text"
              value={fieldData.helpText || ''}
              onChange={(e) => setFieldData({ ...fieldData, helpText: e.target.value })}
              className="input w-full"
              placeholder="Additional guidance for users"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={fieldData.required}
                onChange={(e) => setFieldData({ ...fieldData, required: e.target.checked })}
              />
              <span className="text-sm font-medium">Required Field</span>
            </label>
          </div>

          {/* Options for select/radio/checkbox groups */}
          {needsOptions && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium">Options</label>
                <button
                  type="button"
                  onClick={addOption}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  + Add Option
                </button>
              </div>
              
              <div className="space-y-2">
                {fieldData.options?.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option.value}
                      onChange={(e) => updateOption(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="input flex-1"
                    />
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => updateOption(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                )) || <p className="text-sm text-gray-500">No options added</p>}
              </div>
            </div>
          )}

          {/* Validation Rules */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Validation Rules (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              {(fieldData.fieldType === 'text' || fieldData.fieldType === 'textarea') && (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Min Length</label>
                    <input
                      type="number"
                      value={fieldData.validation?.minLength || ''}
                      onChange={(e) => setFieldData({
                        ...fieldData,
                        validation: { ...fieldData.validation, minLength: parseInt(e.target.value) || undefined }
                      })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Length</label>
                    <input
                      type="number"
                      value={fieldData.validation?.maxLength || ''}
                      onChange={(e) => setFieldData({
                        ...fieldData,
                        validation: { ...fieldData.validation, maxLength: parseInt(e.target.value) || undefined }
                      })}
                      className="input w-full"
                    />
                  </div>
                </>
              )}

              {fieldData.fieldType === 'number' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Min Value</label>
                    <input
                      type="number"
                      value={fieldData.validation?.min || ''}
                      onChange={(e) => setFieldData({
                        ...fieldData,
                        validation: { ...fieldData.validation, min: parseInt(e.target.value) || undefined }
                      })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Value</label>
                    <input
                      type="number"
                      value={fieldData.validation?.max || ''}
                      onChange={(e) => setFieldData({
                        ...fieldData,
                        validation: { ...fieldData.validation, max: parseInt(e.target.value) || undefined }
                      })}
                      className="input w-full"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!fieldData.label) {
                alert('Field label is required')
                return
              }
              if (needsOptions && (!fieldData.options || fieldData.options.length === 0)) {
                alert('Please add at least one option')
                return
              }
              onSave(fieldData)
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Field
          </button>
        </div>
      </div>
    </div>
  )
}
