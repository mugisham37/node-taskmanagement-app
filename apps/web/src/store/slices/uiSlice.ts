import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Types
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface Modal {
  id: string
  type: string
  props?: Record<string, any>
}

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system'
  
  // Layout
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  
  // Loading states
  globalLoading: boolean
  loadingStates: Record<string, boolean>
  
  // Toasts
  toasts: Toast[]
  
  // Modals
  modals: Modal[]
  
  // Navigation
  breadcrumbs: Array<{ label: string; href?: string }>
  
  // Search
  searchQuery: string
  searchResults: any[]
  searchLoading: boolean
  
  // Filters
  activeFilters: Record<string, any>
  
  // Preferences
  preferences: {
    pageSize: number
    dateFormat: string
    timeFormat: string
    timezone: string
    language: string
    notifications: {
      email: boolean
      push: boolean
      desktop: boolean
    }
  }
}

// Initial state
const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarCollapsed: false,
  globalLoading: false,
  loadingStates: {},
  toasts: [],
  modals: [],
  breadcrumbs: [],
  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  activeFilters: {},
  preferences: {
    pageSize: 20,
    dateFormat: 'yyyy-MM-dd',
    timeFormat: 'HH:mm',
    timezone: 'UTC',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      desktop: true,
    },
  },
}

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme actions
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload
    },
    
    // Sidebar actions
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },
    
    // Loading actions
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload
    },
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loadingStates[action.payload.key] = action.payload.loading
    },
    clearLoading: (state, action: PayloadAction<string>) => {
      delete state.loadingStates[action.payload]
    },
    
    // Toast actions
    addToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      const toast: Toast = {
        id: Date.now().toString(),
        ...action.payload,
      }
      state.toasts.push(toast)
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload)
    },
    clearToasts: (state) => {
      state.toasts = []
    },
    
    // Modal actions
    openModal: (state, action: PayloadAction<Omit<Modal, 'id'>>) => {
      const modal: Modal = {
        id: Date.now().toString(),
        ...action.payload,
      }
      state.modals.push(modal)
    },
    closeModal: (state, action: PayloadAction<string>) => {
      state.modals = state.modals.filter(modal => modal.id !== action.payload)
    },
    closeAllModals: (state) => {
      state.modals = []
    },
    
    // Breadcrumb actions
    setBreadcrumbs: (state, action: PayloadAction<Array<{ label: string; href?: string }>>) => {
      state.breadcrumbs = action.payload
    },
    addBreadcrumb: (state, action: PayloadAction<{ label: string; href?: string }>) => {
      state.breadcrumbs.push(action.payload)
    },
    clearBreadcrumbs: (state) => {
      state.breadcrumbs = []
    },
    
    // Search actions
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    setSearchResults: (state, action: PayloadAction<any[]>) => {
      state.searchResults = action.payload
    },
    setSearchLoading: (state, action: PayloadAction<boolean>) => {
      state.searchLoading = action.payload
    },
    clearSearch: (state) => {
      state.searchQuery = ''
      state.searchResults = []
      state.searchLoading = false
    },
    
    // Filter actions
    setFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      state.activeFilters[action.payload.key] = action.payload.value
    },
    removeFilter: (state, action: PayloadAction<string>) => {
      delete state.activeFilters[action.payload]
    },
    clearFilters: (state) => {
      state.activeFilters = {}
    },
    
    // Preference actions
    updatePreferences: (state, action: PayloadAction<Partial<UIState['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload }
    },
    updateNotificationPreferences: (
      state,
      action: PayloadAction<Partial<UIState['preferences']['notifications']>>
    ) => {
      state.preferences.notifications = {
        ...state.preferences.notifications,
        ...action.payload,
      }
    },
  },
})

// Export actions
export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  setGlobalLoading,
  setLoading,
  clearLoading,
  addToast,
  removeToast,
  clearToasts,
  openModal,
  closeModal,
  closeAllModals,
  setBreadcrumbs,
  addBreadcrumb,
  clearBreadcrumbs,
  setSearchQuery,
  setSearchResults,
  setSearchLoading,
  clearSearch,
  setFilter,
  removeFilter,
  clearFilters,
  updatePreferences,
  updateNotificationPreferences,
} = uiSlice.actions

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui
export const selectTheme = (state: { ui: UIState }) => state.ui.theme
export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.sidebarCollapsed
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.globalLoading
export const selectLoadingState = (key: string) => (state: { ui: UIState }) => 
  state.ui.loadingStates[key] || false
export const selectToasts = (state: { ui: UIState }) => state.ui.toasts
export const selectModals = (state: { ui: UIState }) => state.ui.modals
export const selectBreadcrumbs = (state: { ui: UIState }) => state.ui.breadcrumbs
export const selectSearchQuery = (state: { ui: UIState }) => state.ui.searchQuery
export const selectSearchResults = (state: { ui: UIState }) => state.ui.searchResults
export const selectSearchLoading = (state: { ui: UIState }) => state.ui.searchLoading
export const selectActiveFilters = (state: { ui: UIState }) => state.ui.activeFilters
export const selectPreferences = (state: { ui: UIState }) => state.ui.preferences

// Export reducer
export default uiSlice.reducer