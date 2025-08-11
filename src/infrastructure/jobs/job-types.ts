import { JobStatus, JobType } from '../../shared/enums/common.enums';

export interface JobDefinition {
  id: string;
  name: string;
  type: JobType;
  payload: Record<string, any>;
  priority?: number | undefined;
  maxRetries?: number | undefined;
  delay?: number | undefined;
  cronExpression?: string | undefined;
  timeout?: number | undefined;
  tags?: string[] | undefined;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  status: JobStatus;
  result?: any;
  error?: string;
  executionTime: number;
  retryCount: number;
  completedAt: Date;
}

export interface JobExecution {
  id: string;
  jobId: string;
  name: string;
  type: JobType;
  payload: Record<string, any>;
  priority?: number | undefined;
  maxRetries?: number | undefined;
  delay?: number | undefined;
  cronExpression?: string | undefined;
  timeout?: number | undefined;
  tags?: string[] | undefined;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  executionTime?: number;
  result?: any;
  error?: string;
  retryCount: number;
  nextRetryAt?: Date;
}

export interface JobConfig {
  enabled: boolean;
  concurrency: number;
  retryDelay: number;
  maxRetries: number;
  timeout: number;
  cleanupInterval: number;
  maxJobHistory: number;
}

export interface JobMetrics {
  totalJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  queuedJobs: number;
  averageExecutionTime: number;
  successRate: number;
  lastProcessedAt?: Date;
}

export interface JobHandler {
  name: string;
  execute(payload: Record<string, any>): Promise<any>;
  validate?(payload: Record<string, any>): boolean;
  onSuccess?(result: any): Promise<void>;
  onFailure?(error: Error): Promise<void>;
  onRetry?(attempt: number): Promise<void>;
}

export interface JobSchedule {
  jobId: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  timezone?: string;
}

export interface JobQueueConfig {
  name: string;
  priority: number;
  concurrency: number;
  jobs: JobExecution[];
  paused: boolean;
}

export interface JobMonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  alertThresholds: {
    failureRate: number;
    queueSize: number;
    executionTime: number;
  };
  notifications: {
    email?: string[];
    webhook?: string;
  };
}

export type JobEventType =
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.retrying'
  | 'job.cancelled'
  | 'queue.paused'
  | 'queue.resumed';

export interface JobEvent {
  type: JobEventType;
  jobId: string;
  timestamp: Date;
  data?: Record<string, any>;
}
