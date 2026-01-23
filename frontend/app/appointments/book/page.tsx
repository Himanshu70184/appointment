'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDispatch, useSelector } from 'react-redux'
import { createAppointment } from '@/store/slices/appointmentSlice'
import DashboardLayout from '@/components/DashboardLayout'
import api from '@/lib/api'
import type { AppDispatch, RootState } from '@/store/store'

const paymentSchema = z.object({
  cardNumber: z.string().regex(/^\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/, 'Invalid card number'),
  expirationDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Invalid expiration date (MM/YY)'),
  cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
})

type PaymentFormData = z.infer<typeof paymentSchema>

export default function BookAppointmentPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const [medicalCards, setMedicalCards] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
  })

  useEffect(() => {
    fetchMedicalCards()
  }, [])

  const fetchMedicalCards = async () => {
    try {
      const response = await api.get('/api/medcards')
      setMedicalCards(response.data.medicalCards || [])
    } catch (error) {
      console.error('Failed to fetch medical cards:', error)
    }
  }

  const onSubmit = async (paymentData: PaymentFormData) => {
    if (!selectedCard) {
      alert('Please select a medical card type')
      return
    }

    setLoading(true)
    try {
      const appointmentData = {
        medicalCardType: selectedCard._id,
        appointmentType: 'Initial Consultation',
        payment: {
          ...paymentData,
          amount: selectedCard.price,
        },
      }

      const result = await dispatch(createAppointment(appointmentData)).unwrap()
      router.push(`/appointments/${result.appointment._id}/intake`)
    } catch (error: any) {
      alert(error.message || 'Failed to create appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Book Appointment</h1>

        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Medical Card Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medicalCards.map((card) => (
              <div
                key={card._id}
                onClick={() => setSelectedCard(card)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedCard?._id === card._id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <h3 className="font-semibold">{card.name}</h3>
                <p className="text-gray-600 text-sm mt-1">{card.description}</p>
                <p className="text-2xl font-bold text-primary-600 mt-2">
                  ${card.price}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Valid for {card.duration} months
                </p>
              </div>
            ))}
          </div>
        </div>

        {selectedCard && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Card Number
                  </label>
                  <input
                    {...register('cardNumber')}
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className="input-field"
                    maxLength={19}
                  />
                  {errors.cardNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.cardNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration (MM/YY)
                  </label>
                  <input
                    {...register('expirationDate')}
                    type="text"
                    placeholder="12/25"
                    className="input-field"
                    maxLength={5}
                  />
                  {errors.expirationDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.expirationDate.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CVV
                </label>
                <input
                  {...register('cvv')}
                  type="text"
                  placeholder="123"
                  className="input-field w-32"
                  maxLength={4}
                />
                {errors.cvv && (
                  <p className="mt-1 text-sm text-red-600">{errors.cvv.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    {...register('firstName')}
                    type="text"
                    className="input-field"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    {...register('lastName')}
                    type="text"
                    className="input-field"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  {...register('address')}
                  type="text"
                  className="input-field"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    {...register('city')}
                    type="text"
                    className="input-field"
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    {...register('state')}
                    type="text"
                    maxLength={2}
                    className="input-field"
                    placeholder="CA"
                  />
                  {errors.state && (
                    <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <input
                    {...register('zip')}
                    type="text"
                    className="input-field"
                  />
                  {errors.zip && (
                    <p className="mt-1 text-sm text-red-600">{errors.zip.message}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount:</span>
                  <span className="text-2xl font-bold text-primary-600">
                    ${selectedCard.price}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Processing...' : 'Pay and Continue'}
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
