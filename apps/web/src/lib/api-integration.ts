import { appConfig } from '@/config/app'
import { setupGlobalErrorHandling } from '@/hooks/useErrorHandler'
import { registerServiceWorker } from '@/hooks/useOfflineSupport'
import { enableMSW, startMSW } from '@/lib/msw'
import { apiClient } from '@/services/api'
import { requestBatcher } from '@/services/request-batcher'
import { cacheUtils, responseCache } from '@/services/response-cache'
import { webSocketService } from '@/services/websocket'

// API integration configuration
interface ApiIntegrationConfig {
  enableMSW?: boolean
  enableCaching?: boolean
  enableBatching?: boolean
  enableOffline?: boolean
  enableRealTime?: boolean
  enableErrorHandling?: boolean
}

// Initialize API integration
export async function initializeApiIntegration(config: ApiIntegrationConfig = {}) {
  const {
    enableMSW: shouldEnableMSW = enableMSW,
    enableCaching = appConfig.features.offline,
    enableBatching = true,
    enableOffline = appConfig.features.offline,
    enableRealTime = appConfig.features.realtime,
    enableErrorHandling = true,
  } = config

  console.log('Initializing API integration...', config)

  // Initialize MSW for development/testing
  if (shouldEnableMSW && appConfig.isDevelopment) {
    try {
      await startMSW()
      console.log('✅ MSW initialized')
    } catch (error) {
      console.warn('⚠️ MSW initialization failed:', error)
    }
  }

  // Setup global error handling
  if (enableErrorHandling) {
    setupGlobalErrorHandling()
    console.log('✅ Global error handling initialized')
  }

  // Setup caching interceptors
  if (enableCaching) {
    const { createCacheMiddleware } = await import('@/services/response-cache')
    const cacheMiddleware = createCacheMiddleware({
      ttl: appConfig.cache.staleTime,
    })

    apiClient.addRequestInterceptor(cacheMiddleware.request)
    apiClient.addResponseInterceptor(cacheMiddleware.response)
    console.log('✅ Response caching initialized')
  }

  // Setup request batching
  if (enableBatching) {
    // Request batching is available via requestBatcher service
    console.log('✅ Request batching available')
  }

  // Setup offline support
  if (enableOffline) {
    registerServiceWorker()
    console.log('✅ Offline support initialized')
  }

  // Setup real-time features
  if (enableRealTime) {
    // Real-time features are initialized via hooks
    console.log('✅ Real-time features available')
  }

  console.log('🚀 API integration initialized successfully')
}

