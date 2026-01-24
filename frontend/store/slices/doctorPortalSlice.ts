import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

interface DashboardStats {
  total: number;
  scheduled: number;
  pending: number;
  onHold: number;
  cancelled: number;
  completed: number;
}

interface Appointment {
  _id: string;
  patient_id: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
  };
  appointmentType: string;
  medicalCardType: {
    _id: string;
    name: string;
    price: number;
  };
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  state: string;
  adjustedAmount?: number;
  intakeForm?: any;
  documents?: any[];
  clinicalNotes?: string;
  pdmpVerified: boolean;
  certificationFiled: boolean;
  documentRequests?: any[];
}

interface DoctorPortalState {
  stats: DashboardStats | null;
  upcomingAppointments: Appointment[];
  appointments: Appointment[];
  currentAppointment: Appointment | null;
  loading: boolean;
  error: string | null;
  profile: any;
}

const initialState: DoctorPortalState = {
  stats: null,
  upcomingAppointments: [],
  appointments: [],
  currentAppointment: null,
  loading: false,
  error: null,
  profile: null,
};

// Async thunks
export const fetchDashboard = createAsyncThunk('doctorPortal/fetchDashboard', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/doctor-portal/dashboard');
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
  }
});

export const fetchAppointments = createAsyncThunk(
  'doctorPortal/fetchAppointments',
  async (filters: { status?: string; state?: string; date?: string; search?: string }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.state) params.append('state', filters.state);
      if (filters.date) params.append('date', filters.date);
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/api/doctor-portal/appointments?${params.toString()}`);
      return response.data.appointments;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch appointments');
    }
  }
);

export const fetchAppointmentDetails = createAsyncThunk(
  'doctorPortal/fetchAppointmentDetails',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/doctor-portal/appointments/${id}`);
      return response.data.appointment;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch appointment details');
    }
  }
);

export const verifyPDMP = createAsyncThunk('doctorPortal/verifyPDMP', async (id: string, { rejectWithValue }) => {
  try {
    const response = await api.put(`/api/doctor-portal/appointments/${id}/pdmp`);
    return response.data.appointment;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to verify PDMP');
  }
});

export const fileCertification = createAsyncThunk(
  'doctorPortal/fileCertification',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/doctor-portal/appointments/${id}/certify`);
      return response.data.appointment;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to file certification');
    }
  }
);

export const saveClinicalNotes = createAsyncThunk(
  'doctorPortal/saveClinicalNotes',
  async ({ id, clinicalNotes }: { id: string; clinicalNotes: string }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/doctor-portal/appointments/${id}/clinical-notes`, { clinicalNotes });
      return response.data.appointment;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to save clinical notes');
    }
  }
);

export const requestDocuments = createAsyncThunk(
  'doctorPortal/requestDocuments',
  async ({ id, message }: { id: string; message: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/doctor-portal/appointments/${id}/request-documents`, { message });
      return response.data.appointment;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to request documents');
    }
  }
);

export const updateAppointmentStatus = createAsyncThunk(
  'doctorPortal/updateStatus',
  async ({ id, status }: { id: string; status: string }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/doctor-portal/appointments/${id}/status`, { status });
      return response.data.appointment;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update status');
    }
  }
);

export const fetchProfile = createAsyncThunk('doctorPortal/fetchProfile', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/doctor-portal/profile');
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
  }
});

export const updateProfile = createAsyncThunk(
  'doctorPortal/updateProfile',
  async (data: { name?: string; phone?: string }, { rejectWithValue }) => {
    try {
      const response = await api.put('/api/doctor-portal/profile', data);
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update profile');
    }
  }
);

export const changePassword = createAsyncThunk(
  'doctorPortal/changePassword',
  async (data: { newPassword: string; confirmPassword: string }, { rejectWithValue }) => {
    try {
      const response = await api.put('/api/doctor-portal/change-password', data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to change password');
    }
  }
);

const doctorPortalSlice = createSlice({
  name: 'doctorPortal',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Dashboard
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
        state.upcomingAppointments = action.payload.upcomingAppointments;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Appointments
      .addCase(fetchAppointments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = action.payload;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Appointment Details
      .addCase(fetchAppointmentDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAppointmentDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAppointment = action.payload;
      })
      .addCase(fetchAppointmentDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // PDMP, Certification, Notes, etc.
      .addCase(verifyPDMP.fulfilled, (state, action) => {
        if (state.currentAppointment) {
          state.currentAppointment = action.payload;
        }
      })
      .addCase(fileCertification.fulfilled, (state, action) => {
        if (state.currentAppointment) {
          state.currentAppointment = action.payload;
        }
      })
      .addCase(saveClinicalNotes.fulfilled, (state, action) => {
        if (state.currentAppointment) {
          state.currentAppointment = action.payload;
        }
      })
      .addCase(requestDocuments.fulfilled, (state, action) => {
        if (state.currentAppointment) {
          state.currentAppointment = action.payload;
        }
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        if (state.currentAppointment) {
          state.currentAppointment = action.payload;
        }
      })
      // Profile
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        if (state.profile) {
          state.profile.user = action.payload;
        }
      });
  },
});

export const { clearError, clearCurrentAppointment } = doctorPortalSlice.actions;

// Selectors
export const selectDashboardStats = (state: any) => state.doctorPortal.stats;
export const selectUpcomingAppointments = (state: any) => state.doctorPortal.upcomingAppointments;
export const selectAppointments = (state: any) => state.doctorPortal.appointments;
export const selectCurrentAppointment = (state: any) => state.doctorPortal.currentAppointment;
export const selectDoctorPortalLoading = (state: any) => state.doctorPortal.loading;
export const selectDoctorPortalError = (state: any) => state.doctorPortal.error;
export const selectDoctorProfile = (state: any) => state.doctorPortal.profile;

export default doctorPortalSlice.reducer;
