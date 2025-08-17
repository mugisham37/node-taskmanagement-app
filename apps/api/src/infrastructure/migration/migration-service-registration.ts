import { Container } from '../shared/container/types';
import { MigrationTrackerService } from './services/migration-tracker.service';
import { BackupService } from './services/backup.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { VerificationService } from './services/verification.service';
import { FileAnalysisService } from './services/file-analysis.service';
import { CurrentSystemMapperService } from './services/current-system-mapper.service';

// Migration service tokens
export const MIGRATION_SERVICE_TOKENS = {
  MIGRATION_TRACKER: 'MigrationTracker',
  BACKUP_SERVICE: 'BackupService',
  ERROR_RECOVERY: 'ErrorRecovery',
  VERIFICATION_SERVICE: 'VerificationService',
  FILE_ANALYSIS: 'FileAnalysis',
  SYSTEM_MAPPER: 'SystemMapper',
} as const;

/**
 * Register migration services with the DI container
 */
export function registerMigrationServices(container: Container): void {
  // Register core migration services as singletons
  container.registerSingleton(
    MIGRATION_SERVICE_TOKENS.MIGRATION_TRACKER,
    MigrationTrackerService
  );
  container.registerSingleton(
    MIGRATION_SERVICE_TOKENS.BACKUP_SERVICE,
    BackupService
  );
  container.registerSingleton(
    MIGRATION_SERVICE_TOKENS.FILE_ANALYSIS,
    FileAnalysisService
  );
  container.registerSingleton(
    MIGRATION_SERVICE_TOKENS.SYSTEM_MAPPER,
    CurrentSystemMapperService
  );
  container.registerSingleton(
    MIGRATION_SERVICE_TOKENS.VERIFICATION_SERVICE,
    VerificationService
  );

  // Register error recovery service with dependencies
  container.registerSingleton(
    MIGRATION_SERVICE_TOKENS.ERROR_RECOVERY,
    ErrorRecoveryService,
    [
      MIGRATION_SERVICE_TOKENS.BACKUP_SERVICE,
      MIGRATION_SERVICE_TOKENS.MIGRATION_TRACKER,
    ]
  );
}

