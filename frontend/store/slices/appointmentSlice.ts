import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${Cookies.get('token')}`,
  },
})

export const createAppointment = createAsyncThunk(
  'appointments/create',
  async (appointmentData: any) => {
    const response = await axios.post(
      `${API_URL}/api/appointments`,
      appointmentData,
      getAuthHeaders()
    )
    return response.data
  }
)

export const getAppointments = createAsyncThunk(
  'appointments/getAll',
  async () => {
    const response = await axios.get(
      `${API_URL}/api/appointments`,
      getAuthHeaders()
    )
    return response.data.appointments
  }
)

export const getAppointment = createAsyncThunk(
  'appointments/getOne',
  async (id: string) => {
    const response = await axios.get(
      `${API_URL}/api/appointments/${id}`,
      getAuthHeaders()
    )
    return response.data.appointment
  }
)

export const submitIntakeForm = createAsyncThunk(
  'appointments/submitIntake',
  async ({ id, formData }: { id: string; formData: FormData }) => {
    const response = await axios.post(
      `${API_URL}/api/appointments/${id}/intake`,
      formData,
      {
        ...getAuthHeaders(),
        headers: {
          ...getAuthHeaders().headers,
          'Content-Type': 'multipart/form-data',
        },
      }
    )
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
      .addCase(getAppointments.fulfilled, (state: any, action) => {
        state.appointments = action.payload
      })
      .addCase(getAppointment.fulfilled, (state: any, action) => {
        state.currentAppointment = action.payload
      })
  },
})

export const { clearCurrentAppointment } = appointmentSlice.actions
export default appointmentSlice.reducer
