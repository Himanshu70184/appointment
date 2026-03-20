'use client'

import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { usePathname, useRouter } from 'next/navigation'
import { getCurrentUser } from '@/store/slices/authSlice'
import type { AppDispatch, RootState } from '@/store/store'
import Cookies from 'js-cookie'
import LoadingSpinner from './LoadingSpinner'
import api from '@/lib/api'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/verify-email', '/setup-password', '/patient/book']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, loading } = useSelector((state: RootState) => state.auth)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isCheckingIntake, setIsCheckingIntake] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    // Run only once on mount - initRef ensures this even if hook is called multiple times
    // Empty dependency array is intentional - we only want to auth check once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (initRef.current) return
    initRef.current = true

    const initAuth = async () => {
      const token = Cookies.get('token')
      
      // If we have a token, try to fetch the current user
      if (token) {
        try {
          await dispatch(getCurrentUser()).unwrap()
        } catch (error: any) {
          console.error('Failed to fetch current user:', error)
          // Clear invalid token
          Cookies.remove('token')
        }
      }
      
      // Mark as done initializing
      setIsInitializing(false)
    }

    // Run immediately
    initAuth()
  }, [])

  useEffect(() => {
    // Don't run while initializing
    if (isInitializing) return

    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

    // Redirect to login if not authenticated and not on public route
    if (!isAuthenticated && !isPublicRoute) {
      router.push('/login')
      return
    }

    // Redirect away from public routes if authenticated
    if (isAuthenticated && user && isPublicRoute && pathname !== '/verify-email' && pathname !== '/patient/book') {
      if (user.role_id === 2) {
        router.push('/doctor/dashboard')
      } else if (user.role_id === 3) {
        router.push('/patient/dashboard')
      } else {
        router.push('/dashboard')
      }
    }
  }, [isInitializing, isAuthenticated, user, pathname, router])

  useEffect(() => {
    if (
      isInitializing ||
      loading ||
      !isAuthenticated ||
      !user ||
      user.role_id !== 3 ||
      pathname?.startsWith('/patient/profile')
    ) {
      return
    }

    const checkIntakePending = async () => {
      const storageKey = 'intakePendingCheckAt'
      const now = Date.now()
      const lastCheck = Number(sessionStorage.getItem(storageKey) || 0)
      if (now - lastCheck < 30000) {
        return
      }
      sessionStorage.setItem(storageKey, String(now))

      setIsCheckingIntake(true)
      try {
        const response = await api.get('/api/patient-portal/appointments')
        const appointments = response.data?.appointments || []
        const pendingIntake = appointments.find((appointment: any) =>
          appointment.intakePending ||
          (!appointment.intakeSubmitted &&
            appointment.status !== 'completed' &&
            appointment.status !== 'cancelled' &&
            appointment.status !== 'canceled')
        )

        if (pendingIntake) {
          const intakePath = `/patient/intake-form/${pendingIntake._id}`
          const isOnIntakePage =
            pathname?.startsWith('/patient/intake-form') ||
            pathname?.startsWith('/patient/intake')
          const allowWhilePending = pathname?.startsWith('/patient/profile')

          if (!isOnIntakePage && !allowWhilePending) {
            router.push(intakePath)
          }
        }
      } catch (error) {
        console.error('Failed to check intake pending:', error)
      } finally {
        setIsCheckingIntake(false)
      }
    }

    checkIntakePending()
  }, [isAuthenticated, isInitializing, loading, pathname, router, user])

  // Show loading spinner only during initial auth check
  if (isInitializing) {
    return <LoadingSpinner fullScreen text="Loading..." />
  }

  return <>{children}</>
}
