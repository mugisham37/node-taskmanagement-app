import { SocketStream } from '@fastify/websocket';
import { logger } from '@/infrastructure/logging/logger';
import { nanoid } from 'nanoid';

export interface WebSocketUser {
  id: string;
  email: string;
  workspaceId?: string;
  roles: string[];
  permissions: string[];
}

export interface WebSocketConnectionMetadata {
  ip: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity?: Date;
  subscriptions?: Set<string>;
}

export interface WebSocketMessage {
  type: string;
  event: string;
  data: any;
  timestamp: number;
  messageId: string;
}

export class WebSocketConnection {
  private readonly id: string;
  private readonly socket: SocketStream;
  private readonly user: WebSocketUser;
  private readonly metadata: WebSocketConnectionMetadata;
  private subscriptions: Set<string> = new Set();
  private isAlive: boolean = true;
  private lastPingTime: number = Date.now();
  private messageQueue: WebSocketMessage[] = [];
  private isProcessingQueue: boolean = false;

  constructor(
    socket: SocketStream,
    user: WebSocketUser,
    metadata: WebSocketConnectionMetadata
  ) {
    this.id = nanoid();
    this.socket = socket;
    this.user = user;
    this.metadata = {
      ...metadata,
      subscriptions: new Set(),
    };

    this.setupSocketHandlers();
    logger.debug('WebSocket connection created', {
      connectionId: this.id,
      userId: user.id,
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(): void {
    this.socket.socket.on('message', data => {
      this.updateLastActivity();
      this.handleRawMessage(data);
    });

    this.socket.socket.on('close', (code, reason) => {
      this.isAlive = false;
      this.onCloseCallback?.(code, reason);
    });

    this.socket.socket.on('error', error => {
      this.isAlive = false;
      this.onErrorCallback?.(error);
    });

    this.socket.socket.on('pong', () => {
      this.isAlive = true;
      this.lastPingTime = Date.now();
      this.onPongCallback?.();
    });
  }

  /**
   * Handle raw message from socket
   */
  private handleRawMessage(data: Buffer | string): void {
    try {
      const messageStr = data.toString();
      const message: WebSocketMessage = JSON.parse(messageStr);

      // Validate message structure
      if (!message.type || !message.event) {
        logger.warn('Invalid WebSocket message format', {
          connectionId: this.id,
          userId: this.user.id,
        });
        return;
      }

      // Add metadata
      message.timestamp = Date.now();
      message.messageId = message.messageId || nanoid();

      this.onMessageCallback?.(message);
    } catch (error) {
      logger.error('Error parsing WebSocket message', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.id,
        userId: this.user.id,
      });
    }
  }

  /**
   * Send message to client
   */
  async send(
    event: string,
    data: any,
    options: { priority?: 'high' | 'normal' | 'low' } = {}
  ): Promise<void> {
    if (!this.isAlive) {
      logger.warn('Attempted to send message to closed connection', {
        connectionId: this.id,
        userId: this.user.id,
        event,
      });
      return;
    }

    const message: WebSocketMessage = {
      type: 'event',
      event,
      data,
      timestamp: Date.now(),
      messageId: nanoid(),
    };

    // Handle message priority
    if (options.priority === 'high') {
      await this.sendImmediately(message);
    } else {
      this.queueMessage(message);
    }
  }

  /**
   * Send message immediately (bypassing queue)
   */
  private async sendImmediately(message: WebSocketMessage): Promise<void> {
    try {
      const messageStr = JSON.stringify(message);
      this.socket.socket.send(messageStr);

      logger.debug('WebSocket message sent immediately', {
        connectionId: this.id,
        userId: this.user.id,
        event: message.event,
        messageId: message.messageId,
      });
    } catch (error) {
      logger.error('Error sending immediate WebSocket message', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.id,
        userId: this.user.id,
        event: message.event,
      });
      throw error;
    }
  }

  /**
   * Queue message for batch processing
   */
  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      setImmediate(() => this.processMessageQueue());
    }
  }

  /**
   * Process queued messages in batches
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const messages = this.messageQueue.splice(0, 10); // Process up to 10 messages at once

      for (const message of messages) {
        if (!this.isAlive) break;
        await this.sendImmediately(message);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message queue', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.id,
        userId: this.user.id,
      });
    } finally {
      this.isProcessingQueue = false;

      // Continue processing if there are more messages
      if (this.messageQueue.length > 0) {
        setImmediate(() => this.processMessageQueue());
      }
    }
  }

  /**
   * Subscribe to a channel/topic
   */
  subscribe(channel: string): void {
    this.subscriptions.add(channel);
    logger.debug('WebSocket connection subscribed to channel', {
      connectionId: this.id,
      userId: this.user.id,
      channel,
    });
  }

  /**
   * Unsubscribe from a channel/topic
   */
  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    logger.debug('WebSocket connection unsubscribed from channel', {
      connectionId: this.id,
      userId: this.user.id,
      channel,
    });
  }

  /**
   * Check if subscribed to a channel
   */
  isSubscribedTo(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  /**
   * Send ping to client
   */
  ping(): void {
    if (this.isAlive) {
      this.socket.socket.ping();
      this.lastPingTime = Date.now();
    }
  }

  /**
   * Close connection
   */
  async close(
    code: number = 1000,
    reason: string = 'Normal closure'
  ): Promise<void> {
    if (this.isAlive) {
      this.isAlive = false;
      this.socket.socket.close(code, reason);

      logger.debug('WebSocket connection closed', {
        connectionId: this.id,
        userId: this.user.id,
        code,
        reason,
      });
    }
  }

  /**
   * Update last activity timestamp
   */
  private updateLastActivity(): void {
    this.metadata.lastActivity = new Date();
  }

  // Event handlers
  private onMessageCallback?: (message: WebSocketMessage) => void;
  private onCloseCallback?: (code: number, reason: Buffer) => void;
  private onErrorCallback?: (error: Error) => void;
  private onPongCallback?: () => void;

  /**
   * Set message handler
   */
  onMessage(handler: (message: WebSocketMessage) => void): void {
    this.onMessageCallback = handler;
  }

  /**
   * Set close handler
   */
  onClose(handler: (code: number, reason: Buffer) => void): void {
    this.onCloseCallback = handler;
  }

  /**
   * Set error handler
   */
  onError(handler: (error: Error) => void): void {
    this.onErrorCallback = handler;
  }

  /**
   * Set pong handler
   */
  onPong(handler: () => void): void {
    this.onPongCallback = handler;
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getUser(): WebSocketUser {
    return this.user;
  }

  getMetadata(): WebSocketConnectionMetadata {
    return this.metadata;
  }

  getSubscriptions(): Set<string> {
    return new Set(this.subscriptions);
  }

  isConnectionAlive(): boolean {
    return this.isAlive;
  }

  getLastPingTime(): number {
    return this.lastPingTime;
  }

  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }
}
