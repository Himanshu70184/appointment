'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDispatch, useSelector } from 'react-redux'
import { updateProfile, changePassword, clearError, clearSuccess } from '@/store/slices/patientPortalSlice'
import type { AppDispatch, RootState } from '@/store/store'

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Enter 10-digit phone number'),
})

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

export default function PatientProfilePage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { loading, error, success } = useSelector((state: RootState) => state.patientPortal)
  const [editMode, setEditMode] = useState(false)

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  useEffect(() => {
    if (!user || user.role_id !== 3) {
      router.push('/login')
    }
  }, [user, router])

  useEffect(() => {
    if (user) {
      resetProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
      })
    }
  }, [user, resetProfile])

  useEffect(() => {
    if (success) {
      setTimeout(() => {
        dispatch(clearSuccess())
        setEditMode(false)
      }, 3000)
    }
  }, [success, dispatch])

  const onProfileSubmit = async (data: ProfileFormData) => {
    try {
      await dispatch(updateProfile(data)).unwrap()
      // Reload user data from auth
      window.location.reload()
    } catch (err) {
      console.error('Failed to update profile:', err)
    }
  }

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      await dispatch(changePassword(data)).unwrap()
      resetPassword()
    } catch (err) {
      console.error('Failed to change password:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button onClick={() => router.push('/patient/dashboard')} className="text-blue-600 hover:text-blue-800 mb-4">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">My Profile</h1>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Profile Information</h2>
              {!editMode && (
                <button onClick={() => setEditMode(true)} className="btn-secondary">
                  Edit Profile
                </button>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">First Name *</label>
                    <input {...registerProfile('firstName')} className="input w-full" />
                    {profileErrors.firstName && (
                      <p className="text-red-500 text-sm mt-1">
                        {profileErrors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Last Name *</label>
                    <input {...registerProfile('lastName')} className="input w-full" />
                    {profileErrors.lastName && (
                      <p className="text-red-500 text-sm mt-1">
                        {profileErrors.lastName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone *</label>
                    <input
                      {...registerProfile('phone')}
                      placeholder="1234567890"
                      className="input w-full"
                    />
                    {profileErrors.phone && (
                      <p className="text-red-500 text-sm mt-1">{profileErrors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      value={user?.email || ''}
                      disabled
                      className="input w-full bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={
                        user?.dateOfBirth
                          ? new Date(user.dateOfBirth).toISOString().split('T')[0]
                          : ''
                      }
                      disabled
                      className="input w-full bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Date of birth cannot be changed</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false)
                      resetProfile()
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-semibold">{user?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-semibold">{user?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-semibold">{user?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Date of Birth:</span>
                  <span className="font-semibold">
                    {user?.dateOfBirth
                      ? new Date(user.dateOfBirth).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">State:</span>
                  <span className="font-semibold">{user?.state || 'N/A'}</span>
                </div>
                {user?.prn && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Patient ID (PRN):</span>
                    <span className="font-mono font-semibold">{user.prn}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Change Password Card */}
          <div className="card">
            <h2 className="text-2xl font-semibold mb-6">Change Password</h2>

            <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">New Password *</label>
                <input
                  type="password"
                  {...registerPassword('newPassword')}
                  className="input w-full"
                />
                {passwordErrors.newPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {passwordErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password *</label>
                <input
                  type="password"
                  {...registerPassword('confirmPassword')}
                  className="input w-full"
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
