# @taskmanagement/jobs

Comprehensive job processing package for queues, processors, schedulers, workers, middleware, monitoring, retry strategies, prioritization, and batching.

## Features

- **Job Queue**: Priority-based job queue management
- **Job Scheduler**: Cron-based and delayed job scheduling
- **Job Processor**: Multi-worker job processing
- **Retry Strategies**: Exponential backoff and custom retry logic
- **Job Monitoring**: Real-time job status and metrics
- **Batch Processing**: Efficient batch job handling
- **Middleware**: Job lifecycle middleware support
- **Prioritization**: Priority-based job execution
- **Dead Letter Queue**: Failed job management

## Installation

```bash
npm install @taskmanagement/jobs
```

## Usage

```typescript
import { JobQueue, JobScheduler, JobProcessor } from '@taskmanagement/jobs';

// Initialize services
const queue = new JobQueue();
const scheduler = new JobScheduler();
const processor = new JobProcessor();

// Add immediate job
await queue.addJob({
  type: 'send-email',
  payload: { to: 'user@example.com', subject: 'Hello' },
  priority: 5
});

// Schedule delayed job
scheduler.scheduleJob({
  type: 'reminder',
  payload: { message: 'Meeting in 1 hour' },
  executeAt: new Date(Date.now() + 3600000)
});

// Schedule recurring job
scheduler.scheduleRecurringJob({
  type: 'daily-report',
  payload: { reportType: 'summary' },
  cronExpression: '0 9 * * *' // Daily at 9 AM
});

// Process jobs
processor.onJobCompleted((job) => {
  console.log('Job completed:', job.type);
});

processor.onJobFailed((job, error) => {
  console.error('Job failed:', job.type, error);
});

await processor.processQueue(queue);
```

## Testing

```bash
npm test
npm run test:coverage
npm run test:watch
```

## Dependencies

- Bull/BullMQ for queue management
- Node-cron for scheduling
- Redis for job storage
- Various job processing utilities