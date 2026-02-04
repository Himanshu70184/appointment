import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'
import type { Appointment } from '@/types'

interface AppointmentState {
  appointments: Appointment[]
  currentAppointment: Appointment | null
  loading: boolean
  error: string | null
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
    nextPage: number | null
    prevPage: number | null
  } | null
}

export const createAppointment = createAsyncThunk(
  'appointments/create',
  async (appointmentData: any) => {
    const response = await api.post('/api/appointments', appointmentData)
    return response.data
  }
)

export const getAppointments = createAsyncThunk(
  'appointments/getAll',
  async ({ page, limit }: { page?: number; limit?: number } = {}) => {
    const response = await api.get('/api/appointments', {
      params: { page, limit }
    })
    return {
      appointments: response.data.appointments,
      pagination: response.data.pagination || null
    }
  }
)

export const getAppointment = createAsyncThunk(
  'appointments/getOne',
  async (id: string) => {
    const response = await api.get(`/api/appointments/${id}`)
    return response.data.appointment
  }
)

export const submitIntakeForm = createAsyncThunk(
  'appointments/submitIntake',
  async ({ id, formData }: { id: string; formData: FormData }) => {
    const response = await api.post(`/api/appointments/${id}/intake`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }
)

const initialState: AppointmentState = {
  appointments: [],
  currentAppointment: null,
  loading: false,
  error: null,
  pagination: null,
}

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createAppointment.pending, (state) => {
        state.loading = true
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.loading = false
        state.appointments.unshift(action.payload.appointment)
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to create appointment'
      })
      .addCase(getAppointments.pending, (state) => {
        state.loading = true
      })
      .addCase(getAppointments.fulfilled, (state, action) => {
        state.loading = false
        state.appointments = action.payload.appointments
        state.pagination = action.payload.pagination
      })
      .addCase(getAppointments.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch appointments'
      })
      .addCase(getAppointment.pending, (state) => {
        state.loading = true
      })
      .addCase(getAppointment.fulfilled, (state, action) => {
        state.loading = false
        state.currentAppointment = action.payload
      })
      .addCase(getAppointment.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch appointment'
      })
  },
})

export const { clearCurrentAppointment } = appointmentSlice.actions
export default appointmentSlice.reducer
