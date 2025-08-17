import { beforeEach, describe, expect, it } from 'vitest';
import { JobScheduler } from '../job-scheduler';

describe('JobScheduler', () => {
  let jobScheduler: JobScheduler;

  beforeEach(() => {
    jobScheduler = new JobScheduler();
  });

  describe('scheduleJob', () => {
    it('should schedule job for future execution', () => {
      const jobData = {
        type: 'reminder',
        payload: { message: 'Meeting in 1 hour' },
        executeAt: new Date(Date.now() + 3600000) // 1 hour from now
      };
      
      const jobId = jobScheduler.scheduleJob(jobData);
      
      expect(typeof jobId).toBe('string');
      expect(jobId).toBeTruthy();
    });
  });

  describe('scheduleRecurringJob', () => {
    it('should schedule recurring job with cron expression', () => {
      const jobData = {
        type: 'daily-report',
        payload: { reportType: 'summary' },
        cronExpression: '0 9 * * *' // Daily at 9 AM
      };
      
      const jobId = jobScheduler.scheduleRecurringJob(jobData);
      
      expect(typeof jobId).toBe('string');
      expect(jobId).toBeTruthy();
    });
  });

  describe('cancelJob', () => {
    it('should cancel scheduled job', () => {
      const jobData = {
        type: 'reminder',
        payload: { message: 'Test' },
        executeAt: new Date(Date.now() + 3600000)
      };
      
      const jobId = jobScheduler.scheduleJob(jobData);
      
      expect(() => {
        jobScheduler.cancelJob(jobId);
      }).not.toThrow();
    });
  });

  describe('getScheduledJobs', () => {
    it('should return list of scheduled jobs', () => {
      const jobs = jobScheduler.getScheduledJobs();
      
      expect(Array.isArray(jobs)).toBe(true);
    });
  });

  describe('updateJobSchedule', () => {
    it('should update job schedule', () => {
      const jobData = {
        type: 'reminder',
        payload: { message: 'Test' },
        executeAt: new Date(Date.now() + 3600000)
      };
      
      const jobId = jobScheduler.scheduleJob(jobData);
      const newExecuteAt = new Date(Date.now() + 7200000); // 2 hours from now
      
      expect(() => {
        jobScheduler.updateJobSchedule(jobId, newExecuteAt);
      }).not.toThrow();
    });
  });
});