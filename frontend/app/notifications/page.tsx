'use client'

import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import NotificationCenter from '@/components/NotificationCenter'
import type { RootState } from '@/store/store'

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    if (!user) return

    if (user.role_id === 2) {
      router.replace('/doctor/notifications')
      return
    }

    if (user.role_id === 3) {
      router.replace('/patient/notifications')
    }
  }, [user, router])

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <NotificationCenter heading="Notifications" subheading="Review updates across patients and schedules" />
        </div>
      </div>
    </DashboardLayout>
  )
}
