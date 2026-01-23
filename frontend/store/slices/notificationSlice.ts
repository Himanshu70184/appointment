import { createSlice } from '@reduxjs/toolkit'

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
  },
  reducers: {
    setNotifications: (state: any, action) => {
      state.notifications = action.payload
      state.unreadCount = action.payload.filter((n: any) => !n.read).length
    },
    markAsRead: (state: any, action) => {
      const notification = state.notifications.find(
        (n: any) => n._id === action.payload
      )
      if (notification) {
        notification.read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
  },
})

export const { setNotifications, markAsRead } = notificationSlice.actions
export default notificationSlice.reducer
