import { appConfig } from '@/config/app'
import { useAppDispatch, useAppSelector } from '@/store'
import { selectIsAuthenticated, selectToken } from '@/store/slices/authSlice'
import { addNotification, setRealTimeConnected } from '@/store/slices/notificationsSlice'
import { createContext, ReactNode, useContext, useEffect, useRef } from 'react'

interface WebSocketContextType {
  socket: WebSocket | null
  isConnected: boolean
  sendMessage: (message: any) => void
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  sendMessage: () => {},
})

export const useWebSocket = () => useContext(WebSocketContext)

interface WebSocketProviderProps {
  children: ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const token = useAppSelector(selectToken)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 1000 // Start with 1 second

  const connect = () => {
    if (!isAuthenticated || !token || socketRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const wsUrl = `${appConfig.wsUrl}?token=${token}`
      const socket = new WebSocket(wsUrl)

      socket.onopen = () => {
        console.log('WebSocket connected')
        dispatch(setRealTimeConnected(true))
        reconnectAttempts.current = 0
        
        // Send authentication message
        socket.send(JSON.stringify({
          type: 'auth',
          token,
        }))
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        dispatch(setRealTimeConnected(false))
        socketRef.current = null

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && isAuthenticated && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current)
          reconnectAttempts.current++
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }

      socket.onerror = (error) => {
        console.error('WebSocket error:', error)
        dispatch(setRealTimeConnected(false))
      }

      socketRef.current = socket
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (socketRef.current) {
      socketRef.current.close(1000, 'User logout')
      socketRef.current = null
    }

    dispatch(setRealTimeConnected(false))
    reconnectAttempts.current = 0
  }

  const sendMessage = (message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message)
    }
  }

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'notification':
        dispatch(addNotification({
          type: message.data.type || 'info',
          title: message.data.title,
          message: message.data.message,
          duration: message.data.duration,
        }))
        break

      case 'task_updated':
        // Handle real-time task updates
        // This would dispatch actions to update the tasks state
        console.log('Task updated:', message.data)
        break

      case 'project_updated':
        // Handle real-time project updates
        console.log('Project updated:', message.data)
        break

      case 'user_presence':
        // Handle user presence updates
        console.log('User presence:', message.data)
        break

      case 'system_alert':
        dispatch(addNotification({
          type: 'warning',
          title: 'System Alert',
          message: message.data.message,
          duration: 10000, // Show system alerts longer
        }))
        break

      case 'pong':
        // Handle ping/pong for connection health
        break

      default:
        console.log('Unknown WebSocket message type:', message.type)
    }
  }

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, token])

  // Ping/pong for connection health
  useEffect(() => {
    if (!isAuthenticated) return

    const pingInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' })
      }
    }, 30000) // Ping every 30 seconds

    return () => clearInterval(pingInterval)
  }, [isAuthenticated])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, we might want to reduce activity
      } else {
        // Page is visible, ensure connection is active
        if (isAuthenticated && token && (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, token])

  const contextValue: WebSocketContextType = {
    socket: socketRef.current,
    isConnected: socketRef.current?.readyState === WebSocket.OPEN,
    sendMessage,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}