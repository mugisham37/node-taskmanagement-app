import { User } from '@taskmanagement/domain';
import {
  ProjectUpdatedEvent,
  RealtimeEvent,
  TaskUpdatedEvent,
  UserJoinedEvent,
  UserLeftEvent,
} from '@taskmanagement/shared/types';
import { WebSocket } from 'ws';
import { Container } from '../../shared/container/Container';
import { SERVICE_TOKENS } from '../../shared/container/types';

export interface AuthenticatedWebSocket extends WebSocket {
  user?: User;
  rooms: Set<string>;
}

export class RealtimeManager {
  private connections = new Map<string, AuthenticatedWebSocket>();
  private rooms = new Map<string, Set<string>>(); // roomId -> Set of connectionIds

  constructor(private container: Container) {}

  async handleConnection(ws: AuthenticatedWebSocket, request: any): Promise<void> {
    const connectionId = this.generateConnectionId();
    ws.rooms = new Set();

    // Authenticate the connection
    const token = this.extractTokenFromRequest(request);
    if (token) {
      const authService = this.container.resolve<AuthApplicationService>(
        SERVICE_TOKENS.AUTH_APPLICATION_SERVICE
      );
      try {
        const authResult = await authService.validateToken(token);
        if (authResult.isSuccess && authResult.data?.user) {
          ws.user = authResult.data.user;
        }
      } catch (error) {
        console.warn('WebSocket authentication failed:', error);
      }
    }

    this.connections.set(connectionId, ws);

    ws.on('message', (data) => {
      this.handleMessage(connectionId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(connectionId);
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connection:established',
      data: {
        connectionId,
        authenticated: !!ws.user,
      },
    });
  }

  private handleMessage(connectionId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      const ws = this.connections.get(connectionId);

      if (!ws) return;

      switch (message.type) {
        case 'room:join':
          this.joinRoom(connectionId, message.data.roomId);
          break;
        case 'room:leave':
          this.leaveRoom(connectionId, message.data.roomId);
          break;
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong', data: {} });
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private handleDisconnection(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    if (!ws) return;

    // Leave all rooms
    ws.rooms.forEach((roomId) => {
      this.leaveRoom(connectionId, roomId);
    });

    // Remove connection
    this.connections.delete(connectionId);

    // Broadcast user left event if authenticated
    if (ws.user) {
      this.broadcastUserLeft(ws.user);
    }
  }

  private joinRoom(connectionId: string, roomId: string): void {
    const ws = this.connections.get(connectionId);
    if (!ws || !ws.user) return;

    // Add connection to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(connectionId);
    ws.rooms.add(roomId);

    // Send confirmation
    this.sendToConnection(connectionId, {
      type: 'room:joined',
      data: { roomId },
    });

    // Broadcast user joined event to room
    this.broadcastToRoom(
      roomId,
      {
        type: 'user:joined',
        data: {
          user: ws.user,
          roomId,
        },
      } as UserJoinedEvent,
      connectionId
    );
  }

  private leaveRoom(connectionId: string, roomId: string): void {
    const ws = this.connections.get(connectionId);
    if (!ws) return;

    // Remove connection from room
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    ws.rooms.delete(roomId);

    // Send confirmation
    this.sendToConnection(connectionId, {
      type: 'room:left',
      data: { roomId },
    });

    // Broadcast user left event to room if authenticated
    if (ws.user) {
      this.broadcastToRoom(
        roomId,
        {
          type: 'user:left',
          data: {
            user: ws.user,
            roomId,
          },
        } as UserLeftEvent,
        connectionId
      );
    }
  }

  // Public methods for broadcasting events
  async broadcastTaskUpdate(taskId: string, update: any): Promise<void> {
    const event: TaskUpdatedEvent = {
      type: 'task:updated',
      data: {
        taskId,
        update,
        timestamp: new Date(),
      },
    };

    // Broadcast to task-specific room
    this.broadcastToRoom(`task:${taskId}`, event);

    // Also broadcast to project room if task has projectId
    if (update.projectId) {
      this.broadcastToRoom(`project:${update.projectId}`, event);
    }
  }

  async broadcastProjectUpdate(projectId: string, update: any): Promise<void> {
    const event: ProjectUpdatedEvent = {
      type: 'project:updated',
      data: {
        projectId,
        update,
        timestamp: new Date(),
      },
    };

    this.broadcastToRoom(`project:${projectId}`, event);
  }

  private broadcastUserLeft(user: User): void {
    const event: UserLeftEvent = {
      type: 'user:left',
      data: {
        user,
        roomId: 'global',
      },
    };

    this.broadcastToAll(event);
  }

  private broadcastToRoom(
    roomId: string,
    event: RealtimeEvent,
    excludeConnectionId?: string
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.forEach((connectionId) => {
      if (connectionId !== excludeConnectionId) {
        this.sendToConnection(connectionId, event);
      }
    });
  }

  private broadcastToAll(event: RealtimeEvent, excludeConnectionId?: string): void {
    this.connections.forEach((ws, connectionId) => {
      if (connectionId !== excludeConnectionId) {
        this.sendToConnection(connectionId, event);
      }
    });
  }

  private sendToConnection(connectionId: string, event: RealtimeEvent): void {
    const ws = this.connections.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      ws.send(JSON.stringify(event));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      this.handleDisconnection(connectionId);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractTokenFromRequest(request: any): string | null {
    // Try to extract token from query parameters
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (token) return token;

    // Try to extract from headers
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  // Utility methods for room management
  getUserRooms(userId: string): string[] {
    const rooms: string[] = [];
    this.connections.forEach((ws, connectionId) => {
      if (ws.user?.id === userId) {
        rooms.push(...Array.from(ws.rooms));
      }
    });
    return [...new Set(rooms)]; // Remove duplicates
  }

  getRoomUsers(roomId: string): User[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const users: User[] = [];
    room.forEach((connectionId) => {
      const ws = this.connections.get(connectionId);
      if (ws?.user) {
        users.push(ws.user);
      }
    });

    // Remove duplicate users (same user might have multiple connections)
    const uniqueUsers = users.filter(
      (user, index, self) => index === self.findIndex((u) => u.id === user.id)
    );

    return uniqueUsers;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
