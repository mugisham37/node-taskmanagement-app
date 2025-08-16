import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearMetrics,
    createTimer,
    getPerformanceStats,
    PerformanceMonitor
} from '../performance-monitor';

describe('Performance Monitor', () => {
  beforeEach(() => {
    clearMetrics();
  });

  describe('getPerformanceStats', () => {
    it('should return initial stats', () => {
      const stats = getPerformanceStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('createTimer', () => {
    it('should create a timer and measure duration', async () => {
      const timer = createTimer('test-operation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = timer.end();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('PerformanceMonitor class', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
    });

    it('should start and end timers', () => {
      const timer = monitor.startTimer('test');
      const duration = timer.end();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should record metrics', () => {
      monitor.recordMetric('test-metric', 100);
      const metrics = monitor.getMetrics();
      expect(metrics['test-metric']).toBeDefined();
      expect(metrics['test-metric'].count).toBe(1);
      expect(metrics['test-metric'].avg).toBe(100);
    });

    it('should clear metrics', () => {
      monitor.recordMetric('test-metric', 100);
      monitor.clear();
      const metrics = monitor.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });
});