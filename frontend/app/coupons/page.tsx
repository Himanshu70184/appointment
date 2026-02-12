'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import CouponFormModal from '@/components/CouponFormModal'
import CouponRedemptionDrawer from '@/components/CouponRedemptionDrawer'
import type { AppDispatch, RootState } from '@/store/store'
import {
  fetchCoupons,
  deleteCoupon,
  toggleCouponStatus,
  clearCouponError,
  clearCouponSuccess,
} from '@/store/slices/couponSlice'
import { getStates } from '@/store/slices/stateSlice'
import { getAppointmentTypes } from '@/store/slices/appointmentTypeSlice'
import type { Coupon } from '@/types'

const formatDateRange = (start?: string, end?: string) => {
  if (!start || !end) return '—'
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`
}

const soonThreshold = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export default function CouponsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { coupons, loading, error, success, message } = useSelector((state: RootState) => state.coupons)
  const { states } = useSelector((state: RootState) => state.states)
  const { appointmentTypes } = useSelector((state: RootState) => state.appointmentTypes)
  const { user } = useSelector((state: RootState) => state.auth)

  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [redeemerCoupon, setRedeemerCoupon] = useState<Coupon | null>(null)

  useEffect(() => {
    dispatch(fetchCoupons())
    dispatch(getStates({ isActive: true }))
    dispatch(getAppointmentTypes({ isActive: true }))
  }, [dispatch])

  useEffect(() => {
    if (success) {
      const timer = window.setTimeout(() => dispatch(clearCouponSuccess()), 3000)
      return () => window.clearTimeout(timer)
    }
  }, [success, dispatch])

  useEffect(() => {
    if (error) {
      const timer = window.setTimeout(() => dispatch(clearCouponError()), 4000)
      return () => window.clearTimeout(timer)
    }
  }, [error, dispatch])

  const filteredCoupons = useMemo(() => {
    if (!searchTerm.trim()) return coupons
    const term = searchTerm.trim().toLowerCase()
    return coupons.filter((coupon) => {
      return (
        coupon.code.toLowerCase().includes(term) ||
        (coupon.description?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [coupons, searchTerm])

  const stats = useMemo(() => {
    const active = coupons.filter((coupon) => coupon.isActive).length
    const expiringSoon = coupons.filter((coupon) => new Date(coupon.validUntil) <= soonThreshold()).length
    const totalRedemptions = coupons.reduce(
      (sum, coupon) => sum + (coupon.redemptionCount ?? coupon.usedCount ?? 0),
      0
    )
    const totalSavings = coupons.reduce((sum, coupon) => sum + (coupon.totalSavings ?? 0), 0)
    return { active, expiringSoon, totalRedemptions, totalSavings }
  }, [coupons])

  const stateLookup = useMemo(() => {
    return states.reduce<Record<string, string>>((acc, state) => {
      acc[state.code] = state.name
      return acc
    }, {})
  }, [states])

  const appointmentTypeLookup = useMemo(() => {
    return appointmentTypes.reduce<Record<string, { name: string; price?: number }>>((acc, type) => {
      acc[type._id] = { name: type.name, price: type.price }
      return acc
    }, {})
  }, [appointmentTypes])

  const handleDelete = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) return
    await dispatch(deleteCoupon(coupon._id))
  }

  const handleToggle = async (coupon: Coupon) => {
    await dispatch(toggleCouponStatus(coupon._id))
  }

  const openModal = (coupon?: Coupon) => {
    setEditingCoupon(coupon ?? null)
    setShowModal(true)
  }

  const closeModal = () => {
    setEditingCoupon(null)
    setShowModal(false)
  }

  if (user?.role_id !== 1) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[70vh] items-center justify-center rounded-3xl border border-red-100 bg-red-50/80 p-12 text-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-red-400">Restricted</p>
            <h1 className="mt-4 text-3xl font-bold text-red-700">Admin access required</h1>
            <p className="mt-2 text-red-500">Only administrators can manage coupons.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-8 text-white shadow-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5), transparent 60%)' }} />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-white/80">Promo Control Center</p>
              <h1 className="mt-3 text-4xl font-semibold" style={{ fontFamily: 'Space Grotesk, var(--font-sans)' }}>
                Coupon Studio
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/90">
                Launch precise, state-aware promotions in seconds. Monitor adoption, pause underperformers, and keep renewals incentivized.
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <div className="rounded-2xl bg-white/15 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/70">Active</p>
                  <p className="mt-1 text-3xl font-semibold">{stats.active}</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/70">Expiring · 7d</p>
                  <p className="mt-1 text-3xl font-semibold">{stats.expiringSoon}</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/70">Redemptions</p>
                  <p className="mt-1 text-3xl font-semibold">{stats.totalRedemptions}</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/70">Lifetime Savings</p>
                  <p className="mt-1 text-3xl font-semibold">
                    {currencyFormatter.format(stats.totalSavings || 0)}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => openModal()}
              className="relative rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              + Launch Coupon
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk, var(--font-sans)' }}>
                Campaign Inventory
              </h2>
              <p className="text-sm text-slate-500">
                Track eligibility, usage ceilings, and region locks at a glance.
              </p>
            </div>
            <div className="flex w-full items-center gap-3 md:w-auto">
              <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 backdrop-blur md:w-72">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>🔎</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search code or note"
                    className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() => openModal()}
                className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50"
              >
                New
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {message || 'Action completed'}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {loading && coupons.length === 0 ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
              <p className="text-4xl">🥀</p>
              <h3 className="mt-4 text-xl font-semibold text-slate-700">No coupons match this view</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Adjust your search or create a fresh promo to keep the pipeline full.
              </p>
              <button
                onClick={() => openModal()}
                className="mt-6 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30"
              >
                Create coupon
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCoupons.map((coupon) => {
                const usageLimit = coupon.usageLimit ?? undefined
                const redemptions = coupon.redemptionCount ?? coupon.usedCount ?? 0
                const usageLabel = usageLimit ? `${redemptions}/${usageLimit}` : `${redemptions} / ∞`
                const chipStates = coupon.applicableStates && coupon.applicableStates.length > 0
                  ? coupon.applicableStates
                  : ['*']
                const savingsDisplay = coupon.totalSavings ?? 0
                const appointmentTypeTokens =
                  coupon.applicableAppointmentTypes && coupon.applicableAppointmentTypes.length > 0
                    ? coupon.applicableAppointmentTypes
                        .map((entry) => {
                          if (!entry) return null
                          if (typeof entry === 'string') {
                            return appointmentTypeLookup[entry]?.name || 'Card Type'
                          }
                          return entry.name || 'Card Type'
                        })
                        .filter(Boolean)
                    : null
                const overrideEntries = coupon.appointmentTypeOverrides ?? []

                return (
                  <div key={coupon._id} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.07),_transparent_55%)]" />
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Code</p>
                        <p className="mt-1 text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk, var(--font-sans)' }}>
                          {coupon.code}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          coupon.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {coupon.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline gap-3">
                      <p className="text-4xl font-bold text-emerald-600">
                        {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `$${coupon.discountValue}`}
                      </p>
                      <span className="text-sm text-slate-500">
                        {coupon.discountType === 'percentage' ? 'off' : 'flat savings'}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">{coupon.description || '—'}</p>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Validity</p>
                        <p className="mt-1 font-medium">{formatDateRange(coupon.validFrom, coupon.validUntil)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Usage</p>
                        <p className="mt-1 font-medium">{usageLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Redemptions</p>
                        <p className="mt-1 font-medium">{redemptions}</p>
                        {coupon.lastRedeemedAt && (
                          <p className="text-xs text-slate-400">
                            Last · {new Date(coupon.lastRedeemedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Savings</p>
                        <p className="mt-1 font-medium text-emerald-600">
                          {currencyFormatter.format(savingsDisplay)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Regions</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {chipStates.map((code) => (
                            <span
                              key={`${coupon._id}-${code}`}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                            >
                              {code === '*'
                                ? 'All states'
                                : `${code} · ${stateLookup[code] || 'State'}`}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Card Types</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {appointmentTypeTokens && appointmentTypeTokens.length > 0 ? (
                            appointmentTypeTokens.map((label, index) => (
                              <span
                                key={`${coupon._id}-card-${index}`}
                                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600"
                              >
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              All card types
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Overrides</p>
                        {overrideEntries.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {overrideEntries.map((override, index) => {
                              const overrideTypeId =
                                typeof override.appointmentType === 'string'
                                  ? override.appointmentType
                                  : override.appointmentType?._id
                              const typeLabel =
                                (typeof override.appointmentType === 'object'
                                  ? override.appointmentType?.name
                                  : appointmentTypeLookup[overrideTypeId || '']?.name) || 'Card Type'
                              const discountLabel =
                                override.discountType === 'percentage'
                                  ? `${override.discountValue}%`
                                  : `$${override.discountValue}`
                              const maxCap =
                                typeof override.maxDiscount === 'number' && override.maxDiscount > 0
                                  ? ` · cap $${override.maxDiscount.toFixed(2)}`
                                  : ''
                              return (
                                <div
                                  key={`${coupon._id}-override-${index}`}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
                                >
                                  <span>{typeLabel}</span>
                                  <span className="text-emerald-600">
                                    {discountLabel}
                                    <span className="text-slate-400">{maxCap}</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs font-medium text-slate-400">Applies baseline discount to every type</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm font-semibold">
                      <button
                        onClick={() => setRedeemerCoupon(coupon)}
                        className="flex items-center gap-2 rounded-full border border-emerald-100 px-3 py-1 text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <span>👥</span>
                        Redeemers
                      </button>
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          onClick={() => openModal(coupon)}
                          className="text-slate-600 transition hover:text-emerald-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggle(coupon)}
                          className="text-slate-600 transition hover:text-emerald-600"
                        >
                          {coupon.isActive ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(coupon)}
                          className="text-red-500 transition hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {showModal && (
          <CouponFormModal
            coupon={editingCoupon}
            states={states}
            appointmentTypes={appointmentTypes}
            onClose={closeModal}
          />
      )}
      {redeemerCoupon && (
        <CouponRedemptionDrawer coupon={redeemerCoupon} onClose={() => setRedeemerCoupon(null)} />
      )}
    </DashboardLayout>
  )
}
