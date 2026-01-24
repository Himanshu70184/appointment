'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSelector } from 'react-redux'
import DashboardLayout from '@/components/DashboardLayout'
import api from '@/lib/api'
import type { RootState } from '@/store/store'

const bookingSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  state: z.string().min(1, 'State is required'),
  appointmentDate: z.string().min(1, 'Date is required'),
  appointmentTime: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

export default function AdminBookAppointmentPage() {
  const router = useRouter()
  const { user } = useSelector((state: RootState) => state.auth)
  const [patients, setPatients] = useState<any[]>([])
  const [states, setStates] = useState<any[]>([])
  const [selectedState, setSelectedState] = useState<any>(null)
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [medicalCards, setMedicalCards] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  })

  const watchedState = watch('state')
  const watchedDate = watch('appointmentDate')

  useEffect(() => {
    // Check if user is admin or staff
    if (user && user.role_id !== 1 && user.role_id !== 4) {
      router.push('/dashboard')
      return
    }
    fetchPatients()
    fetchStates()
  }, [user])

  useEffect(() => {
    if (watchedState) {
      const state = states.find(s => s._id === watchedState)
      setSelectedState(state)
      fetchMedicalCards(watchedState)
    }
  }, [watchedState, states])

  useEffect(() => {
    if (watchedDate && selectedState) {
      fetchAvailableSlots()
    }
  }, [watchedDate, selectedState])

  const fetchPatients = async () => {
    try {
      const response = await api.get('/api/users?role=patient')
      setPatients(response.data.users || [])
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    }
  }

  const fetchStates = async () => {
    try {
      const response = await api.get('/api/states?active=true')
      setStates(response.data.states || [])
    } catch (error) {
      console.error('Failed to fetch states:', error)
    }
  }

  const fetchMedicalCards = async (stateId: string) => {
    try {
      const response = await api.get(`/api/medcards?state=${stateId}`)
      setMedicalCards(response.data.medicalCards || [])
    } catch (error) {
      console.error('Failed to fetch medical cards:', error)
    }
  }

  const fetchAvailableSlots = async () => {
    if (!watchedDate || !selectedState) return
    
    setLoadingSlots(true)
    try {
      const response = await api.get('/api/patient-portal/available-slots', {
        params: {
          date: watchedDate,
          stateId: selectedState._id
        }
      })
      setAvailableSlots(response.data.availableSlots || [])
    } catch (error) {
      console.error('Failed to fetch available slots:', error)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const onSubmit = async (data: BookingFormData) => {
    if (!selectedSlot) {
      alert('Please select a time slot')
      return
    }

    if (!selectedCard) {
      alert('Please select a medical card type')
      return
    }

    setLoading(true)
    try {
      const appointmentData = {
        patient_id: data.patient_id,
        doctor_id: selectedSlot.doctor._id,
        state_id: selectedState._id,
        medicalCard_id: selectedCard._id,
        appointmentDate: data.appointmentDate,
        appointmentTime: data.appointmentTime,
        notes: data.notes,
        status: 'pending', // Requires admin approval
        bookedBy: user._id, // Track who created the booking
      }

      const response = await api.post('/api/appointments/admin-book', appointmentData)
      alert('Appointment created successfully! Pending approval.')
      router.push('/appointments')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Book Appointment for Patient</h1>
          <p className="text-gray-600 mt-2">
            Admin/Staff booking - No payment required. Appointment will be pending approval.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Patient Selection */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">1. Select Patient</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient
              </label>
              <select
                {...register('patient_id')}
                className="input-field"
              >
                <option value="">-- Select Patient --</option>
                {patients.map((patient) => (
                  <option key={patient._id} value={patient._id}>
                    {patient.firstName} {patient.lastName} - {patient.email}
                  </option>
                ))}
              </select>
              {errors.patient_id && (
                <p className="mt-1 text-sm text-red-600">{errors.patient_id.message}</p>
              )}
            </div>
          </div>

          {/* State Selection */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">2. Select State</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {states.map((state) => (
                <div
                  key={state._id}
                  onClick={() => setValue('state', state._id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    watchedState === state._id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <h3 className="font-semibold">{state.name}</h3>
                  <p className="text-sm text-gray-600">{state.code}</p>
                </div>
              ))}
            </div>
            {errors.state && (
              <p className="mt-2 text-sm text-red-600">{errors.state.message}</p>
            )}
          </div>

          {/* Medical Card Type Selection */}
          {selectedState && medicalCards.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">3. Select Medical Card Type</h2>
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
          )}

          {/* Date Selection */}
          {selectedState && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">4. Select Date</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Date
                </label>
                <input
                  {...register('appointmentDate')}
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  className="input-field"
                />
                {errors.appointmentDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.appointmentDate.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Time Slot Selection */}
          {watchedDate && availableSlots.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">5. Select Time Slot</h2>
              {loadingSlots ? (
                <p className="text-gray-600">Loading available slots...</p>
              ) : (
                <div className="space-y-4">
                  {availableSlots.map((slot) => (
                    <div
                      key={`${slot.doctor._id}-${slot.time}`}
                      onClick={() => {
                        setSelectedSlot(slot)
                        setValue('appointmentTime', slot.time)
                      }}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedSlot?.time === slot.time && selectedSlot?.doctor._id === slot.doctor._id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-lg">{slot.time}</p>
                          <p className="text-sm text-gray-600">
                            Dr. {slot.doctor.firstName} {slot.doctor.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{slot.doctor.specialty}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.appointmentTime && (
                <p className="mt-2 text-sm text-red-600">{errors.appointmentTime.message}</p>
              )}
            </div>
          )}

          {watchedDate && !loadingSlots && availableSlots.length === 0 && (
            <div className="card">
              <p className="text-gray-600">No available slots for the selected date.</p>
            </div>
          )}

          {/* Notes */}
          {selectedSlot && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">6. Additional Notes (Optional)</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  rows={4}
                  className="input-field"
                  placeholder="Any special requirements or notes..."
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          {selectedSlot && selectedCard && (
            <div className="card bg-primary-50 border-primary-200">
              <div className="mb-4">
                <h3 className="font-semibold text-lg mb-2">Booking Summary</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>State:</strong> {selectedState.name}</p>
                  <p><strong>Card Type:</strong> {selectedCard.name}</p>
                  <p><strong>Date:</strong> {watchedDate}</p>
                  <p><strong>Time:</strong> {selectedSlot.time}</p>
                  <p><strong>Doctor:</strong> Dr. {selectedSlot.doctor.firstName} {selectedSlot.doctor.lastName}</p>
                  <p><strong>Amount:</strong> ${selectedCard.price}</p>
                  <p className="text-orange-600 font-medium mt-2">
                    ⚠️ No payment required. Appointment will be pending approval.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Creating Appointment...' : 'Create Appointment (Pending Approval)'}
              </button>
            </div>
          )}
        </form>
      </div>
    </DashboardLayout>
  )
}
