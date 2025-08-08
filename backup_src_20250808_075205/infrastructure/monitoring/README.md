# Enterprise Platform Monitoring and Observability System

This comprehensive monitoring and observability system provides enterprise-grade monitoring capabilities for the Unified Enterprise Platform. It includes structured logging, Prometheus metrics, health checks, alerting, and operational runbooks.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring & Observability                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Logging   │  │   Metrics   │  │   Health    │  │ Alerts  │ │
│  │   System    │  │ Collection  │  │   Checks    │  │ & Rules │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│         │                │                │              │      │
│         └────────────────┼────────────────┼──────────────┘      │
│                          │                │                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Monitoring Dashboard                           │ │
│  │  • Real-time metrics visualization                         │ │
│  │  • Alert management                                        │ │
│  │  • Performance reports                                     │ │
│  │  • System health overview                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Alerting & Notifications                      │ │
│  │  • Multi-channel notifications (Email, Slack, Webhook)     │ │
│  │  • Operational runbooks                                    │ │
│  │  • Alert escalation                                        │ │
│  │  • Incident response automation                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Structured Logging System (`src/config/logger.ts`)

Enhanced Winston-based logging with:

- **Correlation IDs**: Track requests across services
- **Contextual Information**: User ID, workspace ID, operation context
- **Log Categories**: Security, audit, business, system, error events
- **Async Local Storage**: Automatic context propagation
- **Log Rotation**: Automatic log file rotation and archival

#### Usage Examples:

```typescript
import {
  logSystem,
  logSecurity,
  logAudit,
  createContextualLogger,
} from '@/config/logger';

// System events
logSystem('Service started', 'info', { port: 3000 });

// Security events
logSecurity('failed_login_attempt', 'medium', {
  userId: 'user123',
  ip: '192.168.1.1',
});

// Audit events
logAudit('user_created', 'users', 'admin123', {
  targetUserId: 'user456',
});

// Contextual logging
const logger = createContextualLogger('req-123', { userId: 'user123' });
logger.info('Processing request');
```

### 2. Prometheus Metrics Collection (`src/infrastructure/monitoring/metrics.service.ts`)

Comprehensive metrics collection including:

- **HTTP Request Metrics**: Duration, status codes, user context
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Connection pool, query performance
- **Cache Metrics**: Hit rates, operation timing
- **Business Metrics**: User actions, operations, custom KPIs

#### Available Metrics:

```
# HTTP Requests
enterprise_platform_http_request_duration_seconds
enterprise_platform_http_requests_total

# System Resources
enterprise_platform_system_cpu_usage_percent
enterprise_platform_system_memory_usage_percent

# Database
enterprise_platform_database_connections
enterprise_platform_database_query_duration_seconds

# Business Operations
enterprise_platform_business_operations_total
enterprise_platform_user_actions_total
```

#### Usage Examples:

```typescript
import { metricsService } from '@/infrastructure/monitoring';

// Record HTTP request
metricsService.recordHttpRequest('GET', '/api/v1/tasks', 200, 150, 'user123');

// Record business operation
metricsService.recordBusinessOperation('create', 'task', 'success', 'user123');

// Record custom metric
metricsService.recordBusinessMetric({
  name: 'task_completion_time',
  value: 3600, // seconds
  labels: { priority: 'high', project: 'proj123' },
});
```

### 3. Health Check System (`src/infrastructure/monitoring/health-check.service.ts`)

Multi-layer health monitoring:

- **Database Health**: Connection status, query performance
- **Redis Health**: Connectivity, memory usage
- **System Health**: CPU, memory, disk resources
- **Application Health**: Error rates, memory leaks

#### Health Check Endpoints:

```
GET /health              # Basic health check
GET /health/detailed     # Comprehensive health status
GET /metrics/health      # Health check with metrics
```

### 4. Monitoring Dashboard (`src/infrastructure/monitoring/monitoring-dashboard.service.ts`)

Real-time monitoring dashboard with:

- **Live Metrics**: System and application performance
- **Alert Management**: Active alerts, alert history
- **Performance Trends**: Historical data analysis
- **Threshold Monitoring**: Configurable alert rules

#### Dashboard Endpoints:

```
GET /monitoring/dashboard           # Dashboard data
GET /monitoring/alerts             # Alert management
GET /monitoring/performance-report # Performance reports
```

### 5. Alerting System (`src/infrastructure/monitoring/alerting.service.ts`)

Enterprise alerting with:

- **Multi-Channel Notifications**: Email, Slack, Webhook, SMS
- **Alert Rules**: Configurable thresholds and conditions
- **Escalation Policies**: Automatic alert escalation
- **Operational Runbooks**: Step-by-step incident response

#### Default Alert Rules:

| Rule                | Metric                | Threshold | Severity |
| ------------------- | --------------------- | --------- | -------- |
| High CPU            | system.cpu            | > 80%     | High     |
| Critical CPU        | system.cpu            | > 95%     | Critical |
| High Memory         | system.memory         | > 85%     | High     |
| Critical Memory     | system.memory         | > 95%     | Critical |
| High Error Rate     | application.errorRate | > 5%      | Medium   |
| Critical Error Rate | application.errorRate | > 10%     | Critical |

