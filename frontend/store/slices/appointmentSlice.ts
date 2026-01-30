import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'

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

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState: {
    appointments: [],
    currentAppointment: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createAppointment.pending, (state: any) => {
        state.loading = true
      })
      .addCase(createAppointment.fulfilled, (state: any, action) => {
        state.loading = false
        state.appointments.unshift(action.payload.appointment)
      })
      .addCase(createAppointment.rejected, (state: any, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(getAppointments.pending, (state: any) => {
        state.loading = true
      })
      .addCase(getAppointments.fulfilled, (state: any, action) => {
        state.loading = false
        state.appointments = action.payload
      })
      .addCase(getAppointments.rejected, (state: any, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(getAppointment.pending, (state: any) => {
        state.loading = true
      })
      .addCase(getAppointment.fulfilled, (state: any, action) => {
        state.loading = false
        state.currentAppointment = action.payload
      })
      .addCase(getAppointment.rejected, (state: any, action) => {
        state.loading = false
        state.error = action.error.message
      })
  },
})

export const { clearCurrentAppointment } = appointmentSlice.actions
export default appointmentSlice.reducer
