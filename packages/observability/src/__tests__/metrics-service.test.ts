import { beforeEach, describe, expect, it } from 'vitest';
import { MetricsService } from '../metrics-service';

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  describe('incrementCounter', () => {
    it('should increment counter metrics correctly', () => {
      const metricName = 'test_counter';
      const labels = { method: 'GET', status: '200' };
      
      expect(() => {
        metricsService.incrementCounter(metricName, labels);
      }).not.toThrow();
    });
  });

  describe('recordHistogram', () => {
    it('should record histogram metrics correctly', () => {
      const metricName = 'test_histogram';
      const value = 0.5;
      const labels = { endpoint: '/api/test' };
      
      expect(() => {
        metricsService.recordHistogram(metricName, value, labels);
      }).not.toThrow();
    });
  });

  describe('setGauge', () => {
    it('should set gauge metrics correctly', () => {
      const metricName = 'test_gauge';
      const value = 100;
      const labels = { service: 'api' };
      
      expect(() => {
        metricsService.setGauge(metricName, value, labels);
      }).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const metrics = await metricsService.getMetrics();
      
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
    });
  });
});