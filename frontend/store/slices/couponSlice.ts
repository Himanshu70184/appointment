import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'
import type { Coupon } from '@/types'

interface CouponState {
  coupons: Coupon[]
  loading: boolean
  error: string | null
  success: boolean
  message: string
}

const initialState: CouponState = {
  coupons: [],
  loading: false,
  error: null,
  success: false,
  message: '',
}

export const fetchCoupons = createAsyncThunk('coupons/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/coupons')
    return response.data.coupons as Coupon[]
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load coupons')
  }
})

interface CouponPayload extends Partial<Coupon> {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  validFrom: string
  validUntil: string
}

export const createCoupon = createAsyncThunk(
  'coupons/create',
  async (payload: CouponPayload, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/coupons', payload)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create coupon')
    }
  }
)

export const updateCoupon = createAsyncThunk(
  'coupons/update',
  async ({ id, data }: { id: string; data: Partial<Coupon> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/coupons/${id}`, data)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update coupon')
    }
  }
)

export const deleteCoupon = createAsyncThunk(
  'coupons/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/api/coupons/${id}`)
      return id
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete coupon')
    }
  }
)

export const toggleCouponStatus = createAsyncThunk(
  'coupons/toggleStatus',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/coupons/${id}/toggle-active`)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle coupon status')
    }
  }
)

const couponSlice = createSlice({
  name: 'coupons',
  initialState,
  reducers: {
    clearCouponError: (state) => {
      state.error = null
    },
    clearCouponSuccess: (state) => {
      state.success = false
      state.message = ''
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCoupons.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCoupons.fulfilled, (state, action) => {
        state.loading = false
        state.coupons = action.payload
      })
      .addCase(fetchCoupons.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(createCoupon.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createCoupon.fulfilled, (state, action) => {
        state.loading = false
        state.coupons.unshift(action.payload.coupon)
        state.success = true
        state.message = action.payload.message || 'Coupon created successfully'
      })
      .addCase(createCoupon.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(updateCoupon.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateCoupon.fulfilled, (state, action) => {
        state.loading = false
        const idx = state.coupons.findIndex((coupon) => coupon._id === action.payload.coupon._id)
        if (idx !== -1) {
          state.coupons[idx] = action.payload.coupon
        }
        state.success = true
        state.message = action.payload.message || 'Coupon updated successfully'
      })
      .addCase(updateCoupon.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(deleteCoupon.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteCoupon.fulfilled, (state, action) => {
        state.loading = false
        state.coupons = state.coupons.filter((coupon) => coupon._id !== action.payload)
        state.success = true
        state.message = 'Coupon deleted successfully'
      })
      .addCase(deleteCoupon.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(toggleCouponStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(toggleCouponStatus.fulfilled, (state, action) => {
        state.loading = false
        const idx = state.coupons.findIndex((coupon) => coupon._id === action.payload.coupon._id)
        if (idx !== -1) {
          state.coupons[idx] = action.payload.coupon
        }
        state.success = true
        state.message = action.payload.message || 'Coupon status updated'
      })
      .addCase(toggleCouponStatus.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export const { clearCouponError, clearCouponSuccess } = couponSlice.actions
export default couponSlice.reducer
