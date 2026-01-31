import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

interface Lead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  state: string;
  leadFrom: 'website' | 'referral' | 'phone' | 'email' | 'other';
  status: 'new' | 'contacted' | 'follow-up-required' | 'converted' | 'not-interested';
  notes?: string;
  convertedToPatient?: any;
  createdAt: string;
  updatedAt: string;
}

interface LeadState {
  leads: Lead[];
  currentLead: Lead | null;
  loading: boolean;
  error: string | null;
  success: string | null;
}

const initialState: LeadState = {
  leads: [],
  currentLead: null,
  loading: false,
  error: null,
  success: null
};

// Get all leads
export const getLeads = createAsyncThunk('leads/getLeads', async (params: any = {}) => {
  const response = await api.get('/api/leads', { params });
  return response.data.leads;
});

// Get single lead
export const getLead = createAsyncThunk('leads/getLead', async (id: string) => {
  const response = await api.get(`/api/leads/${id}`);
  return response.data.lead;
});

// Create lead
export const createLead = createAsyncThunk('leads/createLead', async (leadData: any) => {
  const response = await api.post('/api/leads', leadData);
  return response.data.lead;
});

// Update lead
export const updateLead = createAsyncThunk('leads/updateLead', async ({ id, data }: { id: string; data: any }) => {
  const response = await api.put(`/api/leads/${id}`, data);
  return response.data.lead;
});

// Convert lead to patient
export const convertLead = createAsyncThunk('leads/convertLead', async (id: string) => {
  const response = await api.post(`/api/leads/${id}/convert`);
  return { leadId: id, patient: response.data.patient };
});

// Delete lead
export const deleteLead = createAsyncThunk('leads/deleteLead', async (id: string) => {
  await api.delete(`/api/leads/${id}`);
  return id;
});

const leadSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    clearLeadError: (state) => {
      state.error = null;
    },
    clearLeadSuccess: (state) => {
      state.success = null;
    }
  },
  extraReducers: (builder) => {
    // Get all leads
    builder.addCase(getLeads.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getLeads.fulfilled, (state, action) => {
      state.loading = false;
      state.leads = action.payload;
    });
    builder.addCase(getLeads.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch leads';
    });

    // Get single lead
    builder.addCase(getLead.fulfilled, (state, action) => {
      state.currentLead = action.payload;
    });

    // Create lead
    builder.addCase(createLead.fulfilled, (state, action) => {
      state.leads.unshift(action.payload);
      state.success = 'Lead created successfully';
    });

    // Update lead
    builder.addCase(updateLead.fulfilled, (state, action) => {
      const index = state.leads.findIndex((l) => l._id === action.payload._id);
      if (index !== -1) {
        state.leads[index] = action.payload;
      }
      state.success = 'Lead updated successfully';
    });

    // Convert lead
    builder.addCase(convertLead.fulfilled, (state, action) => {
      const index = state.leads.findIndex((l) => l._id === action.payload.leadId);
      if (index !== -1) {
        state.leads[index].status = 'converted';
      }
      state.success = 'Lead converted to patient successfully';
    });

    // Delete lead
    builder.addCase(deleteLead.fulfilled, (state, action) => {
      state.leads = state.leads.filter((l) => l._id !== action.payload);
      state.success = 'Lead deleted successfully';
    });
  }
});

export const { clearLeadError, clearLeadSuccess } = leadSlice.actions;
export default leadSlice.reducer;
