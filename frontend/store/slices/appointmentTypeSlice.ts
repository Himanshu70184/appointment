import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

interface AppointmentType {
  _id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentTypeState {
  appointmentTypes: AppointmentType[];
  currentType: AppointmentType | null;
  loading: boolean;
  error: string | null;
  success: string | null;
}

const initialState: AppointmentTypeState = {
  appointmentTypes: [],
  currentType: null,
  loading: false,
  error: null,
  success: null
};

// Get all appointment types
export const getAppointmentTypes = createAsyncThunk('appointmentTypes/getAll', async (params: any = {}) => {
  const response = await api.get('/api/appointment-types', { params });
  return response.data.appointmentTypes;
});

// Get single appointment type
export const getAppointmentType = createAsyncThunk('appointmentTypes/getOne', async (id: string) => {
  const response = await api.get(`/api/appointment-types/${id}`);
  return response.data.appointmentType;
});

// Create appointment type
export const createAppointmentType = createAsyncThunk('appointmentTypes/create', async (data: any) => {
  const response = await api.post('/api/appointment-types', data);
  return response.data.appointmentType;
});

// Update appointment type
export const updateAppointmentType = createAsyncThunk('appointmentTypes/update', async ({ id, data }: { id: string; data: any }) => {
  const response = await api.put(`/api/appointment-types/${id}`, data);
  return response.data.appointmentType;
});

// Delete appointment type
export const deleteAppointmentType = createAsyncThunk('appointmentTypes/delete', async (id: string) => {
  await api.delete(`/api/appointment-types/${id}`);
  return id;
});

const appointmentTypeSlice = createSlice({
  name: 'appointmentTypes',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = null;
    }
  },
  extraReducers: (builder) => {
    // Get all
    builder.addCase(getAppointmentTypes.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getAppointmentTypes.fulfilled, (state, action) => {
      state.loading = false;
      state.appointmentTypes = action.payload;
    });
    builder.addCase(getAppointmentTypes.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch appointment types';
    });

    // Get one
    builder.addCase(getAppointmentType.fulfilled, (state, action) => {
      state.currentType = action.payload;
    });

    // Create
    builder.addCase(createAppointmentType.fulfilled, (state, action) => {
      state.appointmentTypes.push(action.payload);
      state.success = 'Appointment type created successfully';
    });

    // Update
    builder.addCase(updateAppointmentType.fulfilled, (state, action) => {
      const index = state.appointmentTypes.findIndex((t) => t._id === action.payload._id);
      if (index !== -1) {
        state.appointmentTypes[index] = action.payload;
      }
      state.success = 'Appointment type updated successfully';
    });

    // Delete
    builder.addCase(deleteAppointmentType.fulfilled, (state, action) => {
      state.appointmentTypes = state.appointmentTypes.filter((t) => t._id !== action.payload);
      state.success = 'Appointment type deleted successfully';
    });
  }
});

export const { clearError, clearSuccess } = appointmentTypeSlice.actions;
export default appointmentTypeSlice.reducer;
