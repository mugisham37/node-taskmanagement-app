import {
  MigrationSession,
  MigrationError,
  FileMigrationProcess,
} from '../types/migration.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class MigrationTrackerService {
  private readonly migrationDataPath = path.join(process.cwd(), '.migration');
  private currentSession: MigrationSession | null = null;

  async initializeSession(): Promise<MigrationSession> {
    // Ensure migration directory exists
    await this.ensureMigrationDirectory();

    // Count total files to process
    const totalFiles = await this.countFilesToProcess();

    this.currentSession = {
      sessionId: uuidv4(),
      startTime: new Date(),
      totalFiles,
      processedFiles: 0,
      migratedFunctionalities: 0,
      enhancedComponents: 0,
      deletedFiles: [],
      errors: [],
      status: 'in_progress',
      progress: 0,
    };

    await this.saveSession();
    return this.currentSession;
  }

  async getCurrentSession(): Promise<MigrationSession | null> {
    if (this.currentSession) {
      return this.currentSession;
    }

    try {
      const sessionPath = path.join(
        this.migrationDataPath,
        'current-session.json'
      );
      const sessionData = await fs.readFile(sessionPath, 'utf-8');
      this.currentSession = JSON.parse(sessionData);
      return this.currentSession;
    } catch (error) {
      return null;
    }
  }

  async updateProgress(
    processedFile: string,
    functionalities: number = 0
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active migration session');
    }

    this.currentSession.processedFiles++;
    this.currentSession.migratedFunctionalities += functionalities;
    this.currentSession.progress =
      (this.currentSession.processedFiles / this.currentSession.totalFiles) *
      100;
    this.currentSession.currentFile = processedFile;

    await this.saveSession();
  }

  async recordError(error: MigrationError): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active migration session');
    }

    this.currentSession.errors.push({
      ...error,
      timestamp: new Date(),
    });

    await this.saveSession();
  }

  async recordFileProcessed(
    filePath: string,
    process: FileMigrationProcess
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active migration session');
    }

    // Save detailed file process information
    const processPath = path.join(
      this.migrationDataPath,
      'processes',
      `${this.sanitizeFileName(filePath)}.json`
    );

    await fs.mkdir(path.dirname(processPath), { recursive: true });
    await fs.writeFile(processPath, JSON.stringify(process, null, 2));

    // Update session
    if (process.deletionConfirmed) {
      this.currentSession.deletedFiles.push(filePath);
    }

    await this.saveSession();
  }

  async completeSession(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active migration session');
    }

    this.currentSession.status = 'completed';
    this.currentSession.progress = 100;

    await this.saveSession();
    await this.generateMigrationReport();
  }

  async failSession(reason: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active migration session');
    }

    this.currentSession.status = 'failed';
    this.currentSession.errors.push({
      file: 'session',
      functionality: 'migration',
      error: reason,
      resolution: 'manual_intervention',
      resolved: false,
      timestamp: new Date(),
    });

    await this.saveSession();
  }

  async getSessionReport(): Promise<string> {
    if (!this.currentSession) {
      throw new Error('No active migration session');
    }

    const report = {
      sessionId: this.currentSession.sessionId,
      duration: Date.now() - this.currentSession.startTime.getTime(),
      progress: this.currentSession.progress,
      filesProcessed: this.currentSession.processedFiles,
      totalFiles: this.currentSession.totalFiles,
      functionalitiesMigrated: this.currentSession.migratedFunctionalities,
      filesDeleted: this.currentSession.deletedFiles.length,
      errors: this.currentSession.errors.length,
      status: this.currentSession.status,
    };

    return JSON.stringify(report, null, 2);
  }

  private async ensureMigrationDirectory(): Promise<void> {
    await fs.mkdir(this.migrationDataPath, { recursive: true });
    await fs.mkdir(path.join(this.migrationDataPath, 'backups'), {
      recursive: true,
    });
    await fs.mkdir(path.join(this.migrationDataPath, 'processes'), {
      recursive: true,
    });
    await fs.mkdir(path.join(this.migrationDataPath, 'reports'), {
      recursive: true,
    });
  }

  private async countFilesToProcess(): Promise<number> {
    const olderVersionPath = path.join(process.cwd(), 'older version');

    try {
      return await this.countFilesRecursively(olderVersionPath);
    } catch (error) {
      console.warn('Could not count files in older version directory:', error);
      return 0;
    }
  }

  private async countFilesRecursively(dirPath: string): Promise<number> {
    let count = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          count += await this.countFilesRecursively(fullPath);
        } else {
          count++;
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }

    return count;
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;

    const sessionPath = path.join(
      this.migrationDataPath,
      'current-session.json'
    );
    await fs.writeFile(
      sessionPath,
      JSON.stringify(this.currentSession, null, 2)
    );
  }

  private sanitizeFileName(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  private async generateMigrationReport(): Promise<void> {
    if (!this.currentSession) return;

    const reportPath = path.join(
      this.migrationDataPath,
      'reports',
      `migration-report-${this.currentSession.sessionId}.json`
    );

    const report = {
      ...this.currentSession,
      generatedAt: new Date(),
      summary: {
        totalDuration: Date.now() - this.currentSession.startTime.getTime(),
        successRate:
          ((this.currentSession.processedFiles -
            this.currentSession.errors.length) /
            this.currentSession.totalFiles) *
          100,
        averageTimePerFile:
          (Date.now() - this.currentSession.startTime.getTime()) /
          this.currentSession.processedFiles,
      },
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }
}
