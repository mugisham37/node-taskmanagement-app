/**
 * Point-in-Time Recovery configuration
 */
export interface PITRConfig {
  /** Enable or disable PITR */
  enabled: boolean;
  /** Archive location for WAL files */
  archiveLocation: string;
  /** Archive command */
  archiveCommand: string;
  /** Restore command */
  restoreCommand: string;
  /** Archive timeout in seconds */
  archiveTimeout: number;
  /** Maximum archive age before cleanup */
  maxArchiveAge: number;
  /** Compression for archived WAL files */
  compression: boolean;
  /** Encryption for archived WAL files */
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyPath?: string;
  };
}

/**
 * Recovery point information
 */
export interface RecoveryPoint {
  id: string;
  timestamp: Date;
  lsn: string;
  walFile: string;
  size: number;
  isRecoverable: boolean;
  metadata: {
    transactionCount: number;
    changes: string[];
    checkpoint: boolean;
  };
}

/**
 * Recovery options for PITR
 */
export interface RecoveryOptions {
  /** Target time for recovery */
  targetTime: Date;
  /** Target LSN for recovery */
  targetLSN?: string;
  /** Target transaction ID */
  targetXID?: string;
  /** Recovery target action */
  targetAction: 'promote' | 'pause' | 'shutdown';
  /** Include recovery of specific databases */
  includeDatabases?: string[];
  /** Exclude recovery of specific databases */
  excludeDatabases?: string[];
  /** Recovery mode */
  recoveryMode: 'immediate' | 'consistency' | 'latest';
  /** Validate recovery before promotion */
  validate: boolean;
}

/**
 * Recovery status
 */
export interface RecoveryStatus {
  id: string;
  status: 'initializing' | 'recovering' | 'validating' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: Date;
  estimatedCompletion?: Date;
  completedAt?: Date;
  error?: string;
  currentLSN?: string;
  targetLSN?: string;
  recoveredTransactions: number;
  appliedWALFiles: number;
  remainingWALFiles: number;
  warnings: string[];
}
