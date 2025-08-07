import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocketConnectionManager } from '@/infrastructure/websocket/websocket-connection-manager';
import { WebSocketConnection } from '@/infrastructure/websocket/websocket-connection';

// Mock dependencies
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock WebSocketConnection
const createMockConnection = (userId: string, workspaceId?: string) => {
  const mockConnection = {
    getId: vi.fn().mockReturnValue(`conn-${userId}`),
    getUser: vi.fn().mockReturnValue({
      id: userId,
      email: `${userId}@example.com`,
      workspaceId,
      roles: ['user'],
      permissions: ['read'],
    }),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    isConnectionAlive: vi.fn().mockReturnValue(true),
    getLastPingTime: vi.fn().mockReturnValue(Date.now()),
    close: vi.fn(),
  } as unknown as WebSocketConnection;

  return mockConnection;
};

describe('WebSocketConnectionManager', () => {
  let connectionManager: WebSocketConnectionManager;
  const mockConfig = {
    heartbeatInterval: 1000,
    connectionTimeout: 5000,
    maxConnections: 100,
    enableCompression: true,
    enableMetrics: true,
  };

  beforeEach(() => {
    connectionManager = new WebSocketConnectionManager(mockConfig);
  });

  describe('connection management', () => {
    it('should add a connection successfully', async () => {
      const mockConnection = createMockConnection('user1', 'workspace1');

      await connectionManager.addConnection(mockConnection);

      expect(connectionManager.getActiveConnectionCount()).toBe(1);
      expect(mockConnection.subscribe).toHaveBeenCalledWith('user:user1');
      expect(mockConnection.subscribe).toHaveBeenCalledWith(
        'workspace:workspace1'
      );
    });

    it('should remove a connection successfully', async () => {
      const mockConnection = createMockConnection('user1', 'workspace1');

      await connectionManager.addConnection(mockConnection);
      expect(connectionManager.getActiveConnectionCount()).toBe(1);

      await connectionManager.removeConnection(mockConnection.getId());
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });

    it('should handle removing non-existent connection', async () => {
      await expect(
        connectionManager.removeConnection('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('connection retrieval', () => {
    beforeEach(async () => {
      const connection1 = createMockConnection('user1', 'workspace1');
      const connection2 = createMockConnection('user2', 'workspace1');
      const connection3 = createMockConnection('user3', 'workspace2');

      await connectionManager.addConnection(connection1);
      await connectionManager.addConnection(connection2);
      await connectionManager.addConnection(connection3);
    });

    it('should get connections by user', () => {
      const userConnections = connectionManager.getConnectionsByUser('user1');
      expect(userConnections).toHaveLength(1);
      expect(userConnections[0].getUser().id).toBe('user1');
    });

    it('should get connections by workspace', () => {
      const workspaceConnections =
        connectionManager.getConnectionsByWorkspace('workspace1');
      expect(workspaceConnections).toHaveLength(2);
    });

    it('should get empty array for non-existent workspace', () => {
      const connections =
        connectionManager.getConnectionsByWorkspace('non-existent');
      expect(connections).toHaveLength(0);
    });

    it('should get all connections', () => {
      const allConnections = connectionManager.getAllConnections();
      expect(allConnections).toHaveLength(3);
    });
  });

  describe('project subscriptions', () => {
    let mockConnection: WebSocketConnection;

    beforeEach(async () => {
      mockConnection = createMockConnection('user1', 'workspace1');
      await connectionManager.addConnection(mockConnection);
    });

    it('should subscribe connection to project', () => {
      connectionManager.subscribeToProject(mockConnection.getId(), 'project1');

      expect(mockConnection.subscribe).toHaveBeenCalledWith('project:project1');

      const projectConnections =
        connectionManager.getConnectionsByProject('project1');
      expect(projectConnections).toHaveLength(1);
    });

    it('should unsubscribe connection from project', () => {
      connectionManager.subscribeToProject(mockConnection.getId(), 'project1');
      connectionManager.unsubscribeFromProject(
        mockConnection.getId(),
        'project1'
      );

      expect(mockConnection.unsubscribe).toHaveBeenCalledWith(
        'project:project1'
      );

      const projectConnections =
        connectionManager.getConnectionsByProject('project1');
      expect(projectConnections).toHaveLength(0);
    });

    it('should handle subscribing non-existent connection', () => {
      expect(() => {
        connectionManager.subscribeToProject('non-existent', 'project1');
      }).not.toThrow();
    });
  });

  describe('connection info', () => {
    it('should return connection info', async () => {
      const connection1 = createMockConnection('user1', 'workspace1');
      const connection2 = createMockConnection('user2', 'workspace1');

      await connectionManager.addConnection(connection1);
      await connectionManager.addConnection(connection2);

      const info = connectionManager.getConnectionInfo();

      expect(info.totalConnections).toBe(2);
      expect(info.activeConnections).toBe(2);
      expect(info.connectionsByWorkspace['workspace1']).toBe(2);
      expect(info.connectionsByUser['user1']).toBe(1);
      expect(info.connectionsByUser['user2']).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should close all connections', async () => {
      const connection1 = createMockConnection('user1', 'workspace1');
      const connection2 = createMockConnection('user2', 'workspace1');

      await connectionManager.addConnection(connection1);
      await connectionManager.addConnection(connection2);

      await connectionManager.closeAllConnections(1001, 'Test shutdown');

      expect(connection1.close).toHaveBeenCalledWith(1001, 'Test shutdown');
      expect(connection2.close).toHaveBeenCalledWith(1001, 'Test shutdown');
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });
  });
});
