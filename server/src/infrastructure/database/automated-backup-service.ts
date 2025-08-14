import {
  BackupRecoveryManager,
  BackupOptions,
  BackupMetadata,
} from './backup-recovery';
import { DatabaseConnection } from './connection';
import { LoggingService } from '../monitoring/logging-service';
import { MetricsService } from '../monitoring/metrics-service';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface AutomatedBackupConfig {
  enabled: boolean;
  backupDirectory: string;
  schedules: BackupSchedule[];
  retention: RetentionPolicy;
  compression: boolean;
  encryption: {
    enabled: boolean;
    keyPath?: string;
  };
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
  };
  healthCheck: {
    enabled: boolean;
    interval: number; // minutes
    maxBackupAge: number; // hours
  };
}

export interface BackupSchedule {
  name: string;
  type: 'full' | 'incremental' | 'differential';
  cronExpression: string;
  enabled: boolean;
  options: Partial<BackupOptions>;
  retention: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepYearly: number;
  };
}

export interface RetentionPolicy {
  maxBackups: number;
  maxAge: number; // days
  minFreeSpace: number; // GB
  autoCleanup: boolean;
}

export interface BackupJob {
  id: string;
  scheduleId: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  filePath?: string;
  metadata?: BackupMetadata;
  error?: string;
}

export interface BackupHealth {
  status: 'healthy' | 'warning' | 'critical';
  lastBackup?: Date;
  nextBackup?: Date;
  totalBackups: number;
  failedBackups: number;
  diskUsage: {
    used: number;
    available: number;
    percentage: number;
  };
  issues: string[];
}

