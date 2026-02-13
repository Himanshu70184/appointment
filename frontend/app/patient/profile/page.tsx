'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDispatch, useSelector } from 'react-redux'
import { updateProfile, changePassword, clearError, clearSuccess } from '@/store/slices/patientPortalSlice'
import { getCurrentUser, logout } from '@/store/slices/authSlice'
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
    if (user && user.role_id !== 3) {
      router.push('/patient/dashboard')
    }
  }, [user, router])

  useEffect(() => {
    dispatch(getCurrentUser()).unwrap().catch(() => {
      // Ignore errors; AuthGuard and interceptor handle invalid tokens
    })
  }, [dispatch])

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

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 p-8 text-white shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute -left-10 top-0 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">Patient Portal</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">Profile & Security</h1>
              <p className="mt-4 text-white/85">
                Keep your contact information up to date so doctors and staff can reach you instantly. All
                updates sync directly with your medical card paperwork.
              </p>
            </div>
            <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white/15 p-5 backdrop-blur-md shadow-lg">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Primary email</p>
                <p className="mt-1 text-lg font-semibold">{user?.email || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Phone on file</p>
                <p className="mt-1 text-lg font-semibold">{user?.phone || 'Add phone number'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Current state</p>
                <p className="mt-1 text-lg font-semibold">{user?.state || 'Not selected'}</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/patient/dashboard')}
              className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5"
            >
              🚪 Logout
            </button>
          </div>
        </section>

        {success && (
          <div className="rounded-2xl border border-green-200 bg-green-50/90 p-4 text-green-800 shadow-sm">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-red-800 shadow-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => dispatch(clearError())}
              className="text-sm font-semibold text-red-700 hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Profile</p>
                <h2 className="text-2xl font-semibold text-gray-900">Personal details</h2>
                <p className="text-sm text-gray-500">Update the basics used for scheduling, notifications, and paperwork.</p>
              </div>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300"
                >
                  ✏️ Edit details
                </button>
              )}
            </div>

            <div className="mt-6">
              {editMode ? (
                <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input {...registerProfile('firstName')} className="input w-full" />
                      {profileErrors.firstName && (
                        <p className="mt-1 text-sm text-red-500">{profileErrors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                      <input {...registerProfile('lastName')} className="input w-full" />
                      {profileErrors.lastName && (
                        <p className="mt-1 text-sm text-red-500">{profileErrors.lastName.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                      <input {...registerProfile('phone')} placeholder="1234567890" className="input w-full" />
                      {profileErrors.phone && (
                        <p className="mt-1 text-sm text-red-500">{profileErrors.phone.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        value={user?.email || ''}
                        disabled
                        className="input w-full bg-gray-100 text-gray-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Email is verified and cannot be changed online.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                      <input
                        type="date"
                        value={user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : ''}
                        disabled
                        className="input w-full bg-gray-100 text-gray-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Contact support to correct birth records.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
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
                <dl className="divide-y divide-gray-100 text-sm text-gray-600">
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-gray-500">Name</dt>
                    <dd className="text-base font-semibold text-gray-900">{user?.name || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-gray-500">Email</dt>
                    <dd className="text-base font-semibold text-gray-900">{user?.email || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-gray-500">Phone</dt>
                    <dd className="text-base font-semibold text-gray-900">{user?.phone || 'N/A'}</dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-gray-500">Date of Birth</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="font-medium text-gray-500">State</dt>
                    <dd className="text-base font-semibold text-gray-900">{user?.state || 'N/A'}</dd>
                  </div>
                  {user?.prn && (
                    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="font-medium text-gray-500">Patient ID (PRN)</dt>
                      <dd className="font-mono text-base font-semibold text-gray-900">{user.prn}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">🪪</div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Account snapshot</p>
                  <h3 className="text-xl font-semibold text-gray-900">Verification basics</h3>
                </div>
              </div>
              <dl className="mt-6 space-y-4 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <dt>Status</dt>
                  <dd className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Patient</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Role ID</dt>
                  <dd className="font-semibold text-gray-900">{user?.role_id ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Guardian needed</dt>
                  <dd className="font-semibold text-gray-900">{user?.isMinor ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Preferred contact</dt>
                  <dd className="font-semibold text-gray-900">Email & SMS</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-amber-500">Helpful tips</p>
              <h3 className="mt-2 text-xl font-semibold text-gray-900">Faster approvals</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">⏱</span>
                  Keep your phone reachable for intake reminders.
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">📑</span>
                  Upload IDs that match this profile exactly.
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">💬</span>
                  Enable notifications so staff can nudge you if paperwork is missing.
                </li>
              </ul>
            </section>
          </div>
        </div>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Security</p>
              <h2 className="text-2xl font-semibold text-gray-900">Change password</h2>
              <p className="text-sm text-gray-500">Use a strong phrase you do not reuse anywhere else.</p>
            </div>
          </div>

          <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password *</label>
              <input type="password" {...registerPassword('newPassword')} className="input w-full" />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-red-500">{passwordErrors.newPassword.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
              <input type="password" {...registerPassword('confirmPassword')} className="input w-full" />
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
