import { promises as fs } from 'fs';
import { BackupInfo, MigrationError } from '../types/migration.types';
import { BackupService } from './backup.service';
import { MigrationTrackerService } from './migration-tracker.service';

export interface ErrorRecoveryStrategy {
  errorType:
    | 'parsing_error'
    | 'integration_error'
    | 'verification_error'
    | 'architecture_violation';
  recoveryAction: 'skip_file' | 'manual_intervention' | 'alternative_approach' | 'rollback';
  fallbackStrategy: string;
  requiresUserInput: boolean;
}

export class ErrorRecoveryService {
  constructor(
    private readonly backupService: BackupService,
    private readonly migrationTracker: MigrationTrackerService
  ) {}

  async handleError(
    error: MigrationError,
    backupInfo?: BackupInfo
  ): Promise<ErrorRecoveryStrategy> {
    const strategy = this.determineRecoveryStrategy(error);

    // Log the error
    await this.migrationTracker.recordError(error);

    // Execute recovery action
    switch (strategy.recoveryAction) {
      case 'rollback':
        if (backupInfo) {
          await this.executeRollback(backupInfo);
        }
        break;

      case 'skip_file':
        await this.skipFile(error.file, error.error);
        break;

      case 'alternative_approach':
        await this.tryAlternativeApproach(error);
        break;

      case 'manual_intervention':
        await this.requestManualIntervention(error);
        break;
    }

    return strategy;
  }

  private determineRecoveryStrategy(error: MigrationError): ErrorRecoveryStrategy {
    // Determine strategy based on error type and content
    if (error.error.includes('parsing') || error.error.includes('syntax')) {
      return {
        errorType: 'parsing_error',
        recoveryAction: 'alternative_approach',
        fallbackStrategy: 'Try manual parsing or skip complex syntax',
        requiresUserInput: false,
      };
    }

    if (error.error.includes('integration') || error.error.includes('dependency')) {
      return {
        errorType: 'integration_error',
        recoveryAction: 'manual_intervention',
        fallbackStrategy: 'Review integration points and dependencies',
        requiresUserInput: true,
      };
    }

    if (error.error.includes('verification') || error.error.includes('test')) {
      return {
        errorType: 'verification_error',
        recoveryAction: 'skip_file',
        fallbackStrategy: 'Continue migration and verify later',
        requiresUserInput: false,
      };
    }

    if (error.error.includes('architecture') || error.error.includes('layer')) {
      return {
        errorType: 'architecture_violation',
        recoveryAction: 'rollback',
        fallbackStrategy: 'Restore previous state and review architecture',
        requiresUserInput: true,
      };
    }

    // Default strategy for unknown errors
    return {
      errorType: 'parsing_error',
      recoveryAction: 'manual_intervention',
      fallbackStrategy: 'Review error and determine appropriate action',
      requiresUserInput: true,
    };
  }

  private async executeRollback(backupInfo: BackupInfo): Promise<void> {
    try {
      await this.backupService.restoreBackup(backupInfo);
      console.log(`Successfully rolled back changes for ${backupInfo.originalPath}`);
    } catch (error: unknown) {
      console.error(`Failed to rollback ${backupInfo.originalPath}:`, error);
      throw new Error(`Rollback failed: ${(error as Error).message}`);
    }
  }

  private async skipFile(filePath: string, reason: string): Promise<void> {
    console.warn(`Skipping file ${filePath}: ${reason}`);

    // Create a skip record
    const skipRecord = {
      file: filePath,
      reason,
      timestamp: new Date(),
      action: 'skipped',
    };

    // Save skip record for later review
    const skipPath = `.migration/skipped-files.json`;
    let skippedFiles = [];

    try {
      const existingData = (await fs.readFile(skipPath, 'utf-8')) as string;
      skippedFiles = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist yet
    }

    skippedFiles.push(skipRecord);
    await fs.writeFile(skipPath, JSON.stringify(skippedFiles, null, 2));
  }

  private async tryAlternativeApproach(error: MigrationError): Promise<void> {
    console.log(`Trying alternative approach for ${error.file}: ${error.functionality}`);

    // Record the alternative approach attempt
    const alternativeRecord = {
      file: error.file,
      functionality: error.functionality,
      originalError: error.error,
      alternativeAttempt: true,
      timestamp: new Date(),
    };

    // Save alternative attempt record
    const altPath = `.migration/alternative-attempts.json`;
    let attempts = [];

    try {
      const existingData = (await fs.readFile(altPath, 'utf-8')) as string;
      attempts = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist yet
    }

    attempts.push(alternativeRecord);
    await fs.writeFile(altPath, JSON.stringify(attempts, null, 2));
  }

  private async requestManualIntervention(error: MigrationError): Promise<void> {
    console.error(`Manual intervention required for ${error.file}: ${error.functionality}`);
    console.error(`Error: ${error.error}`);

    // Create manual intervention record
    const interventionRecord = {
      file: error.file,
      functionality: error.functionality,
      error: error.error,
      timestamp: new Date(),
      status: 'pending',
      instructions: this.generateInterventionInstructions(error),
    };

    // Save intervention record
    const interventionPath = `.migration/manual-interventions.json`;
    let interventions = [];

    try {
      const existingData = (await fs.readFile(interventionPath, 'utf-8')) as string;
      interventions = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist yet
    }

    interventions.push(interventionRecord);
    await fs.writeFile(interventionPath, JSON.stringify(interventions, null, 2));
  }

  private generateInterventionInstructions(error: MigrationError): string {
    const baseInstructions = `
Manual intervention required for: ${error.file}
Functionality: ${error.functionality}
Error: ${error.error}

Suggested actions:
1. Review the source file: ${error.file}
2. Analyze the specific functionality: ${error.functionality}
3. Determine the appropriate target location in src/
4. Manually migrate the functionality
5. Test the integration
6. Mark as resolved in manual-interventions.json

Resolution format:
- Update the status field to "resolved"
- Add a "resolution" field with details of what was done
- Add a "resolvedBy" field with your identifier
- Add a "resolvedAt" timestamp
`;

    return baseInstructions;
  }

  async getErrorSummary(): Promise<any> {
    const session = await this.migrationTracker.getCurrentSession();
    if (!session) {
      return { errors: [], summary: 'No active session' };
    }

    const errorsByType = session.errors.reduce(
      (acc, error) => {
        const strategy = this.determineRecoveryStrategy(error);
        if (!acc[strategy.errorType]) {
          acc[strategy.errorType] = [];
        }
        acc[strategy.errorType]!.push(error);
        return acc;
      },
      {} as Record<string, MigrationError[]>
    );

    return {
      totalErrors: session.errors.length,
      errorsByType,
      resolvedErrors: session.errors.filter((e) => e.resolved).length,
      pendingErrors: session.errors.filter((e) => !e.resolved).length,
    };
  }
}
