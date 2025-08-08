/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

/**
 * WebSocket connection info
 */
export interface ConnectionInfo {
  id: string;
  userId?: string;
  workspaceId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * WebSocket event types
 */
export enum WebSocketEventType {
  CONNECTION = 'connection',
  DISCONNECTION = 'disconnection',
  MESSAGE = 'message',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket room management
 */
export interface Room {
  id: string;
  name: string;
  connections: Set<string>;
  metadata?: Record<string, any>;
}
