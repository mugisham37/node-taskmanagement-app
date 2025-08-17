import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

interface Modal {
  id: string;
  type: string;
  props?: Record<string, any>;
  isOpen: boolean;
}

interface UIState {
  // Layout
  sidebarCollapsed: boolean;
  sidebarMobile: boolean;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  
  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;
  
  // Notifications
  notifications: Notification[];
  unreadNotificationCount: number;
  
  // Modals
  modals: Modal[];
  
  // Page states
  currentPage: string;
  breadcrumbs: Array<{
    label: string;
    href?: string;
  }>;
  
  // Filters and search
  globalSearch: string;
  activeFilters: Record<string, any>;
  
  // Real-time data
  realTimeEnabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastDataUpdate: number | null;
  
  // User preferences
  preferences: {
    refreshInterval: number;
    pageSize: number;
    dateFormat: string;
    timezone: string;
    language: string;
  };
}

const initialState: UIState = {
  sidebarCollapsed: false,
  sidebarMobile: false,
  theme: 'system',
  globalLoading: false,
  loadingStates: {},
  notifications: [],
  unreadNotificationCount: 0,
  modals: [],
  currentPage: '',
  breadcrumbs: [],
  globalSearch: '',
  activeFilters: {},
  realTimeEnabled: true,
  connectionStatus: 'disconnected',
  lastDataUpdate: null,
  preferences: {
    refreshInterval: 30000,
    pageSize: 25,
    dateFormat: 'MM/dd/yyyy',
    timezone: 'UTC',
    language: 'en',
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Layout actions
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    toggleMobileSidebar: (state) => {
      state.sidebarMobile = !state.sidebarMobile;
    },
    setMobileSidebar: (state, action: PayloadAction<boolean>) => {
      state.sidebarMobile = action.payload;
    },
    
    // Theme actions
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    
    // Loading actions
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },
    setLoadingState: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload;
      if (loading) {
        state.loadingStates[key] = true;
      } else {
        delete state.loadingStates[key];
      }
    },
    
    // Notification actions
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
        read: false,
      };
      state.notifications.unshift(notification);
      state.unreadNotificationCount += 1;
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadNotificationCount = Math.max(0, state.unreadNotificationCount - 1);
      }
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach(n => n.read = true);
      state.unreadNotificationCount = 0;
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadNotificationCount = Math.max(0, state.unreadNotificationCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadNotificationCount = 0;
    },
    
    // Modal actions
    openModal: (state, action: PayloadAction<{ type: string; props?: Record<string, any> }>) => {
      const { type, props } = action.payload;
      const modal: Modal = {
        id: Date.now().toString(),
        type,
        props,
        isOpen: true,
      };
      state.modals.push(modal);
    },
    closeModal: (state, action: PayloadAction<string>) => {
      const index = state.modals.findIndex(m => m.id === action.payload);
      if (index !== -1) {
        state.modals.splice(index, 1);
      }
    },
    closeAllModals: (state) => {
      state.modals = [];
    },
    
    // Page actions
    setCurrentPage: (state, action: PayloadAction<string>) => {
      state.currentPage = action.payload;
    },
    setBreadcrumbs: (state, action: PayloadAction<Array<{ label: string; href?: string }>>) => {
      state.breadcrumbs = action.payload;
    },
    
    // Search and filter actions
    setGlobalSearch: (state, action: PayloadAction<string>) => {
      state.globalSearch = action.payload;
    },
    setActiveFilters: (state, action: PayloadAction<Record<string, any>>) => {
      state.activeFilters = action.payload;
    },
    updateFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || value === '') {
        delete state.activeFilters[key];
      } else {
        state.activeFilters[key] = value;
      }
    },
    clearFilters: (state) => {
      state.activeFilters = {};
    },
    
    // Real-time actions
    setRealTimeEnabled: (state, action: PayloadAction<boolean>) => {
      state.realTimeEnabled = action.payload;
    },
    setConnectionStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'connecting'>) => {
      state.connectionStatus = action.payload;
    },
    setLastDataUpdate: (state, action: PayloadAction<number>) => {
      state.lastDataUpdate = action.payload;
    },
    
    // Preferences actions
    updatePreferences: (state, action: PayloadAction<Partial<UIState['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleMobileSidebar,
  setMobileSidebar,
  setTheme,
  setGlobalLoading,
  setLoadingState,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  closeAllModals,
  setCurrentPage,
  setBreadcrumbs,
  setGlobalSearch,
  setActiveFilters,
  updateFilter,
  clearFilters,
  setRealTimeEnabled,
  setConnectionStatus,
  setLastDataUpdate,
  updatePreferences,
} = uiSlice.actions;

export default uiSlice.reducer;