# @taskmanagement/observability

Comprehensive observability package for monitoring, metrics, logging, tracing, health checks, alerts, dashboards, profiling, APM, and error tracking.

## Features

- **Logging Service**: Structured logging with Winston
- **Metrics Service**: Prometheus metrics collection and exposition
- **Health Service**: Health check management and monitoring
- **Distributed Tracing**: OpenTelemetry integration for tracing
- **Error Tracking**: Comprehensive error tracking and reporting
- **APM Integration**: Application Performance Monitoring
- **Alerting**: Alert management and notification system
- **Dashboards**: Grafana dashboard configurations

## Installation

```bash
npm install @taskmanagement/observability
```

## Usage

```typescript
import { LoggingService, MetricsService, HealthService } from '@taskmanagement/observability';

// Initialize services
const logger = new LoggingService();
const metrics = new MetricsService();
const health = new HealthService();

// Log messages
logger.info('Application started');
logger.error('An error occurred', { error: 'details' });

// Record metrics
metrics.incrementCounter('requests_total', { method: 'GET', status: '200' });
metrics.recordHistogram('request_duration', 0.5, { endpoint: '/api/users' });

// Health checks
health.addHealthCheck('database', async () => {
  // Check database connectivity
  return { status: 'healthy', details: 'Database is responsive' };
});

const healthStatus = await health.checkHealth();
```

## Testing

```bash
npm test
npm run test:coverage
npm run test:watch
```

## Dependencies

- Winston for logging
- Prometheus client for metrics
- OpenTelemetry for tracing
- Sentry for error tracking
- Various monitoring and observability tools