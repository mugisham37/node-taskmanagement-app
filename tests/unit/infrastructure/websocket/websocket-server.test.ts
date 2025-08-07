import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from '@/infrastructure/websocket/websocket-server';
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

vi.mock('@/infrastructure/config/environment', () => ({
  config: {
    auth: {
      jwtSecret: 'test-secret-key-that-is-long-enough-for-testing',
      jwtIssuer: 'test-issuer',
      jwtAudience: 'test-audience',
    },
  },
}));

describe('WebSocketServer', () => {
  let wsServer: WebSocketServer;

  beforeEach(() => {
    wsServer = new WebSocketServer({
      heartbeatInterval: 1000,
      connectionTimeout: 5000,
      maxConnections: 100,
      enableCompression: true,
      enableMetrics: true,
    });
  });

  afterEach(async () => {
    await wsServer.shutdown();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultServer = new WebSocketServer();
      expect(defaultServer).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        heartbeatInterval: 2000,
        connectionTimeout: 10000,
        maxConnections: 500,
        enableCompression: false,
        enableMetrics: false,
      };

      const customServer = new WebSocketServer(customConfig);
      expect(customServer).toBeDefined();
    });
  });

  describe('server statistics', () => {
    it('should return server statistics', () => {
      const stats = wsServer.getStats();

      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('config');
    });
  });

  describe('broadcasting', () => {
    it('should handle workspace broadcast with no connections', async () => {
      await expect(
        wsServer.broadcastToWorkspace('workspace-1', 'test.event', {
          message: 'test',
        })
      ).resolves.not.toThrow();
    });

    it('should handle project broadcast with no connections', async () => {
      await expect(
        wsServer.broadcastToProject('project-1', 'test.event', {
          message: 'test',
        })
      ).resolves.not.toThrow();
    });

    it('should handle user message with no connections', async () => {
      const result = await wsServer.sendToUser('user-1', 'test.event', {
        message: 'test',
      });
      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(wsServer.shutdown()).resolves.not.toThrow();
    });
  });
});
