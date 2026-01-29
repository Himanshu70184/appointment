import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

export interface AppointmentStats {
  total: number;
  scheduled: number;
  approval: number;
  rescheduled: number;
  cancelled: number;
  completed: number;
  pending: number;
  onHold: number;
}

export interface Appointment {
  _id: string;
  appointmentType: string | {
    _id: string;
    name: string;
    duration: number;
    price: number;
    cardValidityMonths: number;
  };
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  state: string;
  doctor_id?: {
    name: string;
    email: string;
  };
  medicalCardType?: {
    name: string;
    price: number;
  };
  payment_id?: {
    amount: number;
    status: string;
    transactionId: string;
  };
  intakeSubmitted: boolean;
  paymentCompleted: boolean;
  isMinor: boolean;
  notes?: string;
  adminNotes?: string;
}

interface PatientPortalState {
  stats: AppointmentStats | null;
  appointments: Appointment[];
  currentAppointment: Appointment | null;
  availableSlots: any[];
  slotDuration: number | null;
  states: any[];
  loading: boolean;
  error: string | null;
  success: string | null;
}

const initialState: PatientPortalState = {
  stats: null,
  appointments: [],
  currentAppointment: null,
  availableSlots: [],
  slotDuration: null,
  states: [],
  loading: false,
  error: null,
  success: null,
};

// Thunks
export const getDashboardStats = createAsyncThunk(
  'patientPortal/getDashboardStats',
  async () => {
    const response = await api.get('/api/patient-portal/dashboard-stats');
    return response.data;
  }
);

export const getPatientAppointments = createAsyncThunk(
  'patientPortal/getAppointments',
  async () => {
    const response = await api.get('/api/patient-portal/appointments');
    return response.data;
  }
);

export const getAppointmentDetails = createAsyncThunk(
  'patientPortal/getAppointmentDetails',
  async (appointmentId: string) => {
    const response = await api.get(`/api/patient-portal/appointment/${appointmentId}`);
    return response.data;
  }
);

export const getAvailableSlots = createAsyncThunk(
  'patientPortal/getAvailableSlots',
  async (params: { state: string; date: string; cardType: string }) => {
    const response = await api.get('/api/patient-portal/available-slots', { params });
    return response.data;
  }
);

export const getActiveStates = createAsyncThunk(
  'patientPortal/getActiveStates',
  async () => {
    const response = await api.get('/api/patient-portal/states');
    return response.data;
  }
);

export const bookAppointment = createAsyncThunk(
  'patientPortal/bookAppointment',
  async (bookingData: any, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/patient-portal/book-appointment', bookingData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { message: 'Booking failed' });
    }
  }
);

export const submitIntakeForm = createAsyncThunk(
  'patientPortal/submitIntakeForm',
  async ({ appointmentId, intakeForm }: { appointmentId: string; intakeForm: any }) => {
    const response = await api.post(`/api/patient-portal/submit-intake/${appointmentId}`, {
      intakeForm,
    });
    return response.data;
  }
);

export const checkIntakeEligibility = createAsyncThunk(
  'patientPortal/checkIntakeEligibility',
  async (appointmentId: string) => {
    const response = await api.get(`/api/patient-portal/check-intake-eligibility/${appointmentId}`);
    return response.data;
  }
);

export const updateProfile = createAsyncThunk(
  'patientPortal/updateProfile',
  async (profileData: { firstName?: string; lastName?: string; phone?: string }) => {
    const response = await api.put('/api/patient-portal/profile', profileData);
    return response.data;
  }
);

export const changePassword = createAsyncThunk(
  'patientPortal/changePassword',
  async (passwordData: { newPassword: string; confirmPassword: string }) => {
    const response = await api.put('/api/patient-portal/change-password', passwordData);
    return response.data;
  }
);

export const validateCoupon = createAsyncThunk(
  'patientPortal/validateCoupon',
  async ({ couponCode, amount }: { couponCode: string; amount: number }, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/patient-portal/validate-coupon', {
        couponCode,
        amount,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { message: 'Invalid coupon' });
    }
  }
);

const patientPortalSlice = createSlice({
  name: 'patientPortal',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = null;
    },
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard Stats
      .addCase(getDashboardStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(getDashboardStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
      })
      .addCase(getDashboardStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch stats';
      })
      // Get Appointments
      .addCase(getPatientAppointments.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPatientAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.appointments = action.payload.appointments;
      })
      .addCase(getPatientAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch appointments';
      })
      // Get Appointment Details
      .addCase(getAppointmentDetails.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAppointmentDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAppointment = action.payload.appointment;
      })
      .addCase(getAppointmentDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch appointment details';
      })
      // Get Available Slots
      .addCase(getAvailableSlots.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAvailableSlots.fulfilled, (state, action) => {
        state.loading = false;
        state.availableSlots = action.payload.slots;
        state.slotDuration = action.payload.slotDuration ?? null;
      })
      .addCase(getAvailableSlots.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch available slots';
      })
      // Get States
      .addCase(getActiveStates.fulfilled, (state, action) => {
        state.states = action.payload.states;
      })
      // Book Appointment
      .addCase(bookAppointment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bookAppointment.fulfilled, (state, action) => {
        state.loading = false;
        state.success = action.payload.message;
      })
      .addCase(bookAppointment.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload?.message || 'Booking failed';
      })
      // Submit Intake
      .addCase(submitIntakeForm.pending, (state) => {
        state.loading = true;
      })
      .addCase(submitIntakeForm.fulfilled, (state, action) => {
        state.loading = false;
        state.success = action.payload.message;
      })
      .addCase(submitIntakeForm.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to submit intake form';
      })
      // Update Profile
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.success = action.payload.message;
      })
      // Change Password
      .addCase(changePassword.fulfilled, (state, action) => {
        state.success = action.payload.message;
      });
  },
});

export const { clearError, clearSuccess, clearCurrentAppointment } = patientPortalSlice.actions;
export default patientPortalSlice.reducer;
