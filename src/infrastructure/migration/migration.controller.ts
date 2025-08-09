import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MigrationTrackerService } from './services/migration-tracker.service';
import { BackupService } from './services/backup.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { VerificationService } from './services/verification.service';
import { FileAnalysisService } from './services/file-analysis.service';
import { CurrentSystemMapperService } from './services/current-system-mapper.service';

@Controller('migration')
export class MigrationController {
  constructor(
    private readonly migrationTracker: MigrationTrackerService,
    private readonly backupService: BackupService,
    private readonly errorRecovery: ErrorRecoveryService,
    private readonly verification: VerificationService,
    private readonly fileAnalysis: FileAnalysisService,
    private readonly systemMapper: CurrentSystemMapperService
  ) {}

  @Post('initialize')
  async initializeMigration() {
    try {
      const session = await this.migrationTracker.initializeSession();
      return {
        success: true,
        sessionId: session.sessionId,
        totalFiles: session.totalFiles,
        message: 'Migration session initialized successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('status')
  async getMigrationStatus() {
    try {
      const session = await this.migrationTracker.getCurrentSession();
      if (!session) {
        return {
          success: false,
          message: 'No active migration session',
        };
      }

      return {
        success: true,
        session: {
          sessionId: session.sessionId,
          progress: session.progress,
          processedFiles: session.processedFiles,
          totalFiles: session.totalFiles,
          status: session.status,
          currentFile: session.currentFile,
          errors: session.errors.length,
          deletedFiles: session.deletedFiles.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('report')
  async getMigrationReport() {
    try {
      const report = await this.migrationTracker.getSessionReport();
      return {
        success: true,
        report: JSON.parse(report),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('system-structure')
  async getSystemStructure() {
    try {
      const structure = await this.systemMapper.mapCurrentStructure();
      return {
        success: true,
        structure,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('analyze-file')
  async analyzeFile(@Body() body: { filePath: string }) {
    try {
      const functionalities = await this.fileAnalysis.analyzeFile(
        body.filePath
      );
      const dependencies = await this.fileAnalysis.extractDependencies(
        body.filePath
      );

      return {
        success: true,
        analysis: {
          functionalities,
          dependencies,
          totalFunctionalities: functionalities.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('find-equivalent')
  async findEquivalentFunctionality(@Body() body: { functionality: any }) {
    try {
      const equivalent = await this.systemMapper.findEquivalentFunctionality(
        body.functionality
      );
      const integrationPoints =
        await this.systemMapper.identifyIntegrationPoints(body.functionality);

      return {
        success: true,
        equivalent,
        integrationPoints,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('verify-integration')
  async verifyIntegration(
    @Body() body: { component: string; integrationPoints: any[] }
  ) {
    try {
      const result = await this.verification.verifyIntegration(
        body.component,
        body.integrationPoints
      );

      return {
        success: true,
        verification: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('backups')
  async listBackups() {
    try {
      const backups = await this.backupService.listBackups();
      return {
        success: true,
        backups,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('backup/:filePath')
  async createBackup(@Param('filePath') filePath: string) {
    try {
      const backup = await this.backupService.createBackup(filePath);
      return {
        success: true,
        backup,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('errors')
  async getErrorSummary() {
    try {
      const summary = await this.errorRecovery.getErrorSummary();
      return {
        success: true,
        summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('complete')
  async completeMigration() {
    try {
      await this.migrationTracker.completeSession();
      return {
        success: true,
        message: 'Migration completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('cleanup-backups')
  async cleanupBackups(@Body() body: { olderThanDays?: number }) {
    try {
      await this.backupService.cleanupOldBackups(body.olderThanDays || 7);
      return {
        success: true,
        message: 'Backup cleanup completed',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
