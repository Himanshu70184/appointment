import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '@/lib/api'

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
}

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/admin/notifications')
    return response.data.notifications
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch notifications')
  }
})

export const markAsReadAsync = createAsyncThunk('notifications/markAsRead', async (id: string, { rejectWithValue }) => {
  try {
    await api.put(`/api/admin/notifications/${id}/read`)
    return id
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to mark as read')
  }
})

export const markAllAsRead = createAsyncThunk('notifications/markAllAsRead', async (_, { rejectWithValue }) => {
  try {
    await api.put('/api/admin/notifications/mark-all-read')
    return true
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to mark all as read')
  }
})

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.notifications = action.payload
      state.unreadCount = action.payload.filter((n: Notification) => !n.isRead).length
    },
    markAsRead: (state, action) => {
      const notification = state.notifications.find((n) => n._id === action.payload)
      if (notification) {
        notification.isRead = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false
        state.notifications = action.payload
        state.unreadCount = action.payload.filter((n: Notification) => !n.isRead).length
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(markAsReadAsync.fulfilled, (state, action) => {
        const notification = state.notifications.find((n) => n._id === action.payload)
        if (notification) {
          notification.isRead = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach((n) => {
          n.isRead = true
        })
        state.unreadCount = 0
      })
  },
})

export const { setNotifications, markAsRead } = notificationSlice.actions

// Selectors
export const selectNotifications = (state: any) => state.notifications.notifications
export const selectUnreadCount = (state: any) => state.notifications.unreadCount
export const selectNotificationsLoading = (state: any) => state.notifications.loading
export const selectNotificationsError = (state: any) => state.notifications.error

export default notificationSlice.reducer
