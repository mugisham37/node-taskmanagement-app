import { FastifyInstance } from 'fastify';
import { DIContainer } from '../../shared/container';
import { MIGRATION_SERVICE_TOKENS } from './migration-service-registration';
import { MigrationTrackerService } from './services/migration-tracker.service';
import { BackupService } from './services/backup.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { VerificationService } from './services/verification.service';
import { FileAnalysisService } from './services/file-analysis.service';
import { CurrentSystemMapperService } from './services/current-system-mapper.service';

/**
 * Setup migration routes
 */
export async function setupMigrationRoutes(
  app: FastifyInstance,
  container: DIContainer
): Promise<void> {
  // Initialize migration session
  app.post('/migration/initialize', async (_, reply) => {
    try {
      const migrationTracker = container.resolve<MigrationTrackerService>(
        MIGRATION_SERVICE_TOKENS.MIGRATION_TRACKER
      );

      const session = await migrationTracker.initializeSession();

      return {
        success: true,
        sessionId: session.sessionId,
        totalFiles: session.totalFiles,
        message: 'Migration session initialized successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Get migration status
  app.get('/migration/status', async (_, reply) => {
    try {
      const migrationTracker = container.resolve<MigrationTrackerService>(
        MIGRATION_SERVICE_TOKENS.MIGRATION_TRACKER
      );

      const session = await migrationTracker.getCurrentSession();
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Generate migration report
  app.get('/migration/report', async (_, reply) => {
    try {
      const migrationTracker = container.resolve<MigrationTrackerService>(
        MIGRATION_SERVICE_TOKENS.MIGRATION_TRACKER
      );

      const report = await migrationTracker.getSessionReport();

      return {
        success: true,
        report: JSON.parse(report),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Get system structure
  app.get('/migration/system-structure', async (_, reply) => {
    try {
      const systemMapper = container.resolve<CurrentSystemMapperService>(
        MIGRATION_SERVICE_TOKENS.SYSTEM_MAPPER
      );

      const structure = await systemMapper.mapCurrentStructure();

      return {
        success: true,
        structure,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Analyze file
  app.post('/migration/analyze-file', async (request, reply) => {
    try {
      const { filePath } = request.body as { filePath: string };

      if (!filePath) {
        return reply.status(400).send({
          success: false,
          error: 'filePath is required',
        });
      }

      const fileAnalysis = container.resolve<FileAnalysisService>(
        MIGRATION_SERVICE_TOKENS.FILE_ANALYSIS
      );

      const functionalities = await fileAnalysis.analyzeFile(filePath);
      const dependencies = await fileAnalysis.extractDependencies(filePath);

      return {
        success: true,
        analysis: {
          functionalities,
          dependencies,
          totalFunctionalities: functionalities.length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Find equivalent functionality
  app.post('/migration/find-equivalent', async (request, reply) => {
    try {
      const { functionality } = request.body as { functionality: any };

      if (!functionality) {
        return reply.status(400).send({
          success: false,
          error: 'functionality is required',
        });
      }

      const systemMapper = container.resolve<CurrentSystemMapperService>(
        MIGRATION_SERVICE_TOKENS.SYSTEM_MAPPER
      );

      const equivalent =
        await systemMapper.findEquivalentFunctionality(functionality);
      const integrationPoints =
        await systemMapper.identifyIntegrationPoints(functionality);

      return {
        success: true,
        equivalent,
        integrationPoints,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Verify integration
  app.post('/migration/verify-integration', async (request, reply) => {
    try {
      const { component, integrationPoints } = request.body as {
        component: string;
        integrationPoints: any[];
      };

      if (!component || !integrationPoints) {
        return reply.status(400).send({
          success: false,
          error: 'component and integrationPoints are required',
        });
      }

      const verification = container.resolve<VerificationService>(
        MIGRATION_SERVICE_TOKENS.VERIFICATION_SERVICE
      );

      const result = await verification.verifyIntegration(
        component,
        integrationPoints
      );

      return {
        success: true,
        verification: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // List backups
  app.get('/migration/backups', async (_, reply) => {
    try {
      const backupService = container.resolve<BackupService>(
        MIGRATION_SERVICE_TOKENS.BACKUP_SERVICE
      );

      const backups = await backupService.listBackups();

      return {
        success: true,
        backups,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Create backup
  app.post('/migration/backup/:filePath', async (request, reply) => {
    try {
      const { filePath } = request.params as { filePath: string };

      const backupService = container.resolve<BackupService>(
        MIGRATION_SERVICE_TOKENS.BACKUP_SERVICE
      );

      const backup = await backupService.createBackup(filePath);

      return {
        success: true,
        backup,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Get error summary
  app.get('/migration/errors', async (_, reply) => {
    try {
      const errorRecovery = container.resolve<ErrorRecoveryService>(
        MIGRATION_SERVICE_TOKENS.ERROR_RECOVERY
      );

      const summary = await errorRecovery.getErrorSummary();

      return {
        success: true,
        summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Complete migration
  app.post('/migration/complete', async (_, reply) => {
    try {
      const migrationTracker = container.resolve<MigrationTrackerService>(
        MIGRATION_SERVICE_TOKENS.MIGRATION_TRACKER
      );

      await migrationTracker.completeSession();

      return {
        success: true,
        message: 'Migration completed successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Cleanup backups
  app.post('/migration/cleanup-backups', async (request, reply) => {
    try {
      const { olderThanDays } = request.body as { olderThanDays?: number };

      const backupService = container.resolve<BackupService>(
        MIGRATION_SERVICE_TOKENS.BACKUP_SERVICE
      );

      await backupService.cleanupOldBackups(olderThanDays || 7);

      return {
        success: true,
        message: 'Backup cleanup completed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });
}
