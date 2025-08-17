import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Notification } from '@taskmanagement/types'

// Types
interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  realTimeConnected: boolean
}

// Initial state
const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  realTimeConnected: false,
}

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params: { page?: number; limit?: number; unreadOnly?: boolean } = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        page: (params.page || 1).toString(),
        limit: (params.limit || 20).toString(),
        ...(params.unreadOnly && { unreadOnly: 'true' }),
      })

      const response = await fetch(`/api/notifications?${queryParams}`)
      
      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to fetch notifications')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to mark notification as read')
      }

      return notificationId
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to mark all notifications as read')
      }

      return null
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const deleteNotification = createAsyncThunk(
  'notifications/deleteNotification',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to delete notification')
      }

      return notificationId
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const clearAllNotifications = createAsyncThunk(
  'notifications/clearAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to clear all notifications')
      }

      return null
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

// Notifications slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload)
      if (!action.payload.read) {
        state.unreadCount += 1
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const notificationIndex = state.notifications.findIndex(n => n.id === action.payload)
      if (notificationIndex !== -1) {
        const notification = state.notifications[notificationIndex]
        if (!notification.read) {
          state.unreadCount -= 1
        }
        state.notifications.splice(notificationIndex, 1)
      }
    },
    updateNotification: (state, action: PayloadAction<{ id: string; updates: Partial<Notification> }>) => {
      const { id, updates } = action.payload
      const notificationIndex = state.notifications.findIndex(n => n.id === id)
      if (notificationIndex !== -1) {
        const oldNotification = state.notifications[notificationIndex]
        const newNotification = { ...oldNotification, ...updates }
        
        // Update unread count if read status changed
        if (oldNotification.read !== newNotification.read) {
          if (newNotification.read) {
            state.unreadCount -= 1
          } else {
            state.unreadCount += 1
          }
        }
        
        state.notifications[notificationIndex] = newNotification
      }
    },
    setRealTimeConnected: (state, action: PayloadAction<boolean>) => {
      state.realTimeConnected = action.payload
    },
    optimisticMarkAsRead: (state, action: PayloadAction<string>) => {
      const notificationIndex = state.notifications.findIndex(n => n.id === action.payload)
      if (notificationIndex !== -1 && !state.notifications[notificationIndex].read) {
        state.notifications[notificationIndex].read = true
        state.notifications[notificationIndex].readAt = new Date().toISOString()
        state.unreadCount -= 1
      }
    },
    optimisticMarkAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        if (!notification.read) {
          notification.read = true
          notification.readAt = new Date().toISOString()
        }
      })
      state.unreadCount = 0
    },
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false
        state.notifications = action.payload.notifications
        state.unreadCount = action.payload.unreadCount
        state.error = null
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Mark notification as read
    builder
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notificationId = action.payload
        const notificationIndex = state.notifications.findIndex(n => n.id === notificationId)
        if (notificationIndex !== -1 && !state.notifications[notificationIndex].read) {
          state.notifications[notificationIndex].read = true
          state.notifications[notificationIndex].readAt = new Date().toISOString()
          state.unreadCount -= 1
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Mark all notifications as read
    builder
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true
            notification.readAt = new Date().toISOString()
          }
        })
        state.unreadCount = 0
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Delete notification
    builder
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const notificationId = action.payload
        const notificationIndex = state.notifications.findIndex(n => n.id === notificationId)
        if (notificationIndex !== -1) {
          const notification = state.notifications[notificationIndex]
          if (!notification.read) {
            state.unreadCount -= 1
          }
          state.notifications.splice(notificationIndex, 1)
        }
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Clear all notifications
    builder
      .addCase(clearAllNotifications.fulfilled, (state) => {
        state.notifications = []
        state.unreadCount = 0
      })
      .addCase(clearAllNotifications.rejected, (state, action) => {
        state.error = action.payload as string
      })
  },
})

// Export actions
export const {
  clearError,
  addNotification,
  removeNotification,
  updateNotification,
  setRealTimeConnected,
  optimisticMarkAsRead,
  optimisticMarkAllAsRead,
} = notificationsSlice.actions

// Selectors
export const selectNotifications = (state: { notifications: NotificationsState }) => state.notifications.notifications
export const selectUnreadCount = (state: { notifications: NotificationsState }) => state.notifications.unreadCount
export const selectNotificationsLoading = (state: { notifications: NotificationsState }) => state.notifications.isLoading
export const selectNotificationsError = (state: { notifications: NotificationsState }) => state.notifications.error
export const selectRealTimeConnected = (state: { notifications: NotificationsState }) => state.notifications.realTimeConnected
export const selectUnreadNotifications = (state: { notifications: NotificationsState }) => 
  state.notifications.notifications.filter(n => !n.read)

// Export reducer
export default notificationsSlice.reducer