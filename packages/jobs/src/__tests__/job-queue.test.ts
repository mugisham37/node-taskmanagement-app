import { beforeEach, describe, expect, it } from 'vitest';
import { JobQueue } from '../job-queue';

describe('JobQueue', () => {
  let jobQueue: JobQueue;

  beforeEach(() => {
    jobQueue = new JobQueue();
  });

  describe('addJob', () => {
    it('should add job to queue successfully', async () => {
      const jobData = {
        type: 'email',
        payload: { to: 'test@example.com', subject: 'Test' },
        priority: 1
      };
      
      const jobId = await jobQueue.addJob(jobData);
      
      expect(typeof jobId).toBe('string');
      expect(jobId).toBeTruthy();
    });

    it('should handle job with different priorities', async () => {
      const highPriorityJob = {
        type: 'urgent-notification',
        payload: { message: 'Urgent' },
        priority: 10
      };
      
      const lowPriorityJob = {
        type: 'cleanup',
        payload: { table: 'temp_data' },
        priority: 1
      };
      
      const highPriorityId = await jobQueue.addJob(highPriorityJob);
      const lowPriorityId = await jobQueue.addJob(lowPriorityJob);
      
      expect(highPriorityId).toBeTruthy();
      expect(lowPriorityId).toBeTruthy();
    });
  });

  describe('processJobs', () => {
    it('should process jobs in priority order', async () => {
      const processedJobs: string[] = [];
      
      jobQueue.onJobProcessed((job) => {
        processedJobs.push(job.type);
      });
      
      await jobQueue.addJob({ type: 'low-priority', payload: {}, priority: 1 });
      await jobQueue.addJob({ type: 'high-priority', payload: {}, priority: 10 });
      
      await jobQueue.processJobs();
      
      expect(processedJobs[0]).toBe('high-priority');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      await jobQueue.addJob({ type: 'test', payload: {}, priority: 1 });
      
      const stats = await jobQueue.getQueueStats();
      
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
    });
  });

  describe('retryFailedJob', () => {
    it('should retry failed jobs', async () => {
      const jobId = await jobQueue.addJob({
        type: 'failing-job',
        payload: {},
        priority: 1
      });
      
      expect(() => {
        jobQueue.retryFailedJob(jobId);
      }).not.toThrow();
    });
  });
});