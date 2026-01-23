'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { logout } from '@/store/slices/authSlice'
import type { AppDispatch } from '@/store/store'

export default function LogoutPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    dispatch(logout())
    router.push('/login')
  }, [dispatch, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Logging out...</div>
    </div>
  )
}
