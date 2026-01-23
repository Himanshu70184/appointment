'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { verifyEmail } from '@/store/slices/authSlice'
import type { AppDispatch } from '@/store/store'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Verification token is missing')
      return
    }

    dispatch(verifyEmail(token))
      .unwrap()
      .then((data) => {
        setStatus('success')
        setMessage('Email verified successfully! Please check your email to set up your password.')
        // Redirect to password setup if token provided
        if (data.setupToken) {
          setTimeout(() => {
            router.push(`/setup-password?token=${data.setupToken}`)
          }, 2000)
        }
      })
      .catch((error) => {
        setStatus('error')
        setMessage(error.message || 'Email verification failed')
      })
  }, [searchParams, dispatch, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {status === 'loading' && (
          <div>
            <div className="text-2xl mb-4">Verifying email...</div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
            <p>{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
