import { queryKeys } from '@/lib/react-query'
import { webSocketService } from '@/services/websocket'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'

// Real-time event types
export type RealTimeEventType = 
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.assigned'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.member.added'
  | 'project.member.removed'
  | 'user.online'
  | 'user.offline'
  | 'notification.new'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'

// Real-time event data interface
interface RealTimeEvent<T = any> {
  type: RealTimeEventType
  data: T
  userId?: string
  timestamp: number
  id: string
}

// User presence interface
interface UserPresence {
  userId: string
  status: 'online' | 'offline' | 'away' | 'busy'
  lastSeen: string
  currentPage?: string
}

// Real-time updates hook
export function useRealTimeUpdates() {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const eventHandlers = useRef<Map<RealTimeEventType, Set<(data: any) => void>>>(new Map())

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('taskmanagement-token')
    if (!token) return

    webSocketService.init(token)

    // Connection event handlers
    webSocketService.on('open', () => {
      setIsConnected(true)
      console.log('Real-time connection established')
    })

    webSocketService.on('close', () => {
      setIsConnected(false)
      console.log('Real-time connection closed')
    })

    webSocketService.on('error', (error) => {
      console.error('Real-time connection error:', error)
      toast.error('Real-time connection error')
    })

    // Generic message handler
    webSocketService.onMessage('event', (eventData: RealTimeEvent) => {
      handleRealTimeEvent(eventData)
    })

    return () => {
      webSocketService.disconnect()
    }
  }, [])

  // Handle real-time events
  const handleRealTimeEvent = useCallback((event: RealTimeEvent) => {
    console.log('Real-time event received:', event)

    // Update React Query cache based on event type
    switch (event.type) {
      case 'task.created':
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
        if (event.data.projectId) {
          queryClient.invalidateQueries({ 
            queryKey: queryKeys.projects.tasks(event.data.projectId) 
          })
        }
        break

      case 'task.updated':
        queryClient.setQueryData(
          queryKeys.tasks.detail(event.data.id),
          event.data
        )
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
        break

      case 'task.deleted':
        queryClient.removeQueries({ 
          queryKey: queryKeys.tasks.detail(event.data.id) 
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
        break

      case 'project.created':
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
        break

      case 'project.updated':
        queryClient.setQueryData(
          queryKeys.projects.detail(event.data.id),
          event.data
        )
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() })
        break

      case 'project.deleted':
        queryClient.removeQueries({ 
          queryKey: queryKeys.projects.detail(event.data.id) 
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() })
        break

      case 'notification.new':
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
        // Show toast notification
        toast.info(event.data.message, {
          duration: 5000,
          icon: '🔔',
        })
        break

      default:
        console.log('Unhandled real-time event:', event.type)
    }

    // Call custom event handlers
    const handlers = eventHandlers.current.get(event.type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event.data)
        } catch (error) {
          console.error('Error in real-time event handler:', error)
        }
      })
    }
  }, [queryClient])

  // Subscribe to specific event types
  const subscribe = useCallback((
    eventType: RealTimeEventType,
    handler: (data: any) => void
  ) => {
    if (!eventHandlers.current.has(eventType)) {
      eventHandlers.current.set(eventType, new Set())
    }
    eventHandlers.current.get(eventType)!.add(handler)

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.current.get(eventType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          eventHandlers.current.delete(eventType)
        }
      }
    }
  }, [])

  // Send real-time message
  const send = useCallback((type: string, data: any) => {
    if (isConnected) {
      webSocketService.send({ type, data })
    }
  }, [isConnected])

  return {
    isConnected,
    subscribe,
    send,
  }
}

// User presence hook
export function useUserPresence() {
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map())
  const { subscribe, send, isConnected } = useRealTimeUpdates()
  const currentPage = useRef<string>()

  // Subscribe to presence events
  useEffect(() => {
    const unsubscribeOnline = subscribe('user.online', (data: UserPresence) => {
      setPresenceMap(prev => new Map(prev.set(data.userId, data)))
    })

    const unsubscribeOffline = subscribe('user.offline', (data: UserPresence) => {
      setPresenceMap(prev => {
        const newMap = new Map(prev)
        const user = newMap.get(data.userId)
        if (user) {
          newMap.set(data.userId, { ...user, status: 'offline', lastSeen: data.lastSeen })
        }
        return newMap
      })
    })

    return () => {
      unsubscribeOnline()
      unsubscribeOffline()
    }
  }, [subscribe])

  // Send presence updates
  const updatePresence = useCallback((status: UserPresence['status'], page?: string) => {
    if (isConnected) {
      currentPage.current = page
      send('presence.update', { status, currentPage: page })
    }
  }, [isConnected, send])

  // Auto-update presence based on page visibility
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      const status = document.hidden ? 'away' : 'online'
      updatePresence(status, currentPage.current)
    }

    const handleBeforeUnload = () => {
      updatePresence('offline')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Initial presence update
    updatePresence('online', window.location.pathname)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [updatePresence])

  const getUserPresence = useCallback((userId: string): UserPresence | null => {
    return presenceMap.get(userId) || null
  }, [presenceMap])

  const getOnlineUsers = useCallback((): UserPresence[] => {
    return Array.from(presenceMap.values()).filter(user => user.status === 'online')
  }, [presenceMap])

  return {
    getUserPresence,
    getOnlineUsers,
    updatePresence,
    presenceMap: Array.from(presenceMap.values()),
  }
}

