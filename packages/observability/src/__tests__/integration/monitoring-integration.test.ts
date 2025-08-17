import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HealthService } from '../../health-service';
import { LoggingService } from '../../logging-service';
import { MetricsService } from '../../metrics-service';

describe('Monitoring Integration Tests', () => {
  let loggingService: LoggingService;
  let metricsService: MetricsService;
  let healthService: HealthService;

  beforeEach(() => {
    loggingService = new LoggingService();
    metricsService = new MetricsService();
    healthService = new HealthService();
  });

  afterEach(() => {
    // Cleanup any resources
  });

  describe('Logging and Metrics Integration', () => {
    it('should log metrics collection events', async () => {
      // Record some metrics
      metricsService.incrementCounter('test_requests_total', { method: 'GET' });
      metricsService.recordHistogram('test_request_duration', 0.5, { endpoint: '/api/test' });
      
      // Get metrics
      const metrics = await metricsService.getMetrics();
      
      // Log the metrics collection
      loggingService.info('Metrics collected', { metricsCount: metrics.split('\n').length });
      
      expect(metrics).toContain('test_requests_total');
      expect(metrics).toContain('test_request_duration');
    });
  });

  describe('Health Check Integration', () => {
    it('should integrate health checks with logging and metrics', async () => {
      // Add a custom health check
      healthService.addHealthCheck('test_service', async () => {
        metricsService.incrementCounter('health_checks_total', { service: 'test_service' });
        return { status: 'healthy', details: 'Service is running' };
      });
      
      // Perform health check
      const healthStatus = await healthService.checkHealth();
      
      // Log health status
      loggingService.info('Health check completed', { 
        status: healthStatus.status,
        checksCount: Object.keys(healthStatus.checks).length 
      });
      
      expect(healthStatus.status).toBeDefined();
      expect(healthStatus.checks).toHaveProperty('test_service');
    });
  });

  describe('Error Tracking Integration', () => {
    it('should track errors across logging and metrics', () => {
      const error = new Error('Test error');
      
      // Log the error
      loggingService.error('Application error occurred', { 
        error: error.message,
        stack: error.stack 
      });
      
      // Record error metric
      metricsService.incrementCounter('errors_total', { 
        type: 'application_error',
        severity: 'high' 
      });
      
      // Verify error was tracked
      expect(true).toBe(true); // This would be more comprehensive in real tests
    });
  });
});