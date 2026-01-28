import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'
import type { IntakeFormTemplate } from '@/types'

interface IntakeFormTemplateState {
  templates: IntakeFormTemplate[]
  currentTemplate: IntakeFormTemplate | null
  activeTemplate: IntakeFormTemplate | null
  loading: boolean
  error: string | null
  success: boolean
  message: string
}

const initialState: IntakeFormTemplateState = {
  templates: [],
  currentTemplate: null,
  activeTemplate: null,
  loading: false,
  error: null,
  success: false,
  message: ''
}

// Async thunks
export const getIntakeFormTemplates = createAsyncThunk(
  'intakeFormTemplates/getAll',
  async (filters?: { isActive?: boolean; appointmentType?: string; state?: string }) => {
    const params = new URLSearchParams()
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString())
    if (filters?.appointmentType) params.append('appointmentType', filters.appointmentType)
    if (filters?.state) params.append('state', filters.state)
    
    const response = await api.get(`/api/intake-form-templates?${params.toString()}`)
    return response.data.templates
  }
)

export const getActiveIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/getActive',
  async (params?: { appointmentType?: string; state?: string }) => {
    const queryParams = new URLSearchParams()
    if (params?.appointmentType) queryParams.append('appointmentType', params.appointmentType)
    if (params?.state) queryParams.append('state', params.state)
    
    const response = await api.get(`/api/intake-form-templates/active?${queryParams.toString()}`)
    return response.data.template
  }
)

export const getIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/getOne',
  async (id: string) => {
    const response = await api.get(`/api/intake-form-templates/${id}`)
    return response.data.template
  }
)

export const createIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/create',
  async (templateData: Partial<IntakeFormTemplate>) => {
    const response = await api.post('/api/intake-form-templates', templateData)
    return response.data
  }
)

export const updateIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/update',
  async ({ id, data }: { id: string; data: Partial<IntakeFormTemplate> }) => {
    const response = await api.put(`/api/intake-form-templates/${id}`, data)
    return response.data
  }
)

export const deleteIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/delete',
  async (id: string) => {
    const response = await api.delete(`/api/intake-form-templates/${id}`)
    return { id, message: response.data.message }
  }
)

export const duplicateIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/duplicate',
  async (id: string) => {
    const response = await api.post(`/api/intake-form-templates/${id}/duplicate`)
    return response.data
  }
)

export const setDefaultIntakeFormTemplate = createAsyncThunk(
  'intakeFormTemplates/setDefault',
  async (id: string) => {
    const response = await api.put(`/api/intake-form-templates/${id}/set-default`)
    return response.data
  }
)

const intakeFormTemplateSlice = createSlice({
  name: 'intakeFormTemplates',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearSuccess: (state) => {
      state.success = false
      state.message = ''
    },
    setCurrentTemplate: (state, action) => {
      state.currentTemplate = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      // Get all templates
      .addCase(getIntakeFormTemplates.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getIntakeFormTemplates.fulfilled, (state, action) => {
        state.loading = false
        state.templates = action.payload
      })
      .addCase(getIntakeFormTemplates.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch templates'
      })
      
      // Get active template
      .addCase(getActiveIntakeFormTemplate.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getActiveIntakeFormTemplate.fulfilled, (state, action) => {
        state.loading = false
        state.activeTemplate = action.payload
      })
      .addCase(getActiveIntakeFormTemplate.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch active template'
      })
      
      // Get single template
      .addCase(getIntakeFormTemplate.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getIntakeFormTemplate.fulfilled, (state, action) => {
        state.loading = false
        state.currentTemplate = action.payload
      })
      .addCase(getIntakeFormTemplate.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch template'
      })
      
      // Create template
      .addCase(createIntakeFormTemplate.pending, (state) => {
        state.loading = true
        state.error = null
        state.success = false
      })
      .addCase(createIntakeFormTemplate.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        state.templates.unshift(action.payload.template)
      })
      .addCase(createIntakeFormTemplate.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to create template'
      })
      
      // Update template
      .addCase(updateIntakeFormTemplate.pending, (state) => {
        state.loading = true
        state.error = null
        state.success = false
      })
      .addCase(updateIntakeFormTemplate.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        const index = state.templates.findIndex(t => t._id === action.payload.template._id)
        if (index !== -1) {
          state.templates[index] = action.payload.template
        }
        if (state.currentTemplate?._id === action.payload.template._id) {
          state.currentTemplate = action.payload.template
        }
      })
      .addCase(updateIntakeFormTemplate.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to update template'
      })
      
      // Delete template
      .addCase(deleteIntakeFormTemplate.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteIntakeFormTemplate.fulfilled, (state, action) => {
        state.loading = false
        state.success = true
        state.message = action.payload.message
        state.templates = state.templates.filter(t => t._id !== action.payload.id)
      })
      .addCase(deleteIntakeFormTemplate.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to delete template'
      })
      
      // Duplicate template
      .addCase(duplicateIntakeFormTemplate.fulfilled, (state, action) => {
        state.success = true
        state.message = action.payload.message
        state.templates.unshift(action.payload.template)
      })
      
      // Set default template
      .addCase(setDefaultIntakeFormTemplate.fulfilled, (state, action) => {
        state.success = true
        state.message = action.payload.message
        // Update all templates to reflect new default
        state.templates = state.templates.map(t => ({
          ...t,
          isDefault: t._id === action.payload.template._id
        }))
      })
  }
})

export const { clearError, clearSuccess, setCurrentTemplate } = intakeFormTemplateSlice.actions
export default intakeFormTemplateSlice.reducer