// API service factory
export class ApiService {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = appConfig.apiUrl) {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
    }
  }

  // Authentication methods
  auth = {
    login: async (credentials: { email: string; password: string }) => {
      const response = await apiClient.post('/auth/login', credentials, {
        skipAuth: true,
      })
      
      if (response.token) {
        localStorage.setItem(appConfig.auth.tokenKey, response.token)
        if (response.refreshToken) {
          localStorage.setItem(appConfig.auth.refreshTokenKey, response.refreshToken)
        }
      }
      
      return response
    },

    logout: async () => {
      try {
        await apiClient.post('/auth/logout')
      } finally {
        localStorage.removeItem(appConfig.auth.tokenKey)
        localStorage.removeItem(appConfig.auth.refreshTokenKey)
        webSocketService.disconnect()
        cacheUtils.clear()
      }
    },

    refreshToken: async () => {
      const refreshToken = localStorage.getItem(appConfig.auth.refreshTokenKey)
      if (!refreshToken) throw new Error('No refresh token available')

      const response = await apiClient.post('/auth/refresh', {
        refreshToken,
      }, { skipAuth: true })

      if (response.token) {
        localStorage.setItem(appConfig.auth.tokenKey, response.token)
        if (response.refreshToken) {
          localStorage.setItem(appConfig.auth.refreshTokenKey, response.refreshToken)
        }
      }

      return response
    },

    me: () => apiClient.get('/auth/me'),
  }

  // Task methods
  tasks = {
    list: (params?: {
      page?: number
      limit?: number
      search?: string
      status?: string
      priority?: string
      projectId?: string
    }) => apiClient.get('/tasks', { params } as any),

    get: (id: string) => apiClient.get(`/tasks/${id}`),

    create: (data: any) => {
      const result = apiClient.post('/tasks', data)
      // Invalidate cache
      cacheUtils.invalidateResource('tasks')
      return result
    },

    update: (id: string, data: any) => {
      const result = apiClient.put(`/tasks/${id}`, data)
      // Invalidate cache
      cacheUtils.invalidateResource('tasks', id)
      return result
    },

    delete: (id: string) => {
      const result = apiClient.delete(`/tasks/${id}`)
      // Invalidate cache
      cacheUtils.invalidateResource('tasks', id)
      return result
    },

    bulkUpdate: (ids: string[], data: any) => {
      const result = apiClient.patch('/tasks/bulk', { ids, data })
      // Invalidate cache
      cacheUtils.invalidateResource('tasks')
      return result
    },
  }

  // Project methods
  projects = {
    list: (params?: {
      page?: number
      limit?: number
      search?: string
      status?: string
    }) => apiClient.get('/projects', { params } as any),

    get: (id: string) => apiClient.get(`/projects/${id}`),

    create: (data: any) => {
      const result = apiClient.post('/projects', data)
      cacheUtils.invalidateResource('projects')
      return result
    },

    update: (id: string, data: any) => {
      const result = apiClient.put(`/projects/${id}`, data)
      cacheUtils.invalidateResource('projects', id)
      return result
    },

    delete: (id: string) => {
      const result = apiClient.delete(`/projects/${id}`)
      cacheUtils.invalidateResource('projects', id)
      return result
    },

    getTasks: (id: string, params?: any) => 
      apiClient.get(`/projects/${id}/tasks`, { params } as any),

    addMember: (id: string, userId: string, role?: string) =>
      apiClient.post(`/projects/${id}/members`, { userId, role }),

    removeMember: (id: string, userId: string) =>
      apiClient.delete(`/projects/${id}/members/${userId}`),
  }

  // User methods
  users = {
    list: (params?: {
      page?: number
      limit?: number
      search?: string
      role?: string
    }) => apiClient.get('/users', { params } as any),

    get: (id: string) => apiClient.get(`/users/${id}`),

    create: (data: any) => apiClient.post('/users', data),

    update: (id: string, data: any) => apiClient.put(`/users/${id}`, data),

    delete: (id: string) => apiClient.delete(`/users/${id}`),

    updateProfile: (data: any) => apiClient.patch('/users/profile', data),
  }

  // Notification methods
  notifications = {
    list: (params?: {
      page?: number
      limit?: number
      read?: boolean
    }) => apiClient.get('/notifications', { params } as any),

    markAsRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),

    markAllAsRead: () => apiClient.patch('/notifications/read-all'),

    delete: (id: string) => apiClient.delete(`/notifications/${id}`),
  }

  // Analytics methods
  analytics = {
    dashboard: () => apiClient.get('/analytics/dashboard'),

    reports: (type: string, params?: any) =>
      apiClient.get(`/analytics/reports/${type}`, { params } as any),

    export: (type: string, format: string, params?: any) =>
      apiClient.get(`/analytics/export/${type}`, {
        params: { ...params, format },
      } as any),
  }

  // File upload methods
  files = {
    upload: (file: File, options?: { onProgress?: (progress: number) => void }) =>
      apiClient.upload('/upload', file),

    delete: (url: string) => apiClient.delete('/upload', { data: { url } }),
  }

  // Health check
  health = () => apiClient.get('/health', { skipAuth: true })
}

// Create singleton API service instance
export const api = new ApiService()

// Utility functions for API integration
export const apiUtils = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem(appConfig.auth.tokenKey)
  },

  // Get current user token
  getToken: () => {
    return localStorage.getItem(appConfig.auth.tokenKey)
  },

  // Clear authentication data
  clearAuth: () => {
    localStorage.removeItem(appConfig.auth.tokenKey)
    localStorage.removeItem(appConfig.auth.refreshTokenKey)
    webSocketService.disconnect()
    cacheUtils.clear()
  },

  // Batch multiple requests
  batch: {
    get: requestBatcher.addRequest,
    post: (endpoint: string, data?: any) => 
      requestBatcher.addRequest(endpoint, 'POST', data),
    put: (endpoint: string, data?: any) => 
      requestBatcher.addRequest(endpoint, 'PUT', data),
    patch: (endpoint: string, data?: any) => 
      requestBatcher.addRequest(endpoint, 'PATCH', data),
    delete: (endpoint: string) => 
      requestBatcher.addRequest(endpoint, 'DELETE'),
  },

  // Cache management
  cache: cacheUtils,

  // WebSocket utilities
  realTime: {
    connect: (token?: string) => {
      const authToken = token || apiUtils.getToken()
      if (authToken) {
        webSocketService.init(authToken)
      }
    },
    disconnect: () => webSocketService.disconnect(),
    send: (message: any) => webSocketService.send(message),
    isConnected: () => webSocketService.isConnected,
  },
}

// Export everything for easy access
export {
  apiClient, cacheUtils, requestBatcher,
  responseCache, webSocketService
}

// Type exports
export type { ApiIntegrationConfig }
