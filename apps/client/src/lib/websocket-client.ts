import { EventEmitter } from 'events';

interface WebSocketClientOptions {
  url: string;
  protocols?: string | string[];
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  timeout?: number;
  debug?: boolean;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  messageId: string;
  userId?: string;
  channel?: string;
}

interface ConnectionStats {
  connectedAt?: Date;
  reconnectCount: number;
  messagesReceived: number;
  messagesSent: number;
  lastHeartbeat?: Date;
  averageLatency: number;
  latencyHistory: number[];
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private subscriptions = new Set<string>();
  private stats: ConnectionStats = {
    reconnectCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    averageLatency: 0,
    latencyHistory: [],
  };

  private _isConnected = false;
  private _isConnecting = false;
  private _shouldReconnect = true;

  constructor(options: WebSocketClientOptions) {
    super();
    
    this.options = {
      reconnectAttempts: 10,
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      timeout: 10000,
      debug: false,
      protocols: [],
      ...options,
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('open', () => {
      this._isConnected = true;
      this._isConnecting = false;
      this.stats.connectedAt = new Date();
      this.processMessageQueue();
      this.startHeartbeat();
      
      if (this.options.debug) {
        console.log('[WebSocketClient] Connected');
      }
    });

    this.on('close', (event: CloseEvent) => {
      this._isConnected = false;
      this._isConnecting = false;
      this.stopHeartbeat();
      
      if (this.options.debug) {
        console.log('[WebSocketClient] Disconnected:', event.code, event.reason);
      }

      if (this._shouldReconnect && event.code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.on('error', (error: Event) => {
      this._isConnecting = false;
      
      if (this.options.debug) {
        console.error('[WebSocketClient] Error:', error);
      }
    });

    this.on('message', (message: WebSocketMessage) => {
      this.stats.messagesReceived++;
      
      if (message.type === 'pong') {
        this.handlePong(message);
        return;
      }

      if (this.options.debug) {
        console.log('[WebSocketClient] Message received:', message.type);
      }
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._isConnected || this._isConnecting) {
        resolve();
        return;
      }

      this._isConnecting = true;
      this._shouldReconnect = true;

      try {
        this.ws = new WebSocket(this.options.url, this.options.protocols);
        
        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            reject(new Error('Connection timeout'));
          }
        }, this.options.timeout);

        this.ws.onopen = (event) => {
          clearTimeout(timeout);
          this.emit('open', event);
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.emit('close', event);
          if (!this._isConnected) {
            reject(new Error(`Connection failed: ${event.code} ${event.reason}`));
          }
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          this.emit('error', event);
          reject(new Error('WebSocket error'));
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.emit('message', message);
          } catch (error) {
            console.error('[WebSocketClient] Failed to parse message:', error);
          }
        };

      } catch (error) {
        this._isConnecting = false;
        reject(error);
      }
    });
  }

  public disconnect(): void {
    this._shouldReconnect = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  public send(type: string, payload: any, channel?: string): boolean {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
      channel,
    };

    if (this._isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
        
        if (this.options.debug) {
          console.log('[WebSocketClient] Message sent:', type);
        }
        
        return true;
      } catch (error) {
        console.error('[WebSocketClient] Failed to send message:', error);
        this.queueMessage(message);
        return false;
      }
    } else {
      this.queueMessage(message);
      return false;
    }
  }

  public subscribe(channel: string): boolean {
    this.subscriptions.add(channel);
    return this.send('subscribe', { channel });
  }

  public unsubscribe(channel: string): boolean {
    this.subscriptions.delete(channel);
    return this.send('unsubscribe', { channel });
  }

  public joinRoom(roomId: string): boolean {
    return this.send('room:join', { roomId });
  }

  public leaveRoom(roomId: string): boolean {
    return this.send('room:leave', { roomId });
  }

  public updatePresence(presence: any): boolean {
    return this.send('presence:update', presence);
  }

  public getStats(): ConnectionStats {
    return { ...this.stats };
  }

  public isConnected(): boolean {
    return this._isConnected;
  }

  public isConnecting(): boolean {
    return this._isConnecting;
  }

  public getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  public clearMessageQueue(): void {
    this.messageQueue = [];
  }

  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
    
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(message));
          this.stats.messagesSent++;
        } catch (error) {
          console.error('[WebSocketClient] Failed to send queued message:', error);
          this.queueMessage(message);
        }
      } else {
        this.queueMessage(message);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this._isConnected) {
        const pingTime = Date.now();
        this.send('ping', { timestamp: pingTime });
        
        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('[WebSocketClient] Heartbeat timeout - reconnecting');
          this.ws?.close();
        }, 10000);
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private handlePong(message: WebSocketMessage): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    const latency = Date.now() - (message.payload?.timestamp || 0);
    this.updateLatencyStats(latency);
    this.stats.lastHeartbeat = new Date();

    this.emit('heartbeat', { latency });
  }

  private updateLatencyStats(latency: number): void {
    this.stats.latencyHistory.push(latency);
    
    // Keep only last 10 measurements
    if (this.stats.latencyHistory.length > 10) {
      this.stats.latencyHistory.shift();
    }
    
    // Calculate average
    this.stats.averageLatency = this.stats.latencyHistory.reduce((sum, l) => sum + l, 0) / this.stats.latencyHistory.length;
  }

  private scheduleReconnect(): void {
    if (this.stats.reconnectCount >= this.options.reconnectAttempts) {
      console.error('[WebSocketClient] Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(1.5, this.stats.reconnectCount),
      30000
    );

    this.stats.reconnectCount++;
    
    if (this.options.debug) {
      console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.stats.reconnectCount})`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[WebSocketClient] Reconnection failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Resubscribe to channels after reconnection
  private resubscribeToChannels(): void {
    this.subscriptions.forEach(channel => {
      this.send('subscribe', { channel });
    });
  }
}

// Singleton instance for global use
let globalWebSocketClient: WebSocketClient | null = null;

export function createWebSocketClient(options: WebSocketClientOptions): WebSocketClient {
  if (globalWebSocketClient) {
    globalWebSocketClient.disconnect();
  }
  
  globalWebSocketClient = new WebSocketClient(options);
  return globalWebSocketClient;
}

export function getWebSocketClient(): WebSocketClient | null {
  return globalWebSocketClient;
}