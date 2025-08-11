/**
 * Configuration for automated backup service
 */
export interface AutomatedBackupConfig {
  /** Enable or disable automated backups */
  enabled: boolean;
  /** Cron expression for backup schedule */
  schedule: string;
  /** Maximum number of backups to retain */
  maxBackups: number;
  /** Storage location for backups */
  storageLocation: string;
  /** Compression settings */
  compression: {
    enabled: boolean;
    level: number;
  };
  /** Encryption settings */
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyPath?: string;
  };
  /** Retention policy */
  retentionPolicy: RetentionPolicy;
  /** Notification settings */
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    webhookUrl?: string;
    emailRecipients: string[];
  };
}

/**
 * Backup schedule configuration
 */
export interface BackupSchedule {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

/**
 * Retention policy for backups
 */
export interface RetentionPolicy {
  /** Keep daily backups for N days */
  dailyRetentionDays: number;
  /** Keep weekly backups for N weeks */
  weeklyRetentionWeeks: number;
  /** Keep monthly backups for N months */
  monthlyRetentionMonths: number;
  /** Keep yearly backups for N years */
  yearlyRetentionYears: number;
  /** Maximum storage size in GB */
  maxStorageSize?: number;
}

/**
 * Backup job configuration
 */
export interface BackupJob {
  id: string;
  name: string;
  schedule: BackupSchedule;
  config: AutomatedBackupConfig;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata: BackupMetadata;
}

/**
 * Backup health status
 */
export interface BackupHealth {
  isHealthy: boolean;
  lastSuccessfulBackup?: Date;
  failureCount: number;
  warnings: string[];
  errors: string[];
  storageUsage: {
    totalSize: number;
    availableSpace: number;
    backupCount: number;
  };
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  filename: string;
  size: number;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  databaseVersion: string;
  tables: string[];
  recordCount: number;
  createdAt: Date;
  completedAt: Date;
  duration: number;
  type: 'full' | 'incremental' | 'differential';
  source: {
    host: string;
    database: string;
    user: string;
  };
}

/**
 * Backup options
 */
export interface BackupOptions {
  includeData: boolean;
  includeSchema: boolean;
  tables?: string[];
  excludeTables?: string[];
  compression: boolean;
  encryption: boolean;
  outputPath: string;
  format: 'sql' | 'binary' | 'tar';
  verbose: boolean;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  backupPath: string;
  targetDatabase?: string;
  dropExisting: boolean;
  dataOnly: boolean;
  schemaOnly: boolean;
  tables?: string[];
  excludeTables?: string[];
  verbose: boolean;
  parallel?: number;
}
