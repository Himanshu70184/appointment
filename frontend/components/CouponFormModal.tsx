'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { Coupon, State as StateType } from '@/types'
import type { AppDispatch, RootState } from '@/store/store'
import { createCoupon, updateCoupon } from '@/store/slices/couponSlice'

interface AppointmentTypeOption {
  _id: string
  name: string
  description?: string
  price?: number
  duration?: number
  isActive?: boolean
}

interface OverrideFormValue {
  appointmentTypeId: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  maxDiscount: string
}

interface CouponFormModalProps {
  coupon?: Coupon | null
  states: StateType[]
  appointmentTypes: AppointmentTypeOption[]
  onClose: () => void
}

const formatForInput = (value?: string) => {
  const date = value ? new Date(value) : new Date()
  date.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getDefaultEndDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return formatForInput(date.toISOString())
}

export default function CouponFormModal({ coupon, states, appointmentTypes, onClose }: CouponFormModalProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { loading } = useSelector((state: RootState) => state.coupons)
  const isEditing = Boolean(coupon)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resolvedAppointmentTypeIds =
    coupon?.applicableAppointmentTypes
      ?.map((entry) => {
        if (!entry) return null
        return typeof entry === 'string' ? entry : entry._id
      })
      .filter((value): value is string => Boolean(value)) ?? []

  const resolvedOverrides: OverrideFormValue[] =
    coupon?.appointmentTypeOverrides
      ?.map((entry) => {
        if (!entry) return null
        const appointmentTypeId =
          typeof entry.appointmentType === 'string'
            ? entry.appointmentType
            : entry.appointmentType?._id
        if (!appointmentTypeId) return null

        return {
          appointmentTypeId,
          discountType: entry.discountType ?? 'percentage',
          discountValue: entry.discountValue != null ? String(entry.discountValue) : '0',
          maxDiscount: entry.maxDiscount != null ? String(entry.maxDiscount) : ''
        }
      })
      .filter((value): value is OverrideFormValue => Boolean(value)) ?? []

  const [formData, setFormData] = useState({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    discountType: coupon?.discountType ?? 'percentage',
    discountValue: coupon ? String(coupon.discountValue) : '10',
    minPurchase: coupon?.minPurchase ? String(coupon.minPurchase) : '',
    maxDiscount: coupon?.maxDiscount ? String(coupon.maxDiscount) : '',
    usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : '',
    validFrom: coupon ? formatForInput(coupon.validFrom) : formatForInput(),
    validUntil: coupon ? formatForInput(coupon.validUntil) : getDefaultEndDate(),
    applicableStates: coupon?.applicableStates ?? [],
    limitToStates: Boolean(coupon?.applicableStates && coupon.applicableStates.length > 0),
    applicableAppointmentTypes: resolvedAppointmentTypeIds,
    limitToAppointmentTypes: resolvedAppointmentTypeIds.length > 0,
    appointmentTypeOverrides: resolvedOverrides,
    isActive: coupon?.isActive ?? true,
  })

  const overrideSlotsAvailable = appointmentTypes.some(
    (type) => !formData.appointmentTypeOverrides.some((override) => override.appointmentTypeId === type._id)
  )

  const handleFieldChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const toggleStateSelection = (code: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.applicableStates.includes(code)
      const nextStates = alreadySelected
        ? prev.applicableStates.filter((stateCode) => stateCode !== code)
        : [...prev.applicableStates, code]
      return { ...prev, applicableStates: nextStates }
    })
    if (errors.applicableStates) {
      setErrors((prev) => {
        if (!prev.applicableStates) return prev
        const next = { ...prev }
        delete next.applicableStates
        return next
      })
    }
  }

  const toggleAppointmentTypeSelection = (id: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.applicableAppointmentTypes.includes(id)
      const nextTypes = alreadySelected
        ? prev.applicableAppointmentTypes.filter((typeId) => typeId !== id)
        : [...prev.applicableAppointmentTypes, id]
      return { ...prev, applicableAppointmentTypes: nextTypes }
    })
    if (errors.applicableAppointmentTypes) {
      setErrors((prev) => {
        if (!prev.applicableAppointmentTypes) return prev
        const next = { ...prev }
        delete next.applicableAppointmentTypes
        return next
      })
    }
  }

  const clearOverrideError = () => {
    if (errors.appointmentTypeOverrides) {
      setErrors((prev) => {
        if (!prev.appointmentTypeOverrides) return prev
        const next = { ...prev }
        delete next.appointmentTypeOverrides
        return next
      })
    }
  }

  const addOverride = () => {
    const nextType = appointmentTypes.find(
      (type) => !formData.appointmentTypeOverrides.some((override) => override.appointmentTypeId === type._id)
    )
    if (!nextType) return

    setFormData((prev) => ({
      ...prev,
      appointmentTypeOverrides: [
        ...prev.appointmentTypeOverrides,
        {
          appointmentTypeId: nextType._id,
          discountType: prev.discountType,
          discountValue: prev.discountValue || '10',
          maxDiscount: ''
        }
      ]
    }))
    clearOverrideError()
  }

  const updateOverrideField = (index: number, field: keyof OverrideFormValue, value: string) => {
    setFormData((prev) => {
      const nextOverrides = [...prev.appointmentTypeOverrides]
      nextOverrides[index] = { ...nextOverrides[index], [field]: value }
      return { ...prev, appointmentTypeOverrides: nextOverrides }
    })
    clearOverrideError()
  }

  const removeOverride = (index: number) => {
    setFormData((prev) => {
      const nextOverrides = prev.appointmentTypeOverrides.filter((_, idx) => idx !== index)
      return { ...prev, appointmentTypeOverrides: nextOverrides }
    })
    clearOverrideError()
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.code.trim()) {
      nextErrors.code = 'Coupon code is required'
    }

    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      nextErrors.discountValue = 'Enter a positive discount value'
    }

    if (!formData.validFrom) {
      nextErrors.validFrom = 'Provide a start date'
    }

    if (!formData.validUntil) {
      nextErrors.validUntil = 'Provide an expiration date'
    }

    if (formData.validFrom && formData.validUntil) {
      const from = new Date(formData.validFrom)
      const until = new Date(formData.validUntil)
      if (from >= until) {
        nextErrors.validUntil = 'End date must be after the start date'
      }
    }

    if (formData.limitToStates && formData.applicableStates.length === 0) {
      nextErrors.applicableStates = 'Select at least one state or disable the filter'
    }

    if (formData.limitToAppointmentTypes && formData.applicableAppointmentTypes.length === 0) {
      nextErrors.applicableAppointmentTypes = 'Pick at least one card type or disable the filter'
    }

    if (formData.appointmentTypeOverrides.length > 0) {
      const seenTypes = new Set<string>()
      for (const override of formData.appointmentTypeOverrides) {
        if (!override.appointmentTypeId) {
          nextErrors.appointmentTypeOverrides = 'Select a card type for every override row'
          break
        }

        if (seenTypes.has(override.appointmentTypeId)) {
          nextErrors.appointmentTypeOverrides = 'Use each card type only once in the overrides list'
          break
        }
        seenTypes.add(override.appointmentTypeId)

        const overrideValue = Number(override.discountValue)
        if (!override.discountValue || Number.isNaN(overrideValue) || overrideValue <= 0) {
          nextErrors.appointmentTypeOverrides = 'Override discount values must be positive'
          break
        }

        if (override.discountType === 'percentage' && overrideValue > 100) {
          nextErrors.appointmentTypeOverrides = 'Override percentage cannot exceed 100%'
          break
        }

        if (override.maxDiscount) {
          const maxValue = Number(override.maxDiscount)
          if (Number.isNaN(maxValue) || maxValue <= 0) {
            nextErrors.appointmentTypeOverrides = 'Override max discount must be a positive number'
            break
          }
        }
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      return
    }

    const payload = {
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim() || undefined,
      discountType: formData.discountType as 'percentage' | 'fixed',
      discountValue: Number(formData.discountValue),
      minPurchase: formData.minPurchase ? Number(formData.minPurchase) : undefined,
      maxDiscount:
        formData.discountType === 'percentage' && formData.maxDiscount
          ? Number(formData.maxDiscount)
          : undefined,
      validFrom: new Date(formData.validFrom).toISOString(),
      validUntil: new Date(formData.validUntil).toISOString(),
      usageLimit: formData.usageLimit ? Number(formData.usageLimit) : undefined,
      applicableStates: formData.limitToStates ? formData.applicableStates : [],
      applicableAppointmentTypes: formData.limitToAppointmentTypes
        ? formData.applicableAppointmentTypes
        : [],
      appointmentTypeOverrides: formData.appointmentTypeOverrides.map((override) => ({
        appointmentType: override.appointmentTypeId,
        discountType: override.discountType,
        discountValue: Number(override.discountValue),
        ...(override.maxDiscount ? { maxDiscount: Number(override.maxDiscount) } : {})
      })),
      isActive: formData.isActive,
    }

    try {
      if (isEditing && coupon) {
        await dispatch(updateCoupon({ id: coupon._id, data: payload })).unwrap()
      } else {
        await dispatch(createCoupon(payload)).unwrap()
      }
      onClose()
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, form: error || 'Failed to save coupon' }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 p-6 text-white">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 55%)' }} />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">{isEditing ? 'Update Offer' : 'New Campaign'}</p>
              <h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: 'Space Grotesk, var(--font-sans)' }}>
                {isEditing ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/85">
                Define discount rules, eligibility, and scheduling to keep promotions under control.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/30"
            >
              Close
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-scroll max-h-[60vh]">
          {errors.form && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.form}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-600">Coupon Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleFieldChange('code', e.target.value.toUpperCase())}
                disabled={isEditing}
                className={`mt-2 w-full rounded-2xl border px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isEditing ? 'bg-slate-100 text-slate-500' : 'bg-white'
                } ${errors.code ? 'border-red-400' : 'border-slate-200'}`}
                placeholder="WELCOME25"
              />
              {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600">Discount Type</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {['percentage', 'fixed'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleFieldChange('discountType', type)}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                      formData.discountType === type
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-200'
                    }`}
                  >
                    {type === 'percentage' ? 'Percentage %' : 'Fixed $'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-600">Discount Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.discountValue}
                onChange={(e) => handleFieldChange('discountValue', e.target.value)}
                className={`mt-2 w-full rounded-2xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.discountValue ? 'border-red-400' : 'border-slate-200'
                }`}
              />
              {errors.discountValue && <p className="mt-1 text-xs text-red-500">{errors.discountValue}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600">Min Purchase (optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minPurchase}
                onChange={(e) => handleFieldChange('minPurchase', e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0"
              />
            </div>

            {formData.discountType === 'percentage' && (
              <div>
                <label className="text-sm font-semibold text-slate-600">Max Discount Cap</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.maxDiscount}
                  onChange={(e) => handleFieldChange('maxDiscount', e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="$200"
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-600">Valid From</label>
              <input
                type="datetime-local"
                value={formData.validFrom}
                onChange={(e) => handleFieldChange('validFrom', e.target.value)}
                className={`mt-2 w-full rounded-2xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.validFrom ? 'border-red-400' : 'border-slate-200'
                }`}
              />
              {errors.validFrom && <p className="mt-1 text-xs text-red-500">{errors.validFrom}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600">Valid Until</label>
              <input
                type="datetime-local"
                value={formData.validUntil}
                onChange={(e) => handleFieldChange('validUntil', e.target.value)}
                className={`mt-2 w-full rounded-2xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.validUntil ? 'border-red-400' : 'border-slate-200'
                }`}
              />
              {errors.validUntil && <p className="mt-1 text-xs text-red-500">{errors.validUntil}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-600">Usage Limit</label>
              <input
                type="number"
                min="1"
                value={formData.usageLimit}
                onChange={(e) => handleFieldChange('usageLimit', e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-600">Restrict to specific states</p>
                <p className="text-xs text-slate-500">Keep empty to allow nationwide redemption.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextValue = !formData.limitToStates
                  handleFieldChange('limitToStates', nextValue)
                  if (!nextValue) {
                    setFormData((prev) => ({ ...prev, applicableStates: [] }))
                  }
                }}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                  formData.limitToStates ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    formData.limitToStates ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {formData.limitToStates && (
            <div>
              <label className="text-sm font-semibold text-slate-600">Eligible States</label>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                {states.length === 0 && (
                  <p className="text-sm text-slate-500">No states available. Add states first.</p>
                )}
                {states.map((state) => (
                  <label
                    key={state._id}
                    className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold text-slate-700">{state.name}</p>
                      <p className="text-xs uppercase tracking-widest text-slate-400">{state.code}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.applicableStates.includes(state.code)}
                      onChange={() => toggleStateSelection(state.code)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                ))}
              </div>
              {errors.applicableStates && (
                <p className="mt-1 text-xs text-red-500">{errors.applicableStates}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-600">Restrict to card types</p>
              <p className="text-xs text-slate-500">Leave off to allow every appointment type.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextValue = !formData.limitToAppointmentTypes
                handleFieldChange('limitToAppointmentTypes', nextValue)
                if (!nextValue) {
                  setFormData((prev) => ({ ...prev, applicableAppointmentTypes: [] }))
                }
              }}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                formData.limitToAppointmentTypes ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  formData.limitToAppointmentTypes ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {formData.limitToAppointmentTypes && (
            <div>
              <label className="text-sm font-semibold text-slate-600">Eligible Card Types</label>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                {appointmentTypes.length === 0 && (
                  <p className="text-sm text-slate-500">No appointment types available. Add card types first.</p>
                )}
                {appointmentTypes.map((type) => (
                  <label
                    key={type._id}
                    className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold text-slate-700">{type.name}</p>
                      {typeof type.price === 'number' && (
                        <p className="text-xs text-slate-400">${type.price.toFixed(2)}</p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.applicableAppointmentTypes.includes(type._id)}
                      onChange={() => toggleAppointmentTypeSelection(type._id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                ))}
              </div>
              {errors.applicableAppointmentTypes && (
                <p className="mt-1 text-xs text-red-500">{errors.applicableAppointmentTypes}</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600">Card Type Overrides</p>
                <p className="text-xs text-slate-500">
                  Override the default discount for specific card types. All other types use the base amount.
                </p>
              </div>
              <button
                type="button"
                onClick={addOverride}
                disabled={!overrideSlotsAvailable || appointmentTypes.length === 0}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  !overrideSlotsAvailable || appointmentTypes.length === 0
                    ? 'cursor-not-allowed border-slate-200 text-slate-300'
                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                + Add override
              </button>
            </div>

            {formData.appointmentTypeOverrides.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No overrides configured. Patients will always receive the default discount.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {formData.appointmentTypeOverrides.map((override, index) => {
                  const selectedType = appointmentTypes.find((type) => type._id === override.appointmentTypeId)
                  return (
                    <div key={`override-${index}`} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Card Type</label>
                          <select
                            value={override.appointmentTypeId}
                            onChange={(e) => updateOverrideField(index, 'appointmentTypeId', e.target.value)}
                            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="" disabled>
                              Select card type
                            </option>
                            {appointmentTypes.map((type) => {
                              const optionDisabled = formData.appointmentTypeOverrides.some(
                                (entry, entryIndex) => entry.appointmentTypeId === type._id && entryIndex !== index
                              )
                              return (
                                <option key={type._id} value={type._id} disabled={optionDisabled}>
                                  {type.name}
                                  {typeof type.price === 'number' ? ` · $${type.price.toFixed(2)}` : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOverride(index)}
                          className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Discount Mode</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {(['percentage', 'fixed'] as const).map((type) => (
                              <button
                                key={`${index}-${type}`}
                                type="button"
                                onClick={() => updateOverrideField(index, 'discountType', type)}
                                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                                  override.discountType === type
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 text-slate-500 hover:border-emerald-200'
                                }`}
                              >
                                {type === 'percentage' ? 'Percentage %' : 'Fixed $'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Discount Value</p>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={override.discountValue}
                            onChange={(e) => updateOverrideField(index, 'discountValue', e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder={override.discountType === 'percentage' ? '20' : '50'}
                          />
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Max Discount (optional)</p>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={override.maxDiscount}
                            onChange={(e) => updateOverrideField(index, 'maxDiscount', e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="$250"
                          />
                        </div>
                      </div>

                      {selectedType && (
                        <p className="mt-3 text-xs text-slate-500">
                          {selectedType.name}
                          {typeof selectedType.price === 'number' ? ` · Base price $${selectedType.price.toFixed(2)}` : ''}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {errors.appointmentTypeOverrides && (
              <p className="mt-3 text-xs text-red-500">{errors.appointmentTypeOverrides}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Add helpful redemption notes"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-600">Status</p>
              <p className="text-xs text-slate-500">Inactive coupons stay hidden from patients.</p>
            </div>
            <button
              type="button"
              onClick={() => handleFieldChange('isActive', !formData.isActive)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                formData.isActive ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  formData.isActive ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Saving…' : isEditing ? 'Update Coupon' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
