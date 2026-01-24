'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDispatch, useSelector } from 'react-redux'
import { login, verify2FA } from '@/store/slices/authSlice'
import Link from 'next/link'
import type { AppDispatch, RootState } from '@/store/store'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { isAuthenticated, loading, error, requiresTwoFactor, twoFactorUserId } = useSelector((state: RootState) => state.auth)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const onSubmit = async (data: LoginFormData) => {
    try {
      await dispatch(login(data)).unwrap()
      // If 2FA is not required, redirect will happen via the useEffect
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorUserId) return
    
    setOtpError('')
    if (otpCode.length !== 6) {
      setOtpError('Please enter a 6-digit code')
      return
    }

    try {
      await dispatch(verify2FA({ userId: twoFactorUserId, code: otpCode })).unwrap()
      router.push('/dashboard')
    } catch (err: any) {
      setOtpError(err.message || '2FA verification failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {requiresTwoFactor ? 'Two-Factor Authentication' : 'Sign in to your account'}
          </h2>
          {requiresTwoFactor && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter the 6-digit code sent to your email
            </p>
          )}
        </div>
        
        {requiresTwoFactor ? (
          <div className="mt-8 space-y-6">
            {otpError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {otpError}
              </div>
            )}
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="input-field text-center text-2xl tracking-widest"
                placeholder="000000"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleVerify2FA}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className="input-field rounded-t-md"
                  placeholder="Email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  className="input-field rounded-b-md"
                  placeholder="Password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500">
                  Register here
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
