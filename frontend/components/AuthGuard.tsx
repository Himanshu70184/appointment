'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { usePathname, useRouter } from 'next/navigation'
import { getCurrentUser } from '@/store/slices/authSlice'
import type { AppDispatch, RootState } from '@/store/store'
import Cookies from 'js-cookie'
import LoadingSpinner from './LoadingSpinner'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/verify-email', '/setup-password']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, loading } = useSelector((state: RootState) => state.auth)
  const [isInitializing, setIsInitializing] = useState(true)

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
    if (isInitializing) return

    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

    // Redirect to login if not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.push('/login')
    }

    // Redirect to dashboard if authenticated and trying to access public route
    if (isAuthenticated && isPublicRoute && pathname !== '/verify-email') {
      // Determine redirect based on user role
      if (user?.role_id === 2) {
        router.push('/doctor/dashboard')
      } else if (user?.role_id === 3) {
        router.push('/patient/dashboard')
      } else {
        router.push('/dashboard')
      }
    }
  }, [isAuthenticated, isInitializing, pathname, router, user])

  // Show loading spinner while initializing or loading
  if (isInitializing || loading) {
    return <LoadingSpinner fullScreen text="Authenticating..." />
  }

  return <>{children}</>
}
