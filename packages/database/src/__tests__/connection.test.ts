import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseConfig } from '../config';
import { DatabaseConnection } from '../connection';

describe('DatabaseConnection', () => {
  let connection: DatabaseConnection;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = createDatabaseConfig('test');
    connection = DatabaseConnection.getInstance(mockConfig);
  });

  afterEach(async () => {
    if (connection) {
      await connection.disconnect();
    }
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DatabaseConnection.getInstance(mockConfig);
      const instance2 = DatabaseConnection.getInstance(mockConfig);
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance with different config', () => {
      const config2 = { ...mockConfig, database: 'different_db' };
      const instance1 = DatabaseConnection.getInstance(mockConfig);
      const instance2 = DatabaseConnection.getInstance(config2);
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('connect', () => {
    it('should establish database connection', async () => {
      const connectSpy = vi.spyOn(connection, 'connect');
      
      await connection.connect();
      
      expect(connectSpy).toHaveBeenCalled();
      expect(connection.isConnected()).toBe(true);
    });

    it('should handle connection errors gracefully', async () => {
      const invalidConfig = { ...mockConfig, port: 9999 };
      const invalidConnection = DatabaseConnection.getInstance(invalidConfig);
      
      await expect(invalidConnection.connect()).rejects.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should close database connection', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
      
      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    });
  });

  describe('health check', () => {
    it('should return healthy status when connected', async () => {
      await connection.connect();
      
      const health = await connection.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy status when disconnected', async () => {
      const health = await connection.healthCheck();
      
      expect(health.status).toBe('unhealthy');
    });
  });
});