# Jobs and Background Processing System

This module provides a comprehensive job processing system that has been migrated and enhanced from the older version. It includes job scheduling, queue management, monitoring, and various job types for handling background tasks.

## Features

- **Job Queue Management**: Efficient job queuing with priority support
- **Job Scheduling**: Cron-based recurring job scheduling
- **Circuit Breaker Protection**: Fault tolerance for external service calls
- **Comprehensive Monitoring**: Metrics, health checks, and alerting
- **Multiple Job Types**: Support for immediate, scheduled, and recurring jobs
- **Retry Logic**: Exponential backoff retry mechanisms
- **Legacy Compatibility**: Maintains compatibility with older version job functions

## Architecture

### Core Components

1. **JobManager**: Central orchestrator for all job operations
2. **JobQueue**: Manages job queuing and processing order
3. **JobScheduler**: Handles cron-based recurring jobs
4. **JobProcessor**: Executes jobs with timeout and circuit breaker protection
5. **JobRegistry**: Manages job handler registration
6. **JobMonitoring**: Collects metrics and provides health monitoring

### Job Types

- **Immediate Jobs**: Execute as soon as possible
- **Scheduled Jobs**: Execute at a specific time or after a delay
- **Recurring Jobs**: Execute on a cron schedule

## Job Implementations

### 1. Notification Jobs (`notification-job`)

Handles various notification types:

- **Overdue Tasks**: Notifications for overdue tasks
- **Upcoming Tasks**: Reminders for tasks due soon
- **Task Reminders**: Specific task reminders
- **Daily Digest**: Daily activity summaries

### 2. Recurring Task Jobs (`recurring-task-job`)

Processes recurring task patterns:

- **Daily/Weekly/Monthly/Yearly**: Standard recurrence patterns
- **Custom Cron**: Advanced scheduling with cron expressions
- **Task Creation**: Automatic task instance creation

### 3. Calendar Reminder Jobs (`calendar-reminder-job`)

Manages calendar event reminders:

- **Email Reminders**: Email notifications for events
- **In-App Notifications**: Push notifications
- **SMS Reminders**: Text message alerts (when configured)

### 4. Webhook Delivery Jobs (`webhook-delivery-job`)

Handles webhook delivery with reliability:

- **Pending Deliveries**: Process new webhook deliveries
- **Retry Queue**: Handle failed deliveries with exponential backoff
- **Scheduled Deliveries**: Process time-delayed webhooks
- **Circuit Breaker**: Protect against failing endpoints

## Usage

### Basic Setup

```typescript
import { JobService, JobIntegrationService } from '../infrastructure/jobs';
import { Logger } from '../infrastructure/monitoring/logging-service';

// Initialize job service
const logger = new Logger();
const jobService = new JobService(logger, {
  enabled: true,
  concurrency: 5,
  maxRetries: 3,
  timeout: 30000,
});

await jobService.initialize();
```

### Scheduling Jobs

```typescript
// Schedule immediate notification job
const jobId = await jobService.scheduleNotificationJob('overdue', {
  priority: 1,
});

// Schedule delayed webhook delivery
const webhookJobId = await jobService.scheduleWebhookDeliveryJob(
  'deliver_specific',
  {
    webhookDeliveryId: 'webhook-123',
    delay: 60000, // 1 minute delay
  }
);

// Schedule recurring task processing
await jobService.scheduleRecurringTaskJob('process_all', {
  priority: 5,
});
```

### Legacy Compatibility

The system maintains compatibility with older version job functions:

```typescript
import { JobIntegrationService } from '../infrastructure/jobs';

const jobIntegration = new JobIntegrationService(logger);
await jobIntegration.initialize();

// Legacy methods still work
await jobIntegration.processTaskNotificationsNow();
await jobIntegration.processRecurringTasksNow();
const statuses = await jobIntegration.getJobStatuses();
```

## Configuration

### Job Config

```typescript
interface JobConfig {
  enabled: boolean; // Enable/disable job processing
  concurrency: number; // Max concurrent jobs
  retryDelay: number; // Base retry delay (ms)
  maxRetries: number; // Max retry attempts
  timeout: number; // Job execution timeout (ms)
  cleanupInterval: number; // Cleanup interval (ms)
  maxJobHistory: number; // Max completed jobs to keep
}
```

### Monitoring Config

```typescript
interface JobMonitoringConfig {
  enabled: boolean;
  metricsInterval: number; // Metrics collection interval
  alertThresholds: {
    failureRate: number; // Alert if failure rate exceeds
    queueSize: number; // Alert if queue size exceeds
    executionTime: number; // Alert if execution time exceeds
  };
}
```

## Monitoring and Metrics

### Available Metrics

- **Total Jobs**: Total number of jobs processed
- **Running Jobs**: Currently executing jobs
- **Completed Jobs**: Successfully completed jobs
- **Failed Jobs**: Failed job count
- **Queue Size**: Number of queued jobs
- **Success Rate**: Job success percentage
- **Average Execution Time**: Mean job execution time

### Health Checks

```typescript
const health = await jobService.healthCheck();
console.log(health.healthy); // true/false
console.log(health.issues); // Array of issues
console.log(health.metrics); // Current metrics
```

### Queue Management

```typescript
// Pause job processing
await jobService.pauseJobs();

// Resume job processing
await jobService.resumeJobs();

// Clean up old completed jobs
const cleaned = await jobService.cleanupJobs();

// Get queue status
const status = await jobService.getQueueStatus();
```

## Error Handling

### Circuit Breaker Protection

Jobs that interact with external services are protected by circuit breakers:

- **Failure Threshold**: Number of failures before opening circuit
- **Recovery Timeout**: Time before attempting recovery
- **Expected Errors**: Error types that don't count as failures

### Retry Logic

Failed jobs are automatically retried with exponential backoff:

- **Base Delay**: Initial retry delay
- **Exponential Backoff**: Delay increases with each retry
- **Max Delay**: Maximum retry delay cap
- **Max Attempts**: Maximum number of retry attempts

## Migration from Older Version

The job system has been completely migrated from the older version with the following enhancements:

### Migrated Components

1. **Job Infrastructure** (`older version/src/jobs/index.ts`)
   - ✅ Enhanced with comprehensive job management
   - ✅ Added circuit breaker protection
   - ✅ Improved monitoring and metrics

2. **Notification Jobs** (`older version/src/jobs/task-notifications.job.ts`)
   - ✅ Migrated overdue task processing
   - ✅ Enhanced with multiple notification types
   - ✅ Added digest notifications

3. **Recurring Task Jobs** (`older version/src/jobs/recurring-tasks.job.ts`)
   - ✅ Migrated recurring task processing
   - ✅ Enhanced with advanced recurrence patterns
   - ✅ Added custom cron support

4. **Calendar Reminder Jobs** (`older version/src/jobs/calendar-reminders.job.ts`)
   - ✅ Migrated calendar event processing
   - ✅ Enhanced with multiple reminder types
   - ✅ Added multi-channel notifications

5. **Webhook Delivery Jobs** (`older version/src/jobs/webhook-delivery.job.ts`)
   - ✅ Migrated webhook delivery system
   - ✅ Enhanced with circuit breaker protection
   - ✅ Added comprehensive retry logic

### Enhancements Over Older Version

- **Better Error Handling**: Circuit breakers and comprehensive error recovery
- **Improved Monitoring**: Detailed metrics and health checks
- **Enhanced Scheduling**: Cron-based recurring jobs with timezone support
- **Queue Management**: Priority queues and batch processing
- **Performance Optimization**: Concurrent processing and resource management
- **Legacy Compatibility**: Maintains older version API compatibility

## Best Practices

1. **Job Design**
   - Keep jobs idempotent
   - Handle partial failures gracefully
   - Use appropriate timeouts
   - Implement proper validation

2. **Error Handling**
   - Use circuit breakers for external services
   - Implement exponential backoff for retries
   - Log errors with sufficient context
   - Monitor failure rates

3. **Performance**
   - Set appropriate concurrency limits
   - Use batch processing for bulk operations
   - Monitor queue sizes and processing times
   - Clean up completed jobs regularly

4. **Monitoring**
   - Set up alerts for high failure rates
   - Monitor queue sizes and processing delays
   - Track job execution times
   - Implement health checks

## Troubleshooting

### Common Issues

1. **Jobs Not Processing**
   - Check if job service is initialized
   - Verify job handlers are registered
   - Check queue status and pause state

2. **High Failure Rates**
   - Review error logs for patterns
   - Check external service availability
   - Verify job payload validation

3. **Queue Backup**
   - Increase concurrency if resources allow
   - Check for stuck jobs
   - Review job execution times

4. **Memory Issues**
   - Reduce job history retention
   - Implement regular cleanup
   - Monitor job payload sizes

### Debug Commands

```typescript
// Get detailed job statistics
const stats = await jobService.getMetrics();

// Check queue status
const queueStatus = await jobService.getQueueStatus();

// Get job status
const jobResult = await jobService.getJobStatus('job-id');

// Health check
const health = await jobService.healthCheck();
```
