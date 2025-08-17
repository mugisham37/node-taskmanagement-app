import { appConfig } from '@/config/app'

// WebSocket message types
export interface WebSocketMessage {
  type: string
  data?: any
  id?: string
  timestamp?: number
}

// WebSocket event types
export type WebSocketEventType = 
  | 'open'
  | 'close' 
  | 'error'
  | 'message'
  | 'reconnect'
  | 'reconnecting'
  | 'reconnect_failed'

// WebSocket event handler
export type WebSocketEventHandler = (event?: any) => void

// WebSocket connection states
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

// WebSocket configuration
interface WebSocketConfig {
  url: string
  protocols?: string[]
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatMessage?: WebSocketMessage
  debug?: boolean
}

// Enhanced WebSocket client with reconnection and heartbeat
export class EnhancedWebSocket {
  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private eventHandlers: Map<WebSocketEventType, Set<WebSocketEventHandler>> = new Map()
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isManualClose = false
  private messageQueue: WebSocketMessage[] = []

  constructor(config: WebSocketConfig) {
    this.config = {
      protocols: [],
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      heartbeatMessage: { type: 'ping' },
      debug: appConfig.isDevelopment,
      ...config,
    }

    // Initialize event handler maps
    const eventTypes: WebSocketEventType[] = [
      'open', 'close', 'error', 'message', 'reconnect', 'reconnecting', 'reconnect_failed'
    ]
    eventTypes.forEach(type => {
      this.eventHandlers.set(type, new Set())
    })
  }

  // Connect to WebSocket
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
      return
    }

    this.isManualClose = false
    this.log('Connecting to WebSocket:', this.config.url)

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols)
      this.setupEventListeners()
    } catch (error) {
      this.log('Failed to create WebSocket connection:', error)
      this.emit('error', error)
      this.scheduleReconnect()
    }
  }

  // Disconnect from WebSocket
  disconnect(): void {
    this.isManualClose = true
    this.clearTimers()
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }
  }

  // Send message
  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocketState.OPEN) {
      // Queue message for later sending
      this.messageQueue.push(message)
      this.log('Message queued (WebSocket not ready):', message)
      return false
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now(),
      }
      
      this.ws.send(JSON.stringify(messageWithTimestamp))
      this.log('Message sent:', messageWithTimestamp)
      return true
    } catch (error) {
      this.log('Failed to send message:', error)
      this.emit('error', error)
      return false
    }
  }

  // Send queued messages
  private sendQueuedMessages(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocketState.OPEN) {
      const message = this.messageQueue.shift()!
      this.send(message)
    }
  }

  // Add event listener
  on(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.add(handler)
    }
  }

  // Remove event listener
  off(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  // Add message handler for specific message type
  onMessage(type: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)
  }

  // Remove message handler
  offMessage(type: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(type)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  // Get connection state
  get readyState(): WebSocketState {
    return this.ws?.readyState ?? WebSocketState.CLOSED
  }

  // Get connection status
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocketState.OPEN
  }

  // Get connection URL
  get url(): string {
    return this.config.url
  }

  // Emit event to handlers
  private emit(event: WebSocketEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          this.log('Error in event handler:', error)
        }
      })
    }
  }

  // Setup WebSocket event listeners
  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onopen = (event) => {
      this.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.clearReconnectTimer()
      this.startHeartbeat()
      this.sendQueuedMessages()
      this.emit('open', event)
    }

    this.ws.onclose = (event) => {
      this.log('WebSocket disconnected:', event.code, event.reason)
      this.clearHeartbeat()
      this.emit('close', event)
      
      if (!this.isManualClose && this.config.reconnect) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (event) => {
      this.log('WebSocket error:', event)
      this.emit('error', event)
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.log('Message received:', message)
        
        // Handle heartbeat response
        if (message.type === 'pong') {
          return
        }
        
        // Emit generic message event
        this.emit('message', message)
        
        // Emit specific message type handlers
        const handlers = this.messageHandlers.get(message.type)
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(message.data)
            } catch (error) {
              this.log('Error in message handler:', error)
            }
          })
        }
      } catch (error) {
        this.log('Failed to parse message:', error)
      }
    }
  }

  // Schedule reconnection attempt
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached')
      this.emit('reconnect_failed')
      return
    }

    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay })
    
    this.reconnectTimer = setTimeout(() => {
      this.log(`Reconnect attempt ${this.reconnectAttempts}`)
      this.connect()
    }, delay)
  }

  // Start heartbeat
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocketState.OPEN) {
        this.send(this.config.heartbeatMessage)
      }
    }, this.config.heartbeatInterval)
  }

  // Clear heartbeat timer
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // Clear reconnect timer
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // Clear all timers
  private clearTimers(): void {
    this.clearHeartbeat()
    this.clearReconnectTimer()
  }

  // Log message (if debug enabled)
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args)
    }
  }
}

// WebSocket service for the application
export class WebSocketService {
  private ws: EnhancedWebSocket | null = null
  private token: string | null = null

  // Initialize WebSocket connection
  init(token: string): void {
    this.token = token
    this.connect()
  }

  // Connect to WebSocket
  private connect(): void {
    if (!this.token) {
      console.warn('Cannot connect to WebSocket: No authentication token')
      return
    }

    const wsUrl = `${appConfig.wsUrl}?token=${this.token}`
    
    this.ws = new EnhancedWebSocket({
      url: wsUrl,
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      debug: appConfig.isDevelopment,
    })

    // Setup event handlers
    this.ws.on('open', () => {
      console.log('WebSocket service connected')
      // Send authentication message
      this.send({
        type: 'auth',
        data: { token: this.token },
      })
    })

    this.ws.on('close', () => {
      console.log('WebSocket service disconnected')
    })

    this.ws.on('error', (error) => {
      console.error('WebSocket service error:', error)
    })

    this.ws.on('reconnect_failed', () => {
      console.error('WebSocket service failed to reconnect')
    })

    this.ws.connect()
  }

  // Disconnect from WebSocket
  disconnect(): void {
    if (this.ws) {
      this.ws.disconnect()
      this.ws = null
    }
    this.token = null
  }

  // Send message
  send(message: WebSocketMessage): boolean {
    if (!this.ws) {
      console.warn('WebSocket service not initialized')
      return false
    }
    return this.ws.send(message)
  }

  // Subscribe to events
  on(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    if (this.ws) {
      this.ws.on(event, handler)
    }
  }

  // Unsubscribe from events
  off(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    if (this.ws) {
      this.ws.off(event, handler)
    }
  }

  // Subscribe to message types
  onMessage(type: string, handler: (data: any) => void): void {
    if (this.ws) {
      this.ws.onMessage(type, handler)
    }
  }

  // Unsubscribe from message types
  offMessage(type: string, handler: (data: any) => void): void {
    if (this.ws) {
      this.ws.offMessage(type, handler)
    }
  }

  // Get connection status
  get isConnected(): boolean {
    return this.ws?.isConnected ?? false
  }

  // Get connection state
  get readyState(): WebSocketState {
    return this.ws?.readyState ?? WebSocketState.CLOSED
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService()

// Export types and enums
export { WebSocketService, webSocketService, WebSocketState }
export type { WebSocketEventHandler, WebSocketEventType, WebSocketMessage }

