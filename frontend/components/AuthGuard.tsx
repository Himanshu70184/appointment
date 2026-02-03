'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('token')
      
      // If we have a token but no user, fetch the current user
      if (token && !user && !loading) {
        try {
          await dispatch(getCurrentUser()).unwrap()
        } catch (error) {
          // Token is invalid, will be cleared by API interceptor
          console.error('Failed to fetch current user:', error)
        }
      }
      
      setIsInitializing(false)
    }

    initAuth()
  }, [dispatch, user, loading])

  useEffect(() => {
    // Don't do anything while initializing
    if (isInitializing || loading) return

    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

    // Only redirect to login if definitely not authenticated
    if (!isAuthenticated && !loading && !isPublicRoute) {
      console.log('AuthGuard: Redirecting to login - not authenticated')
      router.push('/login')
      return
    }

    // Only redirect away from public routes if fully authenticated with user data
    if (isAuthenticated && user && isPublicRoute && pathname !== '/verify-email' && pathname !== '/patient/book') {
      console.log('AuthGuard: Redirecting from public route to dashboard')
      // Determine redirect based on user role
      if (user.role_id === 2) {
        router.push('/doctor/dashboard')
      } else if (user.role_id === 3) {
        router.push('/patient/dashboard')
      } else {
        router.push('/dashboard')
      }
    }
  }, [isAuthenticated, isInitializing, pathname, user, loading])

  useEffect(() => {
    if (
      isInitializing ||
      loading ||
      !isAuthenticated ||
      !user ||
      user.role_id !== 3
    ) {
      return
    }

    const checkIntakePending = async () => {
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

          if (!isOnIntakePage) {
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

  // Show loading spinner while initializing or loading
  if (isInitializing || loading || isCheckingIntake) {
    return <LoadingSpinner fullScreen text="Authenticating..." />
  }

  return <>{children}</>
}
