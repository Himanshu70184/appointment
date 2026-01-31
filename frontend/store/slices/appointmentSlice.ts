import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'
import type { Appointment } from '@/types'

interface AppointmentState {
  appointments: Appointment[]
  currentAppointment: Appointment | null
  loading: boolean
  error: string | null
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
  async () => {
    const response = await api.get('/api/appointments')
    return response.data.appointments
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
        state.appointments = action.payload
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
