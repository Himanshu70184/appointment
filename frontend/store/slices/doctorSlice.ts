import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

interface Doctor {
  _id: string;
  user_id: { _id: string; name: string; email: string; phone: string };
  licenseNumber: string;
  specialties: string[];
  states: string[];
  pricing: Record<string, number>;
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone: string;
  }>;
  blockedDates: string[];
  isActive: boolean;
  createdAt: string;
}

interface DoctorState {
  doctors: Doctor[];
  loading: boolean;
  error: string | null;
}

const initialState: DoctorState = {
  doctors: [],
  loading: false,
  error: null,
};

export const fetchDoctors = createAsyncThunk('doctors/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/doctors');
    return response.data.doctors;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const createDoctor = createAsyncThunk('doctors/create', async (formData: any, { rejectWithValue }) => {
  try {
    const response = await api.post('/api/doctors', formData);
    return response.data.doctor;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const updateDoctor = createAsyncThunk('doctors/update', async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/api/doctors/${id}`, data);
    return response.data.doctor;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const deleteDoctor = createAsyncThunk('doctors/delete', async (id: string, { rejectWithValue }) => {
  try {
    await api.delete(`/api/doctors/${id}`);
    return id;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message);
  }
});

export const toggleDoctorActive = createAsyncThunk('doctors/toggleActive', async (id: string, { rejectWithValue }) => {
  try {
    const response = await api.put(`/api/doctors/${id}/toggle-active`);
    return response.data.doctor;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || error.message);
  }
});

const doctorSlice = createSlice({
  name: 'doctors',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDoctors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDoctors.fulfilled, (state, action) => {
        state.loading = false;
        state.doctors = action.payload;
      })
      .addCase(fetchDoctors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createDoctor.fulfilled, (state, action) => {
        state.doctors.push(action.payload);
      })
      .addCase(updateDoctor.fulfilled, (state, action) => {
        const index = state.doctors.findIndex((d) => d._id === action.payload._id);
        if (index !== -1) state.doctors[index] = action.payload;
      })
      .addCase(deleteDoctor.fulfilled, (state, action) => {
        state.doctors = state.doctors.filter((d) => d._id !== action.payload);
      })
      .addCase(toggleDoctorActive.fulfilled, (state, action) => {
        const index = state.doctors.findIndex((d) => d._id === action.payload._id);
        if (index !== -1) state.doctors[index] = action.payload;
      });
  },
});

export const selectDoctors = (state: any) => state.doctors.doctors;
export const selectDoctorsLoading = (state: any) => state.doctors.loading;
export const selectDoctorsError = (state: any) => state.doctors.error;

export default doctorSlice.reducer;