export class AutomatedBackupService {
  private backupManager: BackupRecoveryManager;
  private scheduleIntervals: Map<string, NodeJS.Timeout> = new Map();
  private runningJobs: Map<string, BackupJob> = new Map();
  private jobHistory: BackupJob[] = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private readonly config: AutomatedBackupConfig,
    private readonly connection: DatabaseConnection,
    private readonly loggingService: LoggingService,
    private readonly metricsService: MetricsService
  ) {
    this.backupManager = new BackupRecoveryManager(connection);
    this.initialize();
  }

  /**
   * Initialize the automated backup service
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.loggingService.info('Automated backup service is disabled');
      return;
    }

    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // Start scheduled backups
      this.startScheduledBackups();

      // Start health monitoring
      if (this.config.healthCheck.enabled) {
        this.startHealthMonitoring();
      }

      this.loggingService.info(
        'Automated backup service initialized successfully',
        {
          schedules: this.config.schedules.length,
          backupDirectory: this.config.backupDirectory,
        }
      );
    } catch (error) {
      this.loggingService.error(
        'Failed to initialize automated backup service',
        error as Error
      );
      throw new InfrastructureError(
        `Backup service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start all scheduled backups
   */
  private startScheduledBackups(): void {
    for (const schedule of this.config.schedules) {
      if (schedule.enabled) {
        this.scheduleBackup(schedule);
      }
    }
  }

  /**
   * Schedule a backup based on cron expression
   */
  private scheduleBackup(schedule: BackupSchedule): void {
    // This is a simplified implementation
    // In production, you would use a proper cron library like node-cron
    const interval = this.parseCronToInterval(schedule.cronExpression);

    const timeoutId = setInterval(async () => {
      try {
        await this.executeScheduledBackup(schedule);
      } catch (error) {
        this.loggingService.error(
          `Scheduled backup failed: ${schedule.name}`,
          error as Error
        );
      }
    }, interval);

    this.scheduleIntervals.set(schedule.name, timeoutId);

    this.loggingService.info(`Scheduled backup: ${schedule.name}`, {
      type: schedule.type,
      cronExpression: schedule.cronExpression,
    });
  }

  /**
   * Execute a scheduled backup
   */
  private async executeScheduledBackup(
    schedule: BackupSchedule
  ): Promise<void> {
    const jobId = this.generateJobId();
    const job: BackupJob = {
      id: jobId,
      scheduleId: schedule.name,
      type: schedule.type,
      status: 'pending',
    };

    this.runningJobs.set(jobId, job);
    this.jobHistory.push(job);

    try {
      job.status = 'running';
      job.startTime = new Date();

      this.loggingService.info(`Starting scheduled backup: ${schedule.name}`, {
        jobId,
        type: schedule.type,
      });

      // Generate backup file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${schedule.name}_${schedule.type}_${timestamp}.sql`;
      const filePath = path.join(this.config.backupDirectory, fileName);

      // Prepare backup options
      const backupOptions: BackupOptions = {
        outputPath: filePath,
        includeData: true,
        includeSchema: true,
        compress: this.config.compression,
        format: 'sql',
        ...schedule.options,
      };

      // Execute backup based on type
      let metadata: BackupMetadata;

      if (schedule.type === 'full') {
        metadata = await this.backupManager.createBackup(backupOptions);
      } else if (schedule.type === 'incremental') {
        const lastBackupTime = await this.getLastBackupTime(schedule.name);
        metadata = await this.backupManager.createIncrementalBackup(
          backupOptions,
          lastBackupTime
        );
      } else {
        // Differential backup (simplified as incremental for now)
        const lastFullBackupTime = await this.getLastFullBackupTime(
          schedule.name
        );
        metadata = await this.backupManager.createIncrementalBackup(
          backupOptions,
          lastFullBackupTime
        );
      }

      // Update job status
      job.status = 'completed';
      job.endTime = new Date();
      job.duration = job.endTime.getTime() - job.startTime.getTime();
      job.filePath = filePath;
      job.metadata = metadata;

      // Record metrics
      this.metricsService.incrementCounter('backup_jobs_completed_total', {
        schedule: schedule.name,
        type: schedule.type,
      });

      this.metricsService.recordHistogram(
        'backup_duration_seconds',
        job.duration / 1000,
        {
          schedule: schedule.name,
          type: schedule.type,
        }
      );

      this.metricsService.setGauge('backup_size_bytes', metadata.size, {
        schedule: schedule.name,
        type: schedule.type,
      });

      // Apply retention policy
      await this.applyRetentionPolicy(schedule);

      // Send success notification
      if (this.config.notifications.onSuccess) {
        await this.sendNotification('success', job, schedule);
      }

      this.loggingService.info(
        `Backup completed successfully: ${schedule.name}`,
        {
          jobId,
          duration: job.duration,
          size: metadata.size,
          filePath,
        }
      );
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : 'Unknown error';

      this.metricsService.incrementCounter('backup_jobs_failed_total', {
        schedule: schedule.name,
        type: schedule.type,
      });

      // Send failure notification
      if (this.config.notifications.onFailure) {
        await this.sendNotification('failure', job, schedule);
      }

      this.loggingService.error(
        `Backup failed: ${schedule.name}`,
        error as Error,
        {
          jobId,
          scheduleId: schedule.name,
        }
      );

      throw error;
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Apply retention policy to remove old backups
   */
  private async applyRetentionPolicy(schedule: BackupSchedule): Promise<void> {
    try {
      const backupFiles = await this.getBackupFiles(schedule.name);
      const filesToDelete: string[] = [];

      // Sort by creation time (newest first)
      backupFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Apply retention rules
      const retention = schedule.retention;
      const now = new Date();

      let dailyCount = 0;
      let weeklyCount = 0;
      let monthlyCount = 0;
      let yearlyCount = 0;

      for (const file of backupFiles) {
        const age = now.getTime() - file.mtime.getTime();
        const ageInDays = age / (1000 * 60 * 60 * 24);

        let shouldKeep = false;

        // Daily retention
        if (ageInDays <= 1 && dailyCount < retention.keepDaily) {
          shouldKeep = true;
          dailyCount++;
        }
        // Weekly retention
        else if (ageInDays <= 7 && weeklyCount < retention.keepWeekly) {
          shouldKeep = true;
          weeklyCount++;
        }
        // Monthly retention
        else if (ageInDays <= 30 && monthlyCount < retention.keepMonthly) {
          shouldKeep = true;
          monthlyCount++;
        }
        // Yearly retention
        else if (ageInDays <= 365 && yearlyCount < retention.keepYearly) {
          shouldKeep = true;
          yearlyCount++;
        }

        if (!shouldKeep) {
          filesToDelete.push(file.path);
        }
      }

      // Delete old backup files
      for (const filePath of filesToDelete) {
        try {
          await fs.unlink(filePath);

          // Also delete metadata file if exists
          const metadataPath = filePath.replace(/\.[^.]+$/, '.metadata.json');
          try {
            await fs.unlink(metadataPath);
          } catch (error) {
            // Metadata file might not exist, ignore error
          }

          this.loggingService.debug(`Deleted old backup file: ${filePath}`);
        } catch (error) {
          this.loggingService.error(
            `Failed to delete backup file: ${filePath}`,
            error as Error
          );
        }
      }

      if (filesToDelete.length > 0) {
        this.loggingService.info(
          `Applied retention policy for ${schedule.name}`,
          {
            deletedFiles: filesToDelete.length,
            remainingFiles: backupFiles.length - filesToDelete.length,
          }
        );
      }
    } catch (error) {
      this.loggingService.error(
        `Failed to apply retention policy for ${schedule.name}`,
        error as Error
      );
    }
  }

  /**
   * Get backup files for a schedule
   */
  private async getBackupFiles(scheduleName: string): Promise<
    Array<{
      path: string;
      name: string;
      mtime: Date;
      size: number;
    }>
  > {
    try {
      const files = await fs.readdir(this.config.backupDirectory);
      const backupFiles = files.filter(file => file.startsWith(scheduleName));

      const fileStats = await Promise.all(
        backupFiles.map(async file => {
          const filePath = path.join(this.config.backupDirectory, file);
          const stats = await fs.stat(filePath);

          return {
            path: filePath,
            name: file,
            mtime: stats.mtime,
            size: stats.size,
          };
        })
      );

      return fileStats;
    } catch (error) {
      this.loggingService.error('Failed to get backup files', error as Error);
      return [];
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(
      async () => {
        try {
          const health = await this.checkBackupHealth();

          // Record health metrics
          this.metricsService.setGauge(
            'backup_health_status',
            health.status === 'healthy'
              ? 1
              : health.status === 'warning'
                ? 0.5
                : 0
          );

          this.metricsService.setGauge(
            'backup_disk_usage_percentage',
            health.diskUsage.percentage
          );
          this.metricsService.setGauge(
            'backup_failed_jobs_total',
            health.failedBackups
          );

          // Log health issues
          if (health.issues.length > 0) {
            this.loggingService.warn('Backup health issues detected', {
              status: health.status,
              issues: health.issues,
            });
          }
        } catch (error) {
          this.loggingService.error(
            'Backup health check failed',
            error as Error
          );
        }
      },
      this.config.healthCheck.interval * 60 * 1000
    );
  }

  /**
   * Check backup system health
   */
  async checkBackupHealth(): Promise<BackupHealth> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check last backup time
    const lastBackup = await this.getLastBackupTime();
    const maxBackupAge = this.config.healthCheck.maxBackupAge * 60 * 60 * 1000;

    if (!lastBackup) {
      issues.push('No backups found');
      status = 'critical';
    } else if (Date.now() - lastBackup.getTime() > maxBackupAge) {
      issues.push(
        `Last backup is older than ${this.config.healthCheck.maxBackupAge} hours`
      );
      status = status === 'healthy' ? 'warning' : status;
    }

    // Check disk usage
    const diskUsage = await this.getDiskUsage();
    if (diskUsage.percentage > 90) {
      issues.push('Backup disk usage is above 90%');
      status = 'critical';
    } else if (diskUsage.percentage > 80) {
      issues.push('Backup disk usage is above 80%');
      status = status === 'healthy' ? 'warning' : status;
    }

    // Check failed backups
    const recentJobs = this.jobHistory.slice(-10);
    const failedJobs = recentJobs.filter(job => job.status === 'failed');

    if (failedJobs.length > 3) {
      issues.push(`${failedJobs.length} of last 10 backups failed`);
      status = 'critical';
    } else if (failedJobs.length > 1) {
      issues.push(`${failedJobs.length} recent backup failures`);
      status = status === 'healthy' ? 'warning' : status;
    }

    // Get next backup time
    const nextBackup = this.getNextBackupTime();

    return {
      status,
      lastBackup,
      nextBackup,
      totalBackups: this.jobHistory.filter(job => job.status === 'completed')
        .length,
      failedBackups: this.jobHistory.filter(job => job.status === 'failed')
        .length,
      diskUsage,
      issues,
    };
  }

  /**
   * Get disk usage for backup directory
   */
  private async getDiskUsage(): Promise<{
    used: number;
    available: number;
    percentage: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you would use a proper disk usage library
      const stats = await fs.stat(this.config.backupDirectory);

      // Mock values for demonstration
      return {
        used: 5000000000, // 5GB
        available: 15000000000, // 15GB
        percentage: 25,
      };
    } catch (error) {
      return {
        used: 0,
        available: 0,
        percentage: 0,
      };
    }
  }

  /**
   * Send notification about backup status
   */
  private async sendNotification(
    type: 'success' | 'failure',
    job: BackupJob,
    schedule: BackupSchedule
  ): Promise<void> {
    try {
      const message =
        type === 'success'
          ? `Backup completed successfully: ${schedule.name}`
          : `Backup failed: ${schedule.name} - ${job.error}`;

      this.loggingService.info(`Sending backup notification: ${type}`, {
        jobId: job.id,
        schedule: schedule.name,
        message,
      });

      // In a real implementation, you would send actual notifications
      // via webhook, email, Slack, etc.
    } catch (error) {
      this.loggingService.error(
        'Failed to send backup notification',
        error as Error
      );
    }
  }

  /**
   * Get job history
   */
  getJobHistory(limit: number = 50): BackupJob[] {
    return this.jobHistory
      .slice(-limit)
      .sort(
        (a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0)
      );
  }

  /**
   * Get running jobs
   */
  getRunningJobs(): BackupJob[] {
    return Array.from(this.runningJobs.values());
  }

  /**
   * Manually trigger a backup
   */
  async triggerBackup(scheduleName: string): Promise<string> {
    const schedule = this.config.schedules.find(s => s.name === scheduleName);
    if (!schedule) {
      throw new InfrastructureError(`Schedule not found: ${scheduleName}`);
    }

    await this.executeScheduledBackup(schedule);
    return `Backup triggered successfully: ${scheduleName}`;
  }

  /**
   * Stop the automated backup service
   */
  async stop(): Promise<void> {
    // Clear all scheduled intervals
    for (const [name, interval] of this.scheduleIntervals) {
      clearInterval(interval);
      this.loggingService.debug(`Stopped backup schedule: ${name}`);
    }
    this.scheduleIntervals.clear();

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.loggingService.info('Automated backup service stopped');
  }

  // Helper methods
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.config.backupDirectory);
    } catch (error) {
      await fs.mkdir(this.config.backupDirectory, { recursive: true });
      this.loggingService.info(
        `Created backup directory: ${this.config.backupDirectory}`
      );
    }
  }

  private generateJobId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseCronToInterval(cronExpression: string): number {
    // Simplified cron parsing - in production use a proper cron library
    // This is just for demonstration
    if (cronExpression.includes('0 0 * * *')) return 24 * 60 * 60 * 1000; // Daily
    if (cronExpression.includes('0 * * * *')) return 60 * 60 * 1000; // Hourly
    return 60 * 60 * 1000; // Default to hourly
  }

  private async getLastBackupTime(scheduleName?: string): Promise<Date> {
    const jobs = scheduleName
      ? this.jobHistory.filter(
          job => job.scheduleId === scheduleName && job.status === 'completed'
        )
      : this.jobHistory.filter(job => job.status === 'completed');

    if (jobs.length === 0) {
      return new Date(0); // Unix epoch
    }

    return (
      jobs.sort(
        (a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0)
      )[0].endTime || new Date(0)
    );
  }

  private async getLastFullBackupTime(scheduleName: string): Promise<Date> {
    const fullBackupJobs = this.jobHistory.filter(
      job =>
        job.scheduleId === scheduleName &&
        job.type === 'full' &&
        job.status === 'completed'
    );

    if (fullBackupJobs.length === 0) {
      return new Date(0);
    }

    return (
      fullBackupJobs.sort(
        (a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0)
      )[0].endTime || new Date(0)
    );
  }

  private getNextBackupTime(): Date | undefined {
    // Simplified - would calculate based on cron expressions
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
  }
}

