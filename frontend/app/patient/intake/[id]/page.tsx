'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useDispatch, useSelector } from 'react-redux'
import { submitIntakeForm, checkIntakeEligibility } from '@/store/slices/patientPortalSlice'
import type { AppDispatch, RootState } from '@/store/store'

export default function IntakeFormPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useDispatch<AppDispatch>()
  const { loading, error, success } = useSelector((state: RootState) => state.patientPortal)
  const appointmentId = params?.id as string

  const [eligibility, setEligibility] = useState<any>(null)
  const [checkingEligibility, setCheckingEligibility] = useState(true)

  const { register, handleSubmit, formState: { errors } } = useForm()

  useEffect(() => {
    checkEligibility()
  }, [appointmentId])

  useEffect(() => {
    if (success) {
      setTimeout(() => {
        router.push('/patient/dashboard')
      }, 2000)
    }
  }, [success, router])

  const checkEligibility = async () => {
    try {
      setCheckingEligibility(true)
      const result = await dispatch(checkIntakeEligibility(appointmentId)).unwrap()
      setEligibility(result)
    } catch (err: any) {
      console.error('Failed to check eligibility:', err)
      setEligibility({ eligible: false, reason: err.message || 'Failed to check eligibility' })
    } finally {
      setCheckingEligibility(false)
    }
  }

  const onSubmit = async (data: any) => {
    try {
      await dispatch(submitIntakeForm({ appointmentId, intakeForm: data })).unwrap()
    } catch (err) {
      console.error('Failed to submit intake form:', err)
    }
  }

  const formatTimeRemaining = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins > 0 ? `${mins} minutes` : ''}`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="card">
          <h1 className="text-3xl font-bold mb-6">Medical Intake Form</h1>
          <p className="text-gray-600 mb-8">
            Please provide your medical information to help your doctor prepare for your consultation.
          </p>

          {checkingEligibility && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              Checking eligibility...
            </div>
          )}

          {!checkingEligibility && eligibility && !eligibility.eligible && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              <strong>⚠ Cannot Submit Intake Form</strong>
              <p className="mt-2">{eligibility.reason}</p>
              {eligibility.alreadySubmitted && (
                <button
                  onClick={() => router.push('/patient/dashboard')}
                  className="mt-4 btn-primary"
                >
                  Return to Dashboard
                </button>
              )}
              {eligibility.deadlinePassed && (
                <p className="mt-2 text-sm">
                  Please contact support if you need assistance.
                </p>
              )}
            </div>
          )}

          {!checkingEligibility && eligibility && eligibility.eligible && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              <strong>✓ You can submit your intake form</strong>
              <p className="mt-2">
                Time remaining: <strong>{formatTimeRemaining(eligibility.minutesRemaining)}</strong>
              </p>
              <p className="text-sm mt-1">
                Deadline: {new Date(eligibility.deadline).toLocaleString('en-US', { 
                  dateStyle: 'medium', 
                  timeStyle: 'short',
                  timeZone: 'America/New_York'
                })} EST
              </p>
              <p className="text-sm mt-1">
                Appointment: {new Date(eligibility.appointmentTime).toLocaleString('en-US', { 
                  dateStyle: 'medium', 
                  timeStyle: 'short',
                  timeZone: 'America/New_York'
                })} EST
              </p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              ✓ {success} Redirecting to dashboard...
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {(!checkingEligibility && eligibility?.eligible) && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Medical Conditions *
              </label>
              <textarea
                {...register('currentConditions', { required: 'This field is required' })}
                rows={4}
                className="input w-full"
                placeholder="List any current medical conditions you have..."
              />
              {errors.currentConditions && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.currentConditions.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Current Medications *
              </label>
              <textarea
                {...register('currentMedications', { required: 'This field is required' })}
                rows={4}
                className="input w-full"
                placeholder="List all medications you are currently taking..."
              />
              {errors.currentMedications && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.currentMedications.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Allergies
              </label>
              <textarea
                {...register('allergies')}
                rows={3}
                className="input w-full"
                placeholder="List any known allergies..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Previous Surgeries or Hospitalizations
              </label>
              <textarea
                {...register('previousSurgeries')}
                rows={3}
                className="input w-full"
                placeholder="Describe any previous surgeries or hospitalizations..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Family Medical History
              </label>
              <textarea
                {...register('familyHistory')}
                rows={3}
                className="input w-full"
                placeholder="Describe relevant family medical history..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Reason for Seeking Medical Cannabis *
              </label>
              <textarea
                {...register('reasonForCannabis', { required: 'This field is required' })}
                rows={4}
                className="input w-full"
                placeholder="Explain why you are seeking a medical cannabis recommendation..."
              />
              {errors.reasonForCannabis && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.reasonForCannabis.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Have you used cannabis before?
              </label>
              <select {...register('previousCannabisUse')} className="input w-full">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Notes
              </label>
              <textarea
                {...register('additionalNotes')}
                rows={4}
                className="input w-full"
                placeholder="Any other information you'd like to share with your doctor..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('certifyTruth', { required: 'You must certify the information' })}
                className="mr-2"
              />
              <label className="text-sm">
                I certify that the information provided above is true and accurate to the best of my knowledge. *
              </label>
            </div>
            {errors.certifyTruth && (
              <p className="text-red-500 text-sm">{errors.certifyTruth.message as string}</p>
            )}

            <button
              type="submit"
              disabled={loading || !eligibility?.eligible}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Intake Form'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  )
}
