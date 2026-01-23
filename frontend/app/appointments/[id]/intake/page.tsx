'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useDispatch, useSelector } from 'react-redux'
import { submitIntakeForm, getAppointment } from '@/store/slices/appointmentSlice'
import DashboardLayout from '@/components/DashboardLayout'
import type { AppDispatch, RootState } from '@/store/store'

export default function IntakeFormPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const appointmentId = params.id as string
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState({
    idDocument: null as File | null,
    medicalRecords: [] as File[],
    guardianId: null as File | null,
  })

  const { register, handleSubmit, formState: { errors }, watch } = useForm()

  const dateOfBirth = watch('dateOfBirth')
  const isUnder21 = dateOfBirth
    ? new Date().getFullYear() - new Date(dateOfBirth).getFullYear() < 21
    : false

  useEffect(() => {
    dispatch(getAppointment(appointmentId))
  }, [appointmentId, dispatch])

  const handleFileChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (field === 'medicalRecords') {
      if (e.target.files) {
        setFiles((prev) => ({
          ...prev,
          medicalRecords: Array.from(e.target.files || []),
        }))
      }
    } else {
      setFiles((prev) => ({
        ...prev,
        [field]: e.target.files?.[0] || null,
      }))
    }
  }

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('intakeForm', JSON.stringify(data))

      if (files.idDocument) {
        formData.append('idDocument', files.idDocument)
      }
      if (files.medicalRecords.length > 0) {
        files.medicalRecords.forEach((file) => {
          formData.append('medicalRecords', file)
        })
      }
      if (files.guardianId && isUnder21) {
        formData.append('guardianId', files.guardianId)
      }

      await dispatch(submitIntakeForm({ id: appointmentId, formData })).unwrap()
      router.push(`/appointments/${appointmentId}`)
    } catch (error: any) {
      alert(error.message || 'Failed to submit intake form')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Medical Intake Form</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth *
                </label>
                <input
                  {...register('dateOfBirth', { required: 'Date of birth is required' })}
                  type="date"
                  className="input-field"
                />
                {errors.dateOfBirth && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.dateOfBirth.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isUnder21 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Guardian Information (Required for patients under 21)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Name *
                  </label>
                  <input
                    {...register('guardianName', {
                      required: isUnder21 ? 'Guardian name is required' : false,
                    })}
                    type="text"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Email *
                  </label>
                  <input
                    {...register('guardianEmail', {
                      required: isUnder21 ? 'Guardian email is required' : false,
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    type="email"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Phone *
                  </label>
                  <input
                    {...register('guardianPhone', {
                      required: isUnder21 ? 'Guardian phone is required' : false,
                    })}
                    type="tel"
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold mb-4">Medical History</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Conditions
              </label>
              <textarea
                {...register('medicalConditions')}
                rows={4}
                className="input-field"
                placeholder="List any medical conditions..."
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Medications
              </label>
              <textarea
                {...register('currentMedications')}
                rows={4}
                className="input-field"
                placeholder="List current medications..."
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Required Documents</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Government ID (Driver's License, Passport, etc.) *
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileChange('idDocument', e)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medical Records (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => handleFileChange('medicalRecords', e)}
                  className="input-field"
                />
                {files.medicalRecords.length > 0 && (
                  <p className="mt-1 text-sm text-gray-600">
                    {files.medicalRecords.length} file(s) selected
                  </p>
                )}
              </div>

              {isUnder21 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian ID *
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange('guardianId', e)}
                    className="input-field"
                    required={isUnder21}
                  />
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Submitting...' : 'Submit Intake Form'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}
