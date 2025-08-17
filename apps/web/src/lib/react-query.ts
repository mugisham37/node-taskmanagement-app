import { appConfig } from '@/config/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Simple localStorage persister for offline support
const createSimplePersister = () => {
  if (typeof window === 'undefined') return undefined
  
  return {
    persistClient: (client: any) => {
      try {
        const cache = client.getQueryCache().getAll()
        localStorage.setItem('taskmanagement-query-cache', JSON.stringify(cache))
      } catch (error) {
        console.warn('Failed to persist query cache:', error)
      }
    },
    restoreClient: (client: any) => {
      try {
        const cached = localStorage.getItem('taskmanagement-query-cache')
        if (cached) {
          const data = JSON.parse(cached)
          // Simple restoration - in production, use proper persistence library
          return data
        }
      } catch (error) {
        console.warn('Failed to restore query cache:', error)
      }
      return undefined
    },
  }
}

const persister = createSimplePersister()

// Create query client with optimized configuration
export function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time - how long data is considered fresh
        staleTime: appConfig.cache.staleTime,
        // Cache time - how long data stays in cache when not used
        cacheTime: appConfig.cache.cacheTime,
        // Retry configuration
        retry: (failureCount: number, error: any) => {
          // Don't retry on authentication errors
          if (error?.data?.code === 'UNAUTHORIZED') {
            return false
          }
          // Don't retry on validation errors
          if (error?.data?.code === 'BAD_REQUEST') {
            return false
          }
          return failureCount < appConfig.api.retries
        },
        retryDelay: (attemptIndex: number) => 
          Math.min(appConfig.api.retryDelay * Math.pow(2, attemptIndex), 30000),
        // Refetch on window focus in production
        refetchOnWindowFocus: appConfig.isProduction,
        // Refetch on reconnect
        refetchOnReconnect: true,
        // Background refetch interval (5 minutes)
        refetchInterval: appConfig.isProduction ? 5 * 60 * 1000 : false,
      },
      mutations: {
        // Don't retry mutations by default
        retry: false,
        // Network mode for offline support
        networkMode: 'offlineFirst',
      },
    },
  })

  // Set up simple persistence for offline support
  if (persister && appConfig.features.offline) {
    // Simple persistence - restore cache on initialization
    persister.restoreClient(queryClient)
    
    // Persist cache on changes (debounced)
    let persistTimeout: NodeJS.Timeout
    queryClient.getQueryCache().subscribe(() => {
      clearTimeout(persistTimeout)
      persistTimeout = setTimeout(() => {
        persister.persistClient(queryClient)
      }, 1000)
    })
  }

  return queryClient
}

// Query key factories for consistent cache keys
export const queryKeys = {
  // Authentication
  auth: {
    me: ['auth', 'me'] as const,
    permissions: (userId: string) => ['auth', 'permissions', userId] as const,
  },
  
  // Tasks
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    search: (query: string) => [...queryKeys.tasks.all, 'search', query] as const,
  },

  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    tasks: (projectId: string) => [...queryKeys.projects.detail(projectId), 'tasks'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },

  // Workspaces
  workspaces: {
    all: ['workspaces'] as const,
    lists: () => [...queryKeys.workspaces.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.workspaces.lists(), filters] as const,
    details: () => [...queryKeys.workspaces.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workspaces.details(), id] as const,
    members: (workspaceId: string) => [...queryKeys.workspaces.detail(workspaceId), 'members'] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all, 'dashboard'] as const,
    reports: () => [...queryKeys.analytics.all, 'reports'] as const,
    report: (type: string, filters: Record<string, any>) => 
      [...queryKeys.analytics.reports(), type, filters] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.notifications.lists(), filters] as const,
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
  },
} as const

// Mutation key factories
export const mutationKeys = {
  // Authentication
  auth: {
    login: ['auth', 'login'] as const,
    logout: ['auth', 'logout'] as const,
    register: ['auth', 'register'] as const,
    refreshToken: ['auth', 'refresh'] as const,
    forgotPassword: ['auth', 'forgot-password'] as const,
    resetPassword: ['auth', 'reset-password'] as const,
    changePassword: ['auth', 'change-password'] as const,
    enable2FA: ['auth', 'enable-2fa'] as const,
    verify2FA: ['auth', 'verify-2fa'] as const,
  },

  // Tasks
  tasks: {
    create: ['tasks', 'create'] as const,
    update: ['tasks', 'update'] as const,
    delete: ['tasks', 'delete'] as const,
    bulkUpdate: ['tasks', 'bulk-update'] as const,
    bulkDelete: ['tasks', 'bulk-delete'] as const,
  },

  // Projects
  projects: {
    create: ['projects', 'create'] as const,
    update: ['projects', 'update'] as const,
    delete: ['projects', 'delete'] as const,
    addMember: ['projects', 'add-member'] as const,
    removeMember: ['projects', 'remove-member'] as const,
  },

  // Users
  users: {
    create: ['users', 'create'] as const,
    update: ['users', 'update'] as const,
    delete: ['users', 'delete'] as const,
    updateProfile: ['users', 'update-profile'] as const,
  },

  // Workspaces
  workspaces: {
    create: ['workspaces', 'create'] as const,
    update: ['workspaces', 'update'] as const,
    delete: ['workspaces', 'delete'] as const,
    inviteMember: ['workspaces', 'invite-member'] as const,
    removeMember: ['workspaces', 'remove-member'] as const,
  },
} as const

// Cache invalidation helpers
export const invalidateQueries = {
  tasks: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  },
  projects: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
  },
  users: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
  },
  workspaces: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
  },
  analytics: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
  },
  notifications: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
  },
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries()
  },
}

// Optimistic update helpers
export const optimisticUpdates = {
  updateTask: (queryClient: QueryClient, taskId: string, updates: any) => {
    queryClient.setQueryData(queryKeys.tasks.detail(taskId), (old: any) => ({
      ...old,
      ...updates,
    }))
  },
  updateProject: (queryClient: QueryClient, projectId: string, updates: any) => {
    queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) => ({
      ...old,
      ...updates,
    }))
  },
}

export { QueryClientProvider, ReactQueryDevtools }

