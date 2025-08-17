import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'task' | 'project' | 'system' | 'reminder';
  read: boolean;
  createdAt: string;
  data?: any;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  pushToken: string | null;
  settings: {
    enabled: boolean;
    taskUpdates: boolean;
    projectUpdates: boolean;
    reminders: boolean;
    systemAlerts: boolean;
  };
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  pushToken: null,
  settings: {
    enabled: true,
    taskUpdates: true,
    projectUpdates: true,
    reminders: true,
    systemAlerts: true,
  },
};

// Mock data
const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Task Assigned',
    body: 'You have been assigned to "Design user interface"',
    type: 'task',
    read: false,
    createdAt: '2024-01-18T10:00:00Z',
    data: { taskId: '1' },
  },
  {
    id: '2',
    title: 'Project Update',
    body: 'Mobile App Development project has been updated',
    type: 'project',
    read: true,
    createdAt: '2024-01-17T15:30:00Z',
    data: { projectId: 'project-1' },
  },
];

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockNotifications;
    } catch (error) {
      return rejectWithValue('Failed to fetch notifications');
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      return notificationId;
    } catch (error) {
      return rejectWithValue('Failed to mark notification as read');
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      return rejectWithValue('Failed to mark all notifications as read');
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notification-${Date.now()}`,
      };
      state.notifications.unshift(notification);
      if (!notification.read) {
        state.unreadCount += 1;
      }
    },
    setPushToken: (state, action: PayloadAction<string>) => {
      state.pushToken = action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<NotificationsState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter(n => !n.read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Mark as read
    builder
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification && !notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });

    // Mark all as read
    builder
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(notification => {
          notification.read = true;
        });
        state.unreadCount = 0;
      });
  },
});

export const { clearError, addNotification, setPushToken, updateSettings } = notificationsSlice.actions;
export default notificationsSlice.reducer;