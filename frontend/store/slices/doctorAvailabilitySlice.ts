import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import api from '@/lib/api'

export interface DaySchedule {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isActive: boolean
  startTime: string // "HH:MM" format (24-hour)
  endTime: string // "HH:MM" format (24-hour)
  breakStartTime: string | null
  breakEndTime: string | null
}

export interface DoctorAvailability {
  _id: string
  doctor_id: string
  states: string[]
  weeklySchedule: DaySchedule[]
  startDate: string
  endDate: string
  isActive: boolean
  notes?: string
  createdBy?: any
  updatedBy?: any
  createdAt?: string
  updatedAt?: string
}

interface DoctorAvailabilityState {
  availabilities: DoctorAvailability[]
  currentAvailability: DoctorAvailability | null
  loading: boolean
  error: string | null
  success: boolean
  message: string
}

const initialState: DoctorAvailabilityState = {
  availabilities: [],
  currentAvailability: null,
  loading: false,
  error: null,
  success: false,
  message: '',
}

// Helper to create default weekly schedule
export const createDefaultWeeklySchedule = (): DaySchedule[] => {
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({
    dayOfWeek: day,
    isActive: day >= 1 && day <= 5, // Monday to Friday active by default
    startTime: '08:00',
    endTime: '18:00',
    breakStartTime: null,
    breakEndTime: null,
  }))
}

// Async thunks
export const getDoctorAvailabilities = createAsyncThunk(
  'doctorAvailability/getAll',
  async (params: { doctorId: string; active?: boolean; current?: boolean }) => {
    const queryParams = new URLSearchParams()
    if (params.active !== undefined) queryParams.append('active', String(params.active))
    if (params.current !== undefined) queryParams.append('current', String(params.current))
    
    const response = await api.get(
      `/api/doctors/${params.doctorId}/availability?${queryParams.toString()}`
    )
    return response.data
  }
)

export const getDoctorAvailability = createAsyncThunk(
  'doctorAvailability/getOne',
  async (params: { doctorId: string; availabilityId: string }) => {
    const response = await api.get(
      `/api/doctors/${params.doctorId}/availability/${params.availabilityId}`
    )
    return response.data
  }
)

export const createDoctorAvailability = createAsyncThunk(
  'doctorAvailability/create',
  async (data: {
    doctorId: string
    states: string[]
    weeklySchedule: DaySchedule[]
    startDate: string
    endDate: string
    notes?: string
  }, { rejectWithValue }) => {
    try {
      const { doctorId, ...payload } = data
      const response = await api.post(
        `/api/doctors/${doctorId}/availability`,
        payload
      )
      return response.data
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.response?.data?.errors?.[0]?.msg ||
        error.message || 
        'Failed to create availability'
      )
    }
  }
)

export const updateDoctorAvailability = createAsyncThunk(
  'doctorAvailability/update',
  async (data: {
    doctorId: string
    availabilityId: string
    states?: string[]
    weeklySchedule?: DaySchedule[]
    startDate?: string
    endDate?: string
    notes?: string
    isActive?: boolean
  }, { rejectWithValue }) => {
    try {
      const { doctorId, availabilityId, ...payload } = data
      const response = await api.put(
        `/api/doctors/${doctorId}/availability/${availabilityId}`,
        payload
      )
      return response.data
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.response?.data?.errors?.[0]?.msg ||
        error.message || 
        'Failed to update availability'
      )
    }
  }
)

export const deleteDoctorAvailability = createAsyncThunk(
  'doctorAvailability/delete',
  async (params: { doctorId: string; availabilityId: string }) => {
    const response = await api.delete(
      `/api/doctors/${params.doctorId}/availability/${params.availabilityId}`
    )
    return { ...response.data, availabilityId: params.availabilityId }
  }
)

export const toggleAvailabilityStatus = createAsyncThunk(
  'doctorAvailability/toggle',
  async (params: { doctorId: string; availabilityId: string }) => {
    const response = await api.put(
      `/api/doctors/${params.doctorId}/availability/${params.availabilityId}/toggle`
    )
    return response.data
  }
)

export const checkDoctorAvailability = createAsyncThunk(
  'doctorAvailability/check',
  async (params: { stateCode: string; date: string; time: string }) => {
    const response = await api.get('/api/doctor-availability/check', {
      params
    })
    return response.data
  }
)

const doctorAvailabilitySlice = createSlice({
  name: 'doctorAvailability',
  initialState,
  reducers: {
    clearAvailabilityError: (state) => {
      state.error = null
      state.success = false
      state.message = ''
    },
    clearCurrentAvailability: (state) => {
      state.currentAvailability = null
    },
    setCurrentAvailability: (state, action: PayloadAction<DoctorAvailability>) => {
      state.currentAvailability = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Get all availabilities
      .addCase(getDoctorAvailabilities.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getDoctorAvailabilities.fulfilled, (state, action) => {
        state.loading = false
        state.availabilities = action.payload.availabilities
      })
      .addCase(getDoctorAvailabilities.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch availabilities'
      })
      
      // Get single availability
      .addCase(getDoctorAvailability.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getDoctorAvailability.fulfilled, (state, action) => {
        state.loading = false
        state.currentAvailability = action.payload.availability
      })
      .addCase(getDoctorAvailability.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch availability'
      })
      
      // Create availability
      .addCase(createDoctorAvailability.pending, (state) => {
        state.loading = true
        state.error = null
        state.success = false
      })
      .addCase(createDoctorAvailability.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        state.availabilities.unshift(action.payload.availability)
        state.currentAvailability = action.payload.availability
      })
      .addCase(createDoctorAvailability.rejected, (state, action: any) => {
        state.loading = false
        state.error = action.payload || action.error?.message || 'Failed to create availability'
        state.success = false
      })
      
      // Update availability
      .addCase(updateDoctorAvailability.pending, (state) => {
        state.loading = true
        state.error = null
        state.success = false
      })
      .addCase(updateDoctorAvailability.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        const index = state.availabilities.findIndex(
          a => a._id === action.payload.availability._id
        )
        if (index !== -1) {
          state.availabilities[index] = action.payload.availability
        }
        state.currentAvailability = action.payload.availability
      })
      .addCase(updateDoctorAvailability.rejected, (state, action: any) => {
        state.loading = false
        state.error = action.payload || action.error?.message || 'Failed to update availability'
        state.success = false
      })
      
      // Delete availability
      .addCase(deleteDoctorAvailability.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteDoctorAvailability.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        state.availabilities = state.availabilities.filter(
          a => a._id !== action.payload.availabilityId
        )
        if (state.currentAvailability?._id === action.payload.availabilityId) {
          state.currentAvailability = null
        }
      })
      .addCase(deleteDoctorAvailability.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to delete availability'
      })
      
      // Toggle status
      .addCase(toggleAvailabilityStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(toggleAvailabilityStatus.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        const index = state.availabilities.findIndex(
          a => a._id === action.payload.availability._id
        )
        if (index !== -1) {
          state.availabilities[index] = action.payload.availability
        }
      })
      .addCase(toggleAvailabilityStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to toggle status'
      })
  },
})

export const { 
  clearAvailabilityError, 
  clearCurrentAvailability,
  setCurrentAvailability 
} = doctorAvailabilitySlice.actions

export default doctorAvailabilitySlice.reducer
