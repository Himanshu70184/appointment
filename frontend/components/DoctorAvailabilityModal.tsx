'use client'

import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store/store'
import {
  getDoctorAvailabilities,
  createDoctorAvailability,
  updateDoctorAvailability,
  clearAvailabilityError,
  createDefaultWeeklySchedule,
  DaySchedule,
  DoctorAvailability,
} from '@/store/slices/doctorAvailabilitySlice'
import { getStates } from '@/store/slices/stateSlice'
import { State } from '@/types'

interface DoctorAvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  doctorId: string
  doctorName: string
  availability?: DoctorAvailability | null
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function DoctorAvailabilityModal({
  isOpen,
  onClose,
  doctorId,
  doctorName,
  availability,
}: DoctorAvailabilityModalProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { states } = useSelector((state: RootState) => state.states)
  const { loading, error, success } = useSelector((state: RootState) => state.doctorAvailability)

  const activeStates: State[] = states.filter((s: State) => s.isActive)

  const [formData, setFormData] = useState({
    states: [] as string[],
    weeklySchedule: createDefaultWeeklySchedule(),
    startDate: '',
    endDate: '',
    notes: '',
  })

  // Initialize form data when editing
  useEffect(() => {
    if (availability) {
      setFormData({
        states: availability.states || [],
        weeklySchedule: availability.weeklySchedule || createDefaultWeeklySchedule(),
        startDate: availability.startDate?.split('T')[0] || '',
        endDate: availability.endDate?.split('T')[0] || '',
        notes: availability.notes || '',
      })
    } else {
      // Set default dates (today to 3 months from now)
      const today = new Date()
      const threeMonthsLater = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
      
      setFormData({
        states: [],
        weeklySchedule: createDefaultWeeklySchedule(),
        startDate: today.toISOString().split('T')[0],
        endDate: threeMonthsLater.toISOString().split('T')[0],
        notes: '',
      })
    }
  }, [availability])

  // Fetch states on mount
  useEffect(() => {
    if (isOpen && states.length === 0) {
      dispatch(getStates())
    }
  }, [isOpen, dispatch, states.length])

  // Handle success
  useEffect(() => {
    if (success) {
      setTimeout(() => {
        onClose()
        dispatch(clearAvailabilityError())
      }, 1500)
    }
  }, [success, onClose, dispatch])

  const handleStateToggle = (stateCode: string) => {
    setFormData(prev => ({
      ...prev,
      states: prev.states.includes(stateCode)
        ? prev.states.filter(s => s !== stateCode)
        : [...prev.states, stateCode]
    }))
  }

  const handleDayToggle = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      weeklySchedule: prev.weeklySchedule.map((day, idx) =>
        idx === dayIndex ? { ...day, isActive: !day.isActive } : day
      )
    }))
  }

  const handleDayFieldChange = (
    dayIndex: number,
    field: keyof DaySchedule,
    value: string | boolean | null
  ) => {
    setFormData(prev => ({
      ...prev,
      weeklySchedule: prev.weeklySchedule.map((day, idx) =>
        idx === dayIndex ? { ...day, [field]: value } : day
      )
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.states.length === 0) {
      alert('Please select at least one state')
      return
    }

    // Clean up the weekly schedule data
    const cleanedSchedule = formData.weeklySchedule.map(day => ({
      ...day,
      // Convert empty strings or '--:--' to null for break times
      breakStartTime: day.breakStartTime && day.breakStartTime !== '' && day.breakStartTime !== '--:--' 
        ? day.breakStartTime 
        : null,
      breakEndTime: day.breakEndTime && day.breakEndTime !== '' && day.breakEndTime !== '--:--'
        ? day.breakEndTime 
        : null,
    }))

    const payload = {
      doctorId,
      states: formData.states,
      weeklySchedule: cleanedSchedule,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: formData.notes,
    }

    if (availability) {
      await dispatch(updateDoctorAvailability({
        ...payload,
        availabilityId: availability._id,
      }))
    } else {
      await dispatch(createDoctorAvailability(payload))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {availability ? 'Update' : 'Set'} Doctor Availability
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Managing availability for: <span className="font-semibold">{doctorName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Availability {availability ? 'updated' : 'created'} successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          {/* Weekly Schedule */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Weekly Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {formData.weeklySchedule.map((day, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    day.isActive ? 'bg-teal-50 border-teal-500' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-white bg-teal-700 px-3 py-1 rounded text-sm">
                      {dayNames[index].slice(0, 3)}
                    </h4>
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={day.isActive}
                          onChange={() => handleDayToggle(index)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-6 rounded-full shadow-inner transition ${
                          day.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <div className={`absolute w-4 h-4 bg-white rounded-full shadow top-1 transition ${
                          day.isActive ? 'right-1' : 'left-1'
                        }`}></div>
                      </div>
                    </label>
                  </div>

                  {day.isActive && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={day.startTime}
                          onChange={(e) => handleDayFieldChange(index, 'startTime', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-teal-500"
                          required={day.isActive}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          value={day.endTime}
                          onChange={(e) => handleDayFieldChange(index, 'endTime', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-teal-500"
                          required={day.isActive}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Break Start</label>
                        <input
                          type="time"
                          value={day.breakStartTime || ''}
                          onChange={(e) => handleDayFieldChange(index, 'breakStartTime', e.target.value || null)}
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Break End</label>
                        <input
                          type="time"
                          value={day.breakEndTime || ''}
                          onChange={(e) => handleDayFieldChange(index, 'breakEndTime', e.target.value || null)}
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          {/* States Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              States <span className="text-red-500">*</span>
            </label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {activeStates.map((state) => (
                  <label
                    key={state.code}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.states.includes(state.code)}
                      onChange={() => handleStateToggle(state.code)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm">{state.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.states.length} state{formData.states.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Add any special notes or instructions..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Saving...' : availability ? 'Update Availability' : 'Create Availability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
