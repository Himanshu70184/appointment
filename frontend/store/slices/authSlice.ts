import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import Cookies from 'js-cookie'
import type { User } from '@/types'

// Smart API URL detection - same logic as api.ts
const getAPIUrl = () => {
  // For server-side rendering, use environment variable
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 'http:' or 'https:'
  
  // Production deployment (Vercel, Netlify, etc.)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Network access (use same protocol as frontend and port 5000)
  return `${protocol}//${hostname}:5000`;
};

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  requiresTwoFactor: boolean
  twoFactorUserId: string | null
}

const initialState: AuthState = {
  user: null,
  token: Cookies.get('token') || null,
  isAuthenticated: false,
  loading: false,
  error: null,
  requiresTwoFactor: false,
  twoFactorUserId: null,
}

// Async thunks
export const register = createAsyncThunk(
  'auth/register',
  async (userData: { name: string; email: string; phone: string; state: string; appointmentType?: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${getAPIUrl()}/api/auth/register`, userData)
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Registration failed. Please try again.'
      return rejectWithValue(message)
    }
  }
)

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${getAPIUrl()}/api/auth/login`, credentials)
      
      // Check if 2FA is required
      if (response.data.requiresTwoFactor) {
        return { requiresTwoFactor: true, userId: response.data.userId }
      }
      
      const { token, user } = response.data
      Cookies.set('token', token, { expires: 7, sameSite: 'lax', path: '/' })
      return { token, user, requiresTwoFactor: false }
    } catch (error: any) {
      // Extract user-friendly error message
      const message = error.response?.data?.message || error.message || 'Login failed. Please try again.'
      return rejectWithValue(message)
    }
  }
)

export const verify2FA = createAsyncThunk(
  'auth/verify2FA',
  async (data: { userId: string; code: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${getAPIUrl()}/api/auth/verify-2fa`, data)
      const { token, user } = response.data
      Cookies.set('token', token, { expires: 7, sameSite: 'lax', path: '/' })
      return { token, user }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Verification failed. Please try again.'
      return rejectWithValue(message)
    }
  }
)

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { getState }) => {
    const state = getState() as { auth: AuthState }
    const token = state.auth.token || Cookies.get('token')
    
    if (!token) {
      throw new Error('No token available')
    }

    const response = await axios.get(`${getAPIUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return response.data.user
  }
)

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token: string) => {
    const response = await axios.get(`${getAPIUrl()}/api/auth/verify-email?token=${token}`)
    return response.data
  }
)

export const setupPassword = createAsyncThunk(
  'auth/setupPassword',
  async (data: { token: string; password: string }) => {
    const response = await axios.post(`${getAPIUrl()}/api/auth/setup-password`, data)
    const { token, user } = response.data
    Cookies.set('token', token, { expires: 7, sameSite: 'lax', path: '/' })
    return { token, user }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      state.requiresTwoFactor = false
      state.twoFactorUserId = null
      Cookies.remove('token', { path: '/' })
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false
        state.error = (action.payload as string) || action.error.message || 'Registration failed'
      })
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload.requiresTwoFactor) {
          state.requiresTwoFactor = true
          state.twoFactorUserId = action.payload.userId
        } else {
          state.token = action.payload.token
          state.user = action.payload.user
          state.isAuthenticated = true
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = (action.payload as string) || action.error.message || 'Login failed'
      })
      // Verify 2FA
      .addCase(verify2FA.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verify2FA.fulfilled, (state, action) => {
        state.loading = false
        state.token = action.payload.token
        state.user = action.payload.user
        state.isAuthenticated = true
        state.requiresTwoFactor = false
        state.twoFactorUserId = null
      })
      .addCase(verify2FA.rejected, (state, action) => {
        state.loading = false
        state.error = (action.payload as string) || action.error.message || '2FA verification failed'
      })
      // Get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        state.isAuthenticated = true
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.loading = false
        state.isAuthenticated = false
        state.token = null
        Cookies.remove('token')
      })
      // Setup password
      .addCase(setupPassword.fulfilled, (state, action) => {
        state.token = action.payload.token
        state.user = action.payload.user
        state.isAuthenticated = true
      })
  },
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
