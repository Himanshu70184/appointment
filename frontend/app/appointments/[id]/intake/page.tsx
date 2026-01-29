'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'
import type { IntakeFormField, IntakeFormSubmissionField } from '@/types'
import { getActiveIntakeFormTemplate } from '@/store/slices/intakeFormTemplateSlice'
import { submitIntakeForm, clearError, clearSuccess } from '@/store/slices/intakeFormSubmissionSlice'
import { getAppointment } from '@/store/slices/appointmentSlice'

export default function IntakeFormPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const appointmentId = params.id as string

  const { activeTemplate, loading: templateLoading } = useSelector(
    (state: RootState) => state.intakeFormTemplates
  )
  const { loading, error, success, message } = useSelector(
    (state: RootState) => state.intakeFormSubmissions
  )
  const { currentAppointment } = useSelector((state: RootState) => state.appointments)

  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [fileInputs, setFileInputs] = useState<Record<string, File[]>>({})
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (appointmentId) {
      dispatch(getAppointment(appointmentId))
    }
  }, [appointmentId, dispatch])

  useEffect(() => {
    if (currentAppointment) {
      dispatch(getActiveIntakeFormTemplate({
        appointmentType: currentAppointment.appointmentType?._id,
        state: currentAppointment.state
      }))
    }
  }, [currentAppointment, dispatch])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        dispatch(clearSuccess())
        router.push(`/appointments/${appointmentId}`)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [success, router, appointmentId, dispatch])

  useEffect(() => {
    return () => {
      dispatch(clearError())
      dispatch(clearSuccess())
    }
  }, [dispatch])

  const validateField = (field: IntakeFormField, value: any): string | null => {
    if (field.required && (!value || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required`
    }

    if (field.validation) {
      const val = field.validation

      if (val.minLength && value?.length < val.minLength) {
        return `Minimum length is ${val.minLength} characters`
      }

      if (val.maxLength && value?.length > val.maxLength) {
        return `Maximum length is ${val.maxLength} characters`
      }

      if (val.min !== undefined && value < val.min) {
        return `Minimum value is ${val.min}`
      }

      if (val.max !== undefined && value > val.max) {
        return `Maximum value is ${val.max}`
      }

      if (val.pattern && !new RegExp(val.pattern).test(value)) {
        return val.errorMessage || 'Invalid format'
      }
    }

    return null
  }

  const handleInputChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }

  const handleFileChange = (fieldId: string, files: FileList | null) => {
    if (files) {
      setFileInputs(prev => ({ ...prev, [fieldId]: Array.from(files) }))
      if (errors[fieldId]) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[fieldId]
          return newErrors
        })
      }
    }
  }

  const validateCurrentSection = (): boolean => {
    if (!activeTemplate) return false

    const currentSection = activeTemplate.sections[currentSectionIndex]
    const newErrors: Record<string, string> = {}

    currentSection.fields.forEach(field => {
      if (field.conditionalLogic?.enabled && field.conditionalLogic.dependsOn) {
        const dependentValue = formValues[field.conditionalLogic.dependsOn]
        if (field.conditionalLogic.condition === 'equals' && dependentValue !== field.conditionalLogic.value) {
          return
        }
      }

      const value = field.fieldType === 'file'
        ? fileInputs[field.fieldId]
        : formValues[field.fieldId]

      const error = validateField(field, value)
      if (error) {
        newErrors[field.fieldId] = error
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextSection = () => {
    if (validateCurrentSection()) {
      if (activeTemplate && currentSectionIndex < activeTemplate.sections.length - 1) {
        setCurrentSectionIndex(prev => prev + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const goToPreviousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmit = async (saveAsDraft: boolean = false) => {
    if (!saveAsDraft && !validateCurrentSection()) {
      return
    }

    if (!activeTemplate || !appointmentId) return

    const formData = new FormData()
    formData.append('appointment_id', appointmentId)
    formData.append('template_id', activeTemplate._id)
    formData.append('saveAsDraft', saveAsDraft.toString())

    const submissionData: IntakeFormSubmissionField[] = []

    activeTemplate.sections.forEach(section => {
      section.fields.forEach(field => {
        const value = formValues[field.fieldId]

        submissionData.push({
          fieldId: field.fieldId,
          fieldType: field.fieldType,
          label: field.label,
          value: value || null
        })

        if (field.fieldType === 'file' && fileInputs[field.fieldId]) {
          fileInputs[field.fieldId].forEach(file => {
            formData.append(field.fieldId, file)
          })
        }
      })
    })

    formData.append('formData', JSON.stringify(submissionData))

    await dispatch(submitIntakeForm({ formData, saveAsDraft }))
  }

  const renderField = (field: IntakeFormField) => {
    if (field.conditionalLogic?.enabled && field.conditionalLogic.dependsOn) {
      const dependentValue = formValues[field.conditionalLogic.dependsOn]
      if (field.conditionalLogic.condition === 'equals' && dependentValue !== field.conditionalLogic.value) {
        return null
      }
    }

    const value = formValues[field.fieldId] || ''
    const error = errors[field.fieldId]
    const commonClasses = `input w-full ${error ? 'border-red-500' : ''}`

    return (
      <div key={field.fieldId} className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {field.helpText && (
          <p className="text-sm text-gray-600 mb-2">{field.helpText}</p>
        )}

        {field.fieldType === 'text' && (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        )}

        {field.fieldType === 'textarea' && (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={commonClasses}
          />
        )}

        {field.fieldType === 'number' && (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            className={commonClasses}
          />
        )}

        {field.fieldType === 'email' && (
          <input
            type="email"
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        )}

        {field.fieldType === 'phone' && (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        )}

        {field.fieldType === 'date' && (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            className={commonClasses}
          />
        )}

        {field.fieldType === 'checkbox' && (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleInputChange(field.fieldId, e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Yes</span>
          </label>
        )}

        {field.fieldType === 'radio' && field.options && (
          <div className="space-y-2">
            {field.options.map(option => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={field.fieldId}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        )}

        {field.fieldType === 'select' && field.options && (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.fieldId, e.target.value)}
            className={commonClasses}
          >
            <option value="">-- Select --</option>
            {field.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {field.fieldType === 'multiselect' && field.options && (
          <select
            multiple
            value={Array.isArray(value) ? value : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, opt => opt.value)
              handleInputChange(field.fieldId, selected)
            }}
            className={`${commonClasses} h-32`}
          >
            {field.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {field.fieldType === 'checkboxGroup' && field.options && (
          <div className="space-y-2">
            {field.options.map(option => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : []
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value)
                    handleInputChange(field.fieldId, newValues)
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        )}

        {field.fieldType === 'file' && (
          <div>
            <input
              type="file"
              onChange={(e) => handleFileChange(field.fieldId, e.target.files)}
              className={commonClasses}
              accept="image/*,application/pdf,.doc,.docx"
              multiple
            />
            {fileInputs[field.fieldId] && fileInputs[field.fieldId].length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {fileInputs[field.fieldId].length} file(s) selected
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-1">{error}</p>
        )}
      </div>
    )
  }

  if (templateLoading || !activeTemplate) {
    return (
      <DashboardLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading intake form...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const currentSection = activeTemplate.sections[currentSectionIndex]
  const progress = ((currentSectionIndex + 1) / activeTemplate.sections.length) * 100
  const isLastSection = currentSectionIndex === activeTemplate.sections.length - 1

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="card">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{activeTemplate.settings.pdfHeaderText}</h1>
            <p className="text-gray-600 mt-2">Please complete the following information</p>
          </div>

          {activeTemplate.settings.showProgressBar && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Section {currentSectionIndex + 1} of {activeTemplate.sections.length}</span>
                <span>{Math.round(progress)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {message || activeTemplate.settings.successMessage}
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{currentSection.title}</h2>
            {currentSection.description && (
              <p className="text-gray-600 mb-6">{currentSection.description}</p>
            )}

            <div className="space-y-4">
              {currentSection.fields.map(field => renderField(field))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t">
            <button
              type="button"
              onClick={goToPreviousSection}
              disabled={currentSectionIndex === 0}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            <div className="flex gap-3">
              {activeTemplate.settings.allowSaveProgress && !isLastSection && (
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Save Draft
                </button>
              )}

              {isLastSection ? (
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="btn-primary px-8"
                >
                  {loading ? 'Submitting...' : activeTemplate.settings.submitButtonText}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goToNextSection}
                  className="btn-primary px-6"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
