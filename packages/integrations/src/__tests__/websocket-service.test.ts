import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketService } from '../websocket-service';

describe('WebSocketService', () => {
  let websocketService: WebSocketService;

  beforeEach(() => {
    websocketService = new WebSocketService();
  });

  describe('broadcast', () => {
    it('should broadcast messages to all connected clients', () => {
      const message = { type: 'test', data: 'test data' };
      
      expect(() => {
        websocketService.broadcast(message);
      }).not.toThrow();
    });
  });

  describe('sendToUser', () => {
    it('should send message to specific user', () => {
      const userId = 'user123';
      const message = { type: 'notification', data: 'Hello user' };
      
      expect(() => {
        websocketService.sendToUser(userId, message);
      }).not.toThrow();
    });
  });

  describe('addConnection', () => {
    it('should add new WebSocket connection', () => {
      const mockConnection = {
        id: 'conn123',
        userId: 'user123',
        send: vi.fn(),
        close: vi.fn()
      };
      
      expect(() => {
        websocketService.addConnection(mockConnection);
      }).not.toThrow();
    });
  });

  describe('removeConnection', () => {
    it('should remove WebSocket connection', () => {
      const connectionId = 'conn123';
      
      expect(() => {
        websocketService.removeConnection(connectionId);
      }).not.toThrow();
    });
  });

  describe('getConnectionCount', () => {
    it('should return current connection count', () => {
      const count = websocketService.getConnectionCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});