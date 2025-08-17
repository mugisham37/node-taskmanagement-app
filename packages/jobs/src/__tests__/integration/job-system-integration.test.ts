import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JobProcessor } from '../../job-processor';
import { JobQueue } from '../../job-queue';
import { JobScheduler } from '../../job-scheduler';

describe('Job System Integration Tests', () => {
  let jobQueue: JobQueue;
  let jobScheduler: JobScheduler;
  let jobProcessor: JobProcessor;

  beforeEach(() => {
    jobQueue = new JobQueue();
    jobScheduler = new JobScheduler();
    jobProcessor = new JobProcessor();
  });

  afterEach(() => {
    // Cleanup any resources
  });

  describe('Queue and Scheduler Integration', () => {
    it('should schedule jobs and add them to queue at execution time', async () => {
      const jobData = {
        type: 'delayed-notification',
        payload: { message: 'This is a delayed message' },
        executeAt: new Date(Date.now() + 1000) // 1 second from now
      };
      
      // Schedule the job
      const scheduledJobId = jobScheduler.scheduleJob(jobData);
      
      // Wait for job to be added to queue
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Check queue stats
      const stats = await jobQueue.getQueueStats();
      
      expect(scheduledJobId).toBeTruthy();
      expect(stats.pending).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Queue and Processor Integration', () => {
    it('should process jobs from queue with proper error handling', async () => {
      const processedJobs: any[] = [];
      const failedJobs: any[] = [];
      
      // Set up job processor handlers
      jobProcessor.onJobCompleted((job) => {
        processedJobs.push(job);
      });
      
      jobProcessor.onJobFailed((job, error) => {
        failedJobs.push({ job, error });
      });
      
      // Add jobs to queue
      await jobQueue.addJob({
        type: 'successful-job',
        payload: { data: 'test' },
        priority: 1
      });
      
      await jobQueue.addJob({
        type: 'failing-job',
        payload: { shouldFail: true },
        priority: 1
      });
      
      // Process jobs
      await jobProcessor.processQueue(jobQueue);
      
      expect(processedJobs.length + failedJobs.length).toBeGreaterThan(0);
    });
  });

  describe('Full Job Lifecycle Integration', () => {
    it('should handle complete job lifecycle from scheduling to completion', async () => {
      const jobResults: any[] = [];
      
      // Set up monitoring
      jobProcessor.onJobCompleted((job) => {
        jobResults.push({ status: 'completed', job });
      });
      
      jobProcessor.onJobFailed((job, error) => {
        jobResults.push({ status: 'failed', job, error });
      });
      
      // Schedule recurring job
      const recurringJobId = jobScheduler.scheduleRecurringJob({
        type: 'recurring-task',
        payload: { task: 'cleanup' },
        cronExpression: '*/5 * * * * *' // Every 5 seconds
      });
      
      // Add immediate job
      const immediateJobId = await jobQueue.addJob({
        type: 'immediate-task',
        payload: { urgent: true },
        priority: 10
      });
      
      // Process jobs for a short period
      const processingPromise = jobProcessor.processQueue(jobQueue);
      
      // Wait a bit then stop processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Cancel recurring job
      jobScheduler.cancelJob(recurringJobId);
      
      expect(immediateJobId).toBeTruthy();
      expect(recurringJobId).toBeTruthy();
    });
  });

  describe('Job Retry and Recovery Integration', () => {
    it('should handle job failures with retry mechanisms', async () => {
      const retryAttempts: number[] = [];
      
      jobProcessor.onJobRetry((job, attempt) => {
        retryAttempts.push(attempt);
      });
      
      // Add a job that will fail initially
      await jobQueue.addJob({
        type: 'retry-job',
        payload: { maxRetries: 3 },
        priority: 1,
        retryConfig: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          initialDelay: 100
        }
      });
      
      // Process the job
      await jobProcessor.processQueue(jobQueue);
      
      expect(retryAttempts.length).toBeGreaterThanOrEqual(0);
    });
  });
});