/**
 * Create automated backup service with default configuration
 */
export function createAutomatedBackupService(
  connection: DatabaseConnection,
  loggingService: LoggingService,
  metricsService: MetricsService,
  config?: Partial<AutomatedBackupConfig>
): AutomatedBackupService {
  const defaultConfig: AutomatedBackupConfig = {
    enabled: true,
    backupDirectory: './backups',
    schedules: [
      {
        name: 'daily-full',
        type: 'full',
        cronExpression: '0 2 * * *', // 2 AM daily
        enabled: true,
        options: {
          includeData: true,
          includeSchema: true,
          compress: true,
        },
        retention: {
          keepDaily: 7,
          keepWeekly: 4,
          keepMonthly: 12,
          keepYearly: 3,
        },
      },
      {
        name: 'hourly-incremental',
        type: 'incremental',
        cronExpression: '0 * * * *', // Every hour
        enabled: true,
        options: {
          includeData: true,
          includeSchema: false,
        },
        retention: {
          keepDaily: 24,
          keepWeekly: 0,
          keepMonthly: 0,
          keepYearly: 0,
        },
      },
    ],
    retention: {
      maxBackups: 100,
      maxAge: 90, // 90 days
      minFreeSpace: 5, // 5GB
      autoCleanup: true,
    },
    compression: true,
    encryption: {
      enabled: false,
    },
    notifications: {
      onSuccess: false,
      onFailure: true,
    },
    healthCheck: {
      enabled: true,
      interval: 30, // 30 minutes
      maxBackupAge: 25, // 25 hours
    },
    ...config,
  };

  return new AutomatedBackupService(
    defaultConfig,
    connection,
    loggingService,
    metricsService
  );
}
