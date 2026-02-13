'use client'

import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import NotificationCenter from '@/components/NotificationCenter'
import type { RootState } from '@/store/store'

const formatPhoneNumber = (value?: string) => {
  if (!value) return 'Add phone number'
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length !== 10) return value
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function PatientNotificationsPage() {
  const router = useRouter()
  const { user } = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    if (!user) return

    if (user.role_id !== 3) {
      if (user.role_id === 2) {
        router.replace('/doctor/notifications')
      } else {
        router.replace('/notifications')
      }
    }
  }, [user, router])

  const contactHighlights = [
    {
      icon: '✉️',
      label: 'Primary email',
      value: user?.email || 'Add email address',
      description: 'Booking confirmations, approvals, and medical card decisions arrive here.',
    },
    {
      icon: '📱',
      label: 'SMS number',
      value: formatPhoneNumber(user?.phone),
      description: 'Used for intake reminders and last-minute schedule changes.',
    },
    {
      icon: '📍',
      label: 'State program',
      value: user?.state || 'Choose a state',
      description: 'Helps us surface state-specific licensing guidance.',
    },
  ]

  const channelBadges = [
    { title: 'Booking updates', detail: 'Approvals, cancellations, reschedules' },
    { title: 'Paperwork nudges', detail: 'Intake, PDMP, guardian signatures' },
    { title: 'Perks & promos', detail: 'Seasonal discounts from admin' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-800 to-emerald-600 p-8 text-white shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute -right-10 top-0 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">Patient Portal</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">Notifications</h1>
              <p className="mt-4 text-white/85">
                Stay informed about bookings, paperwork, and approvals. All alerts sync with your dashboard and inbox so
                nothing slips through.
              </p>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-white/10 p-5 text-sm text-white/85 backdrop-blur-lg">
              <p className="text-xs uppercase tracking-wide text-white/60">Snapshot</p>
              <ul className="mt-3 space-y-2">
                <li className="flex items-center justify-between">
                  <span>Unread alerts</span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Real-time</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Delivery channels</span>
                  <span>Email & SMS</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>State focus</span>
                  <span>{user?.state || 'All states'}</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="relative z-10 mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/patient/dashboard')}
              className="inline-flex items-center justify-center rounded-full bg-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={() => router.push('/patient/profile')}
              className="inline-flex items-center justify-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5"
            >
              ⚙️ Notification Preferences
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contactHighlights.map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                  <p className="text-base font-semibold text-gray-900">{item.value}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Channels</p>
              <h2 className="text-2xl font-semibold text-gray-900">What we send</h2>
              <p className="text-sm text-gray-500">Expect timely updates across the touchpoints below.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {channelBadges.map((badge) => (
                <span
                  key={badge.title}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700"
                >
                  {badge.title}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {channelBadges.map((badge) => (
              <div key={`${badge.title}-detail`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                <h3 className="text-base font-semibold text-gray-900">{badge.title}</h3>
                <p className="mt-1">{badge.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
          <NotificationCenter heading="Recent updates" subheading="All updates for your account appear here." />
        </section>
      </div>
    </div>
  )
}
