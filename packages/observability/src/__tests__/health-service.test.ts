import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthService } from '../health-service';

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = new HealthService();
  });

  describe('checkHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      const healthStatus = await healthService.checkHealth();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('checks');
      expect(typeof healthStatus.timestamp).toBe('string');
    });
  });

  describe('addHealthCheck', () => {
    it('should add custom health checks', () => {
      const checkName = 'database';
      const checkFunction = vi.fn().mockResolvedValue({ status: 'healthy' });
      
      expect(() => {
        healthService.addHealthCheck(checkName, checkFunction);
      }).not.toThrow();
    });
  });

  describe('removeHealthCheck', () => {
    it('should remove health checks', () => {
      const checkName = 'database';
      const checkFunction = vi.fn().mockResolvedValue({ status: 'healthy' });
      
      healthService.addHealthCheck(checkName, checkFunction);
      
      expect(() => {
        healthService.removeHealthCheck(checkName);
      }).not.toThrow();
    });
  });
});