'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { Coupon } from '@/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

interface RedemptionRecord {
  appointmentId: string
  patient: {
    id?: string
    name: string
    email: string | null
    phone: string | null
  }
  state?: string
  serviceName?: string
  couponCode?: string
  scheduledDate?: string
  scheduledTime?: string
  createdAt?: string
  discountAmount: number
  originalAmount: number
  finalAmount: number
  paymentStatus?: string | null
}

interface PaginationMeta {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface CouponRedemptionDrawerProps {
  coupon: Coupon
  onClose: () => void
}

export default function CouponRedemptionDrawer({ coupon, onClose }: CouponRedemptionDrawerProps) {
  const [records, setRecords] = useState<RedemptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [totals, setTotals] = useState({ totalSavings: 0, totalAdjusted: 0 })

  useEffect(() => {
    setPage(1)
  }, [coupon._id])

  useEffect(() => {
    let isMounted = true

    const fetchRedemptions = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/api/coupons/${coupon._id}/redemptions`, {
          params: { page }
        })
        if (!isMounted) return
        setRecords(response.data?.redemptions || [])
        setPagination(response.data?.pagination || null)
        setTotals(response.data?.totals || { totalSavings: 0, totalAdjusted: 0 })
      } catch (fetchError: any) {
        if (!isMounted) return
        setError(fetchError.response?.data?.message || 'Failed to load redeemers')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRedemptions()
    return () => {
      isMounted = false
    }
  }, [coupon._id, page])

  const handleClose = () => {
    onClose()
  }

  const hasRecords = records.length > 0
  const totalRedemptions = pagination?.totalItems ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Coupon Redeemers</p>
            <h2 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk, var(--font-sans)' }}>
              {coupon.code}
            </h2>
            {coupon.description && (
              <p className="text-sm text-slate-500">{coupon.description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Redemptions</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{totalRedemptions}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total Savings</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">
                {currencyFormatter.format(totals.totalSavings || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Revenue Collected</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {currencyFormatter.format(totals.totalAdjusted || 0)}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : !hasRecords ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
              <p className="text-4xl mb-2">🧾</p>
              <p className="font-semibold text-slate-700">No redemptions yet</p>
              <p className="text-sm text-slate-500">Once patients redeem this coupon, their details will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.3em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Patient</th>
                    <th className="px-4 py-3 text-left">Appointment</th>
                    <th className="px-4 py-3 text-left">Savings</th>
                    <th className="px-4 py-3 text-left">Final Price</th>
                    <th className="px-4 py-3 text-left">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {records.map((record) => {
                    const scheduledDate = record.scheduledDate
                      ? new Date(record.scheduledDate).toLocaleDateString('en-US')
                      : 'Pending'
                    const recordedAt = record.createdAt
                      ? new Date(record.createdAt).toLocaleString('en-US')
                      : '—'
                    return (
                      <tr key={record.appointmentId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{record.patient.name}</div>
                          <div className="text-xs text-slate-500">
                            {record.patient.email || 'No email'} · {record.patient.phone || 'No phone'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{record.serviceName || 'Appointment'}</div>
                          <div className="text-xs text-slate-500">
                            {scheduledDate} · {record.scheduledTime || 'TBD'} · {record.state || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-emerald-600 font-semibold">
                            −{currencyFormatter.format(record.discountAmount || 0)}
                          </div>
                          {record.couponCode && (
                            <div className="text-xs text-slate-500">Code · {record.couponCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {currencyFormatter.format(record.finalAmount || 0)}
                          </div>
                          {record.originalAmount > record.finalAmount && (
                            <div className="text-xs text-slate-400 line-through">
                              {currencyFormatter.format(record.originalAmount)}
                            </div>
                          )}
                          {record.paymentStatus && (
                            <div className="text-xs text-slate-500">{record.paymentStatus}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{recordedAt}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {hasRecords && pagination && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
              <p>
                Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={!pagination.hasPrevPage}
                  className="rounded-full border border-slate-200 px-4 py-1 font-semibold text-slate-600 transition enabled:hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!pagination.hasNextPage}
                  className="rounded-full border border-slate-200 px-4 py-1 font-semibold text-slate-600 transition enabled:hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
