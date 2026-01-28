import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'
import type { IntakeFormSubmission } from '@/types'

interface IntakeFormSubmissionState {
  submissions: IntakeFormSubmission[]
  currentSubmission: IntakeFormSubmission | null
  loading: boolean
  error: string | null
  success: boolean
  message: string
}

const initialState: IntakeFormSubmissionState = {
  submissions: [],
  currentSubmission: null,
  loading: false,
  error: null,
  success: false,
  message: ''
}

// Async thunks
export const submitIntakeForm = createAsyncThunk(
  'intakeFormSubmissions/submit',
  async (data: { formData: FormData; saveAsDraft?: boolean }) => {
    const response = await api.post('/api/intake-form-submissions', data.formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  }
)

export const getSubmissionByAppointment = createAsyncThunk(
  'intakeFormSubmissions/getByAppointment',
  async (appointmentId: string) => {
    const response = await api.get(`/api/intake-form-submissions/appointment/${appointmentId}`)
    return response.data.submission
  }
)

export const getSubmissionPDF = createAsyncThunk(
  'intakeFormSubmissions/getPDF',
  async (submissionId: string) => {
    const response = await api.get(`/api/intake-form-submissions/${submissionId}/pdf`, {
      responseType: 'blob'
    })
    return response.data
  }
)

export const reviewIntakeFormSubmission = createAsyncThunk(
  'intakeFormSubmissions/review',
  async (data: { id: string; status: string; reviewNotes?: string }) => {
    const response = await api.put(`/api/intake-form-submissions/${data.id}/review`, {
      status: data.status,
      reviewNotes: data.reviewNotes
    })
    return response.data
  }
)

export const getAllSubmissions = createAsyncThunk(
  'intakeFormSubmissions/getAll',
  async (filters?: { status?: string; patientId?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.patientId) params.append('patientId', filters.patientId)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    
    const response = await api.get(`/api/intake-form-submissions?${params.toString()}`)
    return response.data.submissions
  }
)

const intakeFormSubmissionSlice = createSlice({
  name: 'intakeFormSubmissions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearSuccess: (state) => {
      state.success = false
      state.message = ''
    }
  },
  extraReducers: (builder) => {
    builder
      // Submit form
      .addCase(submitIntakeForm.pending, (state) => {
        state.loading = true
        state.error = null
        state.success = false
      })
      .addCase(submitIntakeForm.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        state.currentSubmission = action.payload.submission
      })
      .addCase(submitIntakeForm.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to submit intake form'
      })
      
      // Get submission by appointment
      .addCase(getSubmissionByAppointment.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getSubmissionByAppointment.fulfilled, (state, action) => {
        state.loading = false
        state.currentSubmission = action.payload
      })
      .addCase(getSubmissionByAppointment.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch submission'
      })
      
      // Review submission
      .addCase(reviewIntakeFormSubmission.fulfilled, (state, action) => {
        state.success = true
        state.message = action.payload.message
        if (state.currentSubmission) {
          state.currentSubmission = action.payload.submission
        }
      })
      
      // Get all submissions
      .addCase(getAllSubmissions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getAllSubmissions.fulfilled, (state, action) => {
        state.loading = false
        state.submissions = action.payload
      })
      .addCase(getAllSubmissions.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch submissions'
      })
  }
})

export const { clearError, clearSuccess } = intakeFormSubmissionSlice.actions
export default intakeFormSubmissionSlice.reducer
