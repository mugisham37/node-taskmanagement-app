import { Module } from '@nestjs/common';
import { MigrationTrackerService } from './services/migration-tracker.service';
import { BackupService } from './services/backup.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { VerificationService } from './services/verification.service';
import { FileAnalysisService } from './services/file-analysis.service';
import { CurrentSystemMapperService } from './services/current-system-mapper.service';
import { MigrationController } from './migration.controller';

@Module({
  providers: [
    MigrationTrackerService,
    BackupService,
    ErrorRecoveryService,
    VerificationService,
    FileAnalysisService,
    CurrentSystemMapperService,
  ],
  controllers: [MigrationController],
  exports: [
    MigrationTrackerService,
    BackupService,
    ErrorRecoveryService,
    VerificationService,
    FileAnalysisService,
    CurrentSystemMapperService,
  ],
})
export class MigrationModule {}