## Configuration

### Environment Variables

```bash
# Logging Configuration
LOG_LEVEL=info
LOG_DIR=logs

# Metrics Configuration
METRICS_ENABLED=true
PROMETHEUS_PORT=9090

# Alerting Configuration
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASSWORD=password
ALERT_FROM_EMAIL=alerts@company.com
ALERT_TO_EMAILS=admin@company.com,ops@company.com

# Webhook Alerts
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_WEBHOOK_TOKEN=your-webhook-token

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#alerts
```

### Initialization

```typescript
import { monitoringBootstrap } from '@/infrastructure/monitoring';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

// Initialize monitoring system
await monitoringBootstrap.initialize(prisma, redis);
```

## API Endpoints

### Metrics Endpoints

```
GET /metrics                    # Prometheus metrics (text/plain)
GET /metrics/json              # Metrics in JSON format
GET /metrics/dashboard         # Dashboard metrics
GET /metrics/health            # Health check results
GET /metrics/alerts            # Active alerts
GET /metrics/performance-report # Performance reports
```

### Monitoring Management

```
GET /monitoring/dashboard       # Monitoring dashboard
GET /monitoring/alerts         # Alert management
POST /monitoring/alerts/rules  # Create alert rule
PUT /monitoring/alerts/rules/:id # Update alert rule
DELETE /monitoring/alerts/rules/:id # Delete alert rule
GET /monitoring/runbooks       # Operational runbooks
GET /monitoring/notifications/channels # Notification channels
```

## Operational Runbooks

The system includes pre-configured runbooks for common issues:

### High CPU Usage Response

1. Check top CPU processes
2. Verify system load average
3. Review application logs
4. Restart services if necessary

### High Memory Usage Response

1. Check memory usage details
2. Identify memory-intensive processes
3. Check swap usage
4. Clear system caches

### High Error Rate Response

1. Examine recent error logs
2. Analyze error patterns
3. Check database health
4. Verify external service dependencies

### Database Performance Issues

1. Check slow query log
2. Verify connection pool status
3. Look for database locks
4. Analyze query execution plans

## Integration with Application

### Middleware Integration

```typescript
import { metricsMiddleware } from '@/presentation/middleware/metrics.middleware';
import { loggingContextMiddleware } from '@/config/logger';

// Add to Express app
app.use(loggingContextMiddleware);
app.use(metricsMiddleware);
```

### Business Metrics

```typescript
import { recordCustomMetric } from '@/presentation/middleware/metrics.middleware';

// Record business events
recordCustomMetric('user_registration', 1, {
  source: 'web',
  plan: 'premium',
});

recordCustomMetric('task_completion_time', duration, {
  priority: task.priority,
  project: task.projectId,
});
```

## Monitoring Best Practices

### 1. Metric Naming Conventions

- Use descriptive, hierarchical names
- Include units in metric names
- Use consistent labeling

### 2. Alert Configuration

- Set appropriate thresholds based on historical data
- Avoid alert fatigue with proper severity levels
- Include context in alert messages

### 3. Log Management

- Use structured logging with consistent fields
- Include correlation IDs for request tracing
- Set appropriate log levels for different environments

### 4. Performance Monitoring

- Monitor key business metrics alongside technical metrics
- Set up dashboards for different stakeholder groups
- Regular review and adjustment of thresholds

## Troubleshooting

### Common Issues

1. **High Memory Usage in Metrics Service**
   - Check metrics history retention settings
   - Verify metric cleanup processes
   - Monitor for metric label cardinality explosion

2. **Missing Correlation IDs**
   - Ensure logging middleware is properly configured
   - Check async context propagation
   - Verify middleware order in Express app

3. **Alert Notification Failures**
   - Check notification channel configuration
   - Verify network connectivity to external services
   - Review notification retry logic

### Debug Commands

```bash
# Check monitoring system status
curl http://localhost:3000/monitoring/dashboard

# View active alerts
curl http://localhost:3000/monitoring/alerts

# Check health status
curl http://localhost:3000/health/detailed

# View Prometheus metrics
curl http://localhost:3000/metrics
```

## Performance Considerations

- **Metrics Collection**: Minimal overhead with efficient data structures
- **Log Processing**: Asynchronous logging to prevent blocking
- **Health Checks**: Configurable intervals to balance accuracy and performance
- **Alert Processing**: Batched notifications to reduce external API calls

## Security Considerations

- **Sensitive Data**: Automatic masking of sensitive information in logs
- **Access Control**: Authentication required for monitoring endpoints
- **Audit Trail**: Complete audit log of all monitoring configuration changes
- **Secure Communications**: TLS encryption for all external notifications

This monitoring system provides enterprise-grade observability for the Unified Enterprise Platform, enabling proactive issue detection, rapid incident response, and comprehensive system visibility.
