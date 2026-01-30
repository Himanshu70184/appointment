import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

// Async thunks
export const getStates = createAsyncThunk(
  'states/getStates',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/states', { params });
      return response.data.states;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch states');
    }
  }
);

export const getState = createAsyncThunk(
  'states/getState',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/states/${id}`);
      return response.data.state;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch state');
    }
  }
);

export const createState = createAsyncThunk(
  'states/createState',
  async (stateData, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/states', stateData);
      return response.data.state;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create state');
    }
  }
);

export const updateState = createAsyncThunk(
  'states/updateState',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/states/${id}`, data);
      return response.data.state;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update state');
    }
  }
);

export const deleteState = createAsyncThunk(
  'states/deleteState',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/api/states/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete state');
    }
  }
);

export const toggleStateActive = createAsyncThunk(
  'states/toggleStateActive',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/states/${id}/toggle-active`);
      return response.data.state;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle state');
    }
  }
);

const initialState = {
  states: [],
  currentState: null,
  loading: false,
  error: null,
  success: false,
  message: ''
};

const stateSlice = createSlice({
  name: 'states',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = false;
      state.message = '';
    },
    clearCurrentState: (state) => {
      state.currentState = null;
    }
  },
  extraReducers: (builder) => {
    // Get States
    builder
      .addCase(getStates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getStates.fulfilled, (state, action) => {
        state.loading = false;
        state.states = action.payload;
      })
      .addCase(getStates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Get Single State
    builder
      .addCase(getState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getState.fulfilled, (state, action) => {
        state.loading = false;
        state.currentState = action.payload;
      })
      .addCase(getState.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create State
    builder
      .addCase(createState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createState.fulfilled, (state, action) => {
        state.loading = false;
        state.states.push(action.payload);
        state.success = true;
        state.message = 'State created successfully!';
      })
      .addCase(createState.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update State
    builder
      .addCase(updateState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateState.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.states.findIndex(s => s._id === action.payload._id);
        if (index !== -1) {
          state.states[index] = action.payload;
        }
        state.success = true;
        state.message = 'State updated successfully!';
      })
      .addCase(updateState.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Delete State
    builder
      .addCase(deleteState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteState.fulfilled, (state, action) => {
        state.loading = false;
        state.states = state.states.filter(s => s._id !== action.payload);
        state.success = true;
        state.message = 'State deleted successfully!';
      })
      .addCase(deleteState.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Toggle Active
    builder
      .addCase(toggleStateActive.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleStateActive.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.states.findIndex(s => s._id === action.payload._id);
        if (index !== -1) {
          state.states[index] = action.payload;
        }
        state.success = true;
        state.message = `State ${action.payload.isActive ? 'activated' : 'deactivated'} successfully!`;
      })
      .addCase(toggleStateActive.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearError, clearSuccess, clearCurrentState } = stateSlice.actions;
export default stateSlice.reducer;