// Live collaboration hook for documents/tasks
export function useLiveCollaboration(resourceType: string, resourceId: string) {
  const [collaborators, setCollaborators] = useState<UserPresence[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const { subscribe, send, isConnected } = useRealTimeUpdates()

  // Join collaboration session
  useEffect(() => {
    if (isConnected && resourceId) {
      send('collaboration.join', { resourceType, resourceId })

      // Subscribe to collaboration events
      const unsubscribeJoin = subscribe('collaboration.user.joined' as RealTimeEventType, (data) => {
        if (data.resourceId === resourceId) {
          setCollaborators(prev => [...prev.filter(c => c.userId !== data.user.userId), data.user])
        }
      })

      const unsubscribeLeave = subscribe('collaboration.user.left' as RealTimeEventType, (data) => {
        if (data.resourceId === resourceId) {
          setCollaborators(prev => prev.filter(c => c.userId !== data.userId))
        }
      })

      const unsubscribeEdit = subscribe('collaboration.edit.start' as RealTimeEventType, (data) => {
        if (data.resourceId === resourceId) {
          // Handle when another user starts editing
          console.log('User started editing:', data.userId)
        }
      })

      return () => {
        send('collaboration.leave', { resourceType, resourceId })
        unsubscribeJoin()
        unsubscribeLeave()
        unsubscribeEdit()
      }
    }
  }, [isConnected, resourceType, resourceId, subscribe, send])

  // Start editing
  const startEditing = useCallback(() => {
    if (isConnected && !isEditing) {
      setIsEditing(true)
      send('collaboration.edit.start', { resourceType, resourceId })
    }
  }, [isConnected, isEditing, resourceType, resourceId, send])

  // Stop editing
  const stopEditing = useCallback(() => {
    if (isConnected && isEditing) {
      setIsEditing(false)
      send('collaboration.edit.stop', { resourceType, resourceId })
    }
  }, [isConnected, isEditing, resourceType, resourceId, send])

  // Send live changes (debounced)
  const sendChange = useCallback((changes: any) => {
    if (isConnected && isEditing) {
      send('collaboration.change', { resourceType, resourceId, changes })
    }
  }, [isConnected, isEditing, resourceType, resourceId, send])

  return {
    collaborators,
    isEditing,
    startEditing,
    stopEditing,
    sendChange,
  }
}

// Real-time notifications hook
export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const { subscribe } = useRealTimeUpdates()

  useEffect(() => {
    const unsubscribe = subscribe('notification.new', (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]) // Keep last 50
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png',
          tag: notification.id,
        })
      }
    })

    return unsubscribe
  }, [subscribe])

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return Notification.permission === 'granted'
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    clearNotifications,
    requestNotificationPermission,
  }
}

// Live activity feed hook
export function useLiveActivityFeed(filters?: { projectId?: string; userId?: string }) {
  const [activities, setActivities] = useState<RealTimeEvent[]>([])
  const { subscribe } = useRealTimeUpdates()

  useEffect(() => {
    const activityTypes: RealTimeEventType[] = [
      'task.created',
      'task.updated',
      'task.assigned',
      'project.created',
      'project.updated',
      'comment.created',
    ]

    const unsubscribers = activityTypes.map(type =>
      subscribe(type, (data) => {
        // Apply filters
        if (filters?.projectId && data.projectId !== filters.projectId) return
        if (filters?.userId && data.userId !== filters.userId) return

        const activity: RealTimeEvent = {
          type,
          data,
          timestamp: Date.now(),
          id: `${type}-${Date.now()}-${Math.random()}`,
        }

        setActivities(prev => [activity, ...prev.slice(0, 99)]) // Keep last 100
      })
    )

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [subscribe, filters])

  const clearActivities = useCallback(() => {
    setActivities([])
  }, [])

  return {
    activities,
    clearActivities,
  }
}