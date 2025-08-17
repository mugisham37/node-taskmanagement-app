import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

// Offline queue item interface
interface OfflineQueueItem {
  id: string
  type: 'api' | 'mutation' | 'sync'
  endpoint: string
  method: string
  data?: any
  timestamp: number
  retries: number
  maxRetries: number
}

// Network status hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [connectionType, setConnectionType] = useState<string>('unknown')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Connection restored', { icon: '🌐' })
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.error('Connection lost. Working offline', { 
        icon: '📱',
        duration: 6000,
      })
    }

    const handleConnectionChange = () => {
      const connection = (navigator as any).connection
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Network Information API (experimental)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', handleConnectionChange)
      handleConnectionChange()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [])

  return { isOnline, connectionType }
}

// Offline queue manager
class OfflineQueueManager {
  private queue: OfflineQueueItem[] = []
  private isProcessing = false
  private storageKey = 'taskmanagement-offline-queue'

  constructor() {
    this.loadQueue()
  }

  // Add item to queue
  add(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries'>): string {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
    }

    this.queue.push(queueItem)
    this.saveQueue()
    
    return queueItem.id
  }

  // Remove item from queue
  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id)
    if (index !== -1) {
      this.queue.splice(index, 1)
      this.saveQueue()
      return true
    }
    return false
  }

  // Get queue items
  getQueue(): OfflineQueueItem[] {
    return [...this.queue]
  }

  // Clear queue
  clear(): void {
    this.queue = []
    this.saveQueue()
  }

  // Process queue when online
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    try {
      const itemsToProcess = [...this.queue]
      
      for (const item of itemsToProcess) {
        try {
          await this.processItem(item)
          this.remove(item.id)
        } catch (error) {
          console.error('Failed to process offline queue item:', error)
          
          // Increment retry count
          item.retries++
          
          if (item.retries >= item.maxRetries) {
            // Remove item if max retries reached
            this.remove(item.id)
            toast.error(`Failed to sync: ${item.endpoint}`)
          }
        }
      }

      this.saveQueue()
    } finally {
      this.isProcessing = false
    }
  }

  // Process individual queue item
  private async processItem(item: OfflineQueueItem): Promise<void> {
    const { apiClient } = await import('@/services/api')
    
    switch (item.method.toUpperCase()) {
      case 'GET':
        await apiClient.get(item.endpoint)
        break
      case 'POST':
        await apiClient.post(item.endpoint, item.data)
        break
      case 'PUT':
        await apiClient.put(item.endpoint, item.data)
        break
      case 'PATCH':
        await apiClient.patch(item.endpoint, item.data)
        break
      case 'DELETE':
        await apiClient.delete(item.endpoint)
        break
      default:
        throw new Error(`Unsupported method: ${item.method}`)
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`
  }

  // Save queue to localStorage
  private saveQueue(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue))
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  // Load queue from localStorage
  private loadQueue(): void {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
      this.queue = []
    }
  }
}

// Create singleton instance
const offlineQueueManager = new OfflineQueueManager()

// Offline support hook
export function useOfflineSupport() {
  const { isOnline } = useNetworkStatus()
  const [queueSize, setQueueSize] = useState(0)

  // Update queue size when queue changes
  useEffect(() => {
    const updateQueueSize = () => {
      setQueueSize(offlineQueueManager.getQueue().length)
    }

    updateQueueSize()
    
    // Set up periodic updates
    const interval = setInterval(updateQueueSize, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Process queue when coming online
  useEffect(() => {
    if (isOnline) {
      offlineQueueManager.processQueue()
    }
  }, [isOnline])

  const addToQueue = useCallback((
    endpoint: string,
    method: string,
    data?: any,
    options: { maxRetries?: number } = {}
  ) => {
    return offlineQueueManager.add({
      type: 'api',
      endpoint,
      method,
      data,
      maxRetries: options.maxRetries || 3,
    })
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    return offlineQueueManager.remove(id)
  }, [])

  const clearQueue = useCallback(() => {
    offlineQueueManager.clear()
    setQueueSize(0)
  }, [])

  const getQueue = useCallback(() => {
    return offlineQueueManager.getQueue()
  }, [])

  return {
    isOnline,
    queueSize,
    addToQueue,
    removeFromQueue,
    clearQueue,
    getQueue,
  }
}

// Offline-first API wrapper
export function useOfflineFirstAPI() {
  const { isOnline, addToQueue } = useOfflineSupport()

  const request = useCallback(async <T>(
    endpoint: string,
    options: {
      method?: string
      data?: any
      fallbackToCache?: boolean
      queueWhenOffline?: boolean
    } = {}
  ): Promise<T | null> => {
    const {
      method = 'GET',
      data,
      fallbackToCache = true,
      queueWhenOffline = true,
    } = options

    // Try to make request if online
    if (isOnline) {
      try {
        const { apiClient } = await import('@/services/api')
        
        switch (method.toUpperCase()) {
          case 'GET':
            return await apiClient.get<T>(endpoint)
          case 'POST':
            return await apiClient.post<T>(endpoint, data)
          case 'PUT':
            return await apiClient.put<T>(endpoint, data)
          case 'PATCH':
            return await apiClient.patch<T>(endpoint, data)
          case 'DELETE':
            return await apiClient.delete<T>(endpoint)
          default:
            throw new Error(`Unsupported method: ${method}`)
        }
      } catch (error) {
        console.error('API request failed:', error)
        
        // Fall back to cache for GET requests
        if (method.toUpperCase() === 'GET' && fallbackToCache) {
          return getCachedResponse<T>(endpoint)
        }
        
        throw error
      }
    }

    // Handle offline scenarios
    if (method.toUpperCase() === 'GET') {
      // For GET requests, try cache first
      if (fallbackToCache) {
        const cached = getCachedResponse<T>(endpoint)
        if (cached) {
          return cached
        }
      }
    } else {
      // For mutations, add to offline queue
      if (queueWhenOffline) {
        addToQueue(endpoint, method, data)
        toast.info('Request queued for when connection is restored')
        return null
      }
    }

    throw new Error('No internet connection and no cached data available')
  }, [isOnline, addToQueue])

  return { request }
}

// Cache utilities for offline support
function getCachedResponse<T>(endpoint: string): T | null {
  if (typeof window === 'undefined') return null
  
  try {
    const { responseCache } = require('@/services/response-cache')
    return responseCache.get<T>(endpoint)
  } catch (error) {
    console.error('Failed to get cached response:', error)
    return null
  }
}

// Service worker registration for offline support
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered:', registration)

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              toast.success('App updated! Refresh to use the latest version.', {
                duration: 10000,
                icon: '🔄',
              })
            }
          })
        }
      })
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  })
}

// Background sync for offline operations
export function useBackgroundSync() {
  const { isOnline } = useNetworkStatus()

  const scheduleSync = useCallback((tag: string, data?: any) => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.sync.register(tag)
      }).catch(error => {
        console.error('Background sync registration failed:', error)
      })
    }
  }, [])

  return { scheduleSync, isOnline }
}

// Offline indicator component hook
export function useOfflineIndicator() {
  const { isOnline, queueSize } = useOfflineSupport()
  const [showIndicator, setShowIndicator] = useState(false)

  useEffect(() => {
    setShowIndicator(!isOnline || queueSize > 0)
  }, [isOnline, queueSize])

  return {
    showIndicator,
    isOnline,
    queueSize,
    message: !isOnline 
      ? 'Working offline' 
      : queueSize > 0 
        ? `${queueSize} items queued for sync`
        : '',
  }
}