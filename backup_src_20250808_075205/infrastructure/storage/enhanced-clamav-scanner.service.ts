import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface VirusScanResult {
  isClean: boolean;
  virusName?: string;
  scanTime: number;
  error?: string;
  scanEngine: string;
  databaseVersion?: string;
}

export interface ScannerConfig {
  clamScanPath?: string;
  timeout?: number;
  maxFileSize?: number;
  quarantineDir?: string;
  enableQuarantine?: boolean;
  enableRealTimeProtection?: boolean;
}

export class EnhancedClamAVScannerService {
  private readonly clamScanPath: string;
  private readonly timeout: number;
  private readonly maxFileSize: number;
  private readonly quarantineDir?: string;
  private readonly enableQuarantine: boolean;
  private readonly enableRealTimeProtection: boolean;
  private databaseVersion?: string;
  private lastDatabaseUpdate?: Date;

  constructor(config: ScannerConfig = {}) {
    this.clamScanPath = config.clamScanPath || 'clamscan';
    this.timeout = config.timeout || 30000;
    this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB
    this.quarantineDir = config.quarantineDir;
    this.enableQuarantine = config.enableQuarantine || false;
    this.enableRealTimeProtection = config.enableRealTimeProtection || false;

    if (this.enableQuarantine && this.quarantineDir) {
      this.ensureQuarantineDir();
    }
  }

  private async ensureQuarantineDir(): Promise<void> {
    if (this.quarantineDir) {
      try {
        await fs.mkdir(this.quarantineDir, { recursive: true });
      } catch (error) {
        logger.error('Failed to create quarantine directory', {
          quarantineDir: this.quarantineDir,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async scanFile(filePath: string): Promise<VirusScanResult> {
    const startTime = Date.now();

    try {
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        logger.warn('File too large for scanning', {
          filePath,
          size: stats.size,
          maxSize: this.maxFileSize,
        });

        return {
          isClean: true, // Assume clean for oversized files
          scanTime: Date.now() - startTime,
          scanEngine: 'ClamAV',
          error: 'File too large for scanning',
        };
      }

      // Build scan command with options
      const command = [
        this.clamScanPath,
        '--no-summary',
        '--infected', // Only show infected files
        '--bell', // Ring bell on virus detection
        '--recursive=no', // Don't scan recursively
        `"${filePath}"`,
      ].join(' ');

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
      });

      const scanTime = Date.now() - startTime;

      // Parse ClamAV output
      if (stdout.includes('OK') || stdout.trim() === '') {
        logger.info('File scan completed - clean', {
          filePath,
          scanTime,
        });

        return {
          isClean: true,
          scanTime,
          scanEngine: 'ClamAV',
          databaseVersion: this.databaseVersion,
        };
      } else if (stdout.includes('FOUND')) {
        const virusMatch = stdout.match(/: (.+) FOUND/);
        const virusName = virusMatch ? virusMatch[1] : 'Unknown virus';

        logger.warn('File scan completed - virus found', {
          filePath,
          virusName,
          scanTime,
        });

        // Quarantine infected file if enabled
        if (this.enableQuarantine && this.quarantineDir) {
          await this.quarantineFile(filePath, virusName);
        }

        return {
          isClean: false,
          virusName,
          scanTime,
          scanEngine: 'ClamAV',
          databaseVersion: this.databaseVersion,
        };
      } else {
        logger.error('Unexpected scan result', {
          filePath,
          stdout,
          stderr,
          scanTime,
        });

        return {
          isClean: false,
          scanTime,
          scanEngine: 'ClamAV',
          error: 'Unexpected scan result',
          databaseVersion: this.databaseVersion,
        };
      }
    } catch (error) {
      const scanTime = Date.now() - startTime;

      logger.error('File scan failed', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        scanTime,
      });

      return {
        isClean: false,
        scanTime,
        scanEngine: 'ClamAV',
        error: error instanceof Error ? error.message : 'Unknown error',
        databaseVersion: this.databaseVersion,
      };
    }
  }

  async scanBuffer(buffer: Buffer, filename: string): Promise<VirusScanResult> {
    const startTime = Date.now();

    try {
      // Check buffer size
      if (buffer.length > this.maxFileSize) {
        return {
          isClean: true, // Assume clean for oversized files
          scanTime: Date.now() - startTime,
          scanEngine: 'ClamAV',
          error: 'Buffer too large for scanning',
        };
      }

      // Create temporary file for scanning
      const tempDir = '/tmp';
      const tempFile = path.join(
        tempDir,
        `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );

      await fs.writeFile(tempFile, buffer);

      try {
        const result = await this.scanFile(tempFile);
        return result;
      } finally {
        // Clean up temporary file
        try {
          await fs.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      const scanTime = Date.now() - startTime;

      logger.error('Buffer scan failed', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
        scanTime,
      });

      return {
        isClean: false,
        scanTime,
        scanEngine: 'ClamAV',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async bulkScan(filePaths: string[]): Promise<VirusScanResult[]> {
    const results: VirusScanResult[] = [];

    // Process files in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchPromises = batch.map(filePath => this.scanFile(filePath));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  private async quarantineFile(
    filePath: string,
    virusName: string
  ): Promise<void> {
    if (!this.quarantineDir) return;

    try {
      const filename = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const quarantinePath = path.join(
        this.quarantineDir,
        `${timestamp}_${virusName}_${filename}`
      );

      await fs.rename(filePath, quarantinePath);

      // Create metadata file
      const metadataPath = `${quarantinePath}.metadata`;
      const metadata = {
        originalPath: filePath,
        virusName,
        quarantinedAt: new Date().toISOString(),
        scanEngine: 'ClamAV',
        databaseVersion: this.databaseVersion,
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('File quarantined successfully', {
        originalPath: filePath,
        quarantinePath,
        virusName,
      });
    } catch (error) {
      logger.error('Failed to quarantine file', {
        filePath,
        virusName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getQuarantinedFiles(): Promise<
    Array<{
      quarantinePath: string;
      originalPath: string;
      virusName: string;
      quarantinedAt: Date;
    }>
  > {
    if (!this.quarantineDir) return [];

    try {
      const files = await fs.readdir(this.quarantineDir);
      const quarantinedFiles = [];

      for (const file of files) {
        if (file.endsWith('.metadata')) {
          const metadataPath = path.join(this.quarantineDir, file);
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);

          quarantinedFiles.push({
            quarantinePath: path.join(
              this.quarantineDir,
              file.replace('.metadata', '')
            ),
            originalPath: metadata.originalPath,
            virusName: metadata.virusName,
            quarantinedAt: new Date(metadata.quarantinedAt),
          });
        }
      }

      return quarantinedFiles;
    } catch (error) {
      logger.error('Failed to get quarantined files', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async deleteQuarantinedFile(quarantinePath: string): Promise<void> {
    try {
      await fs.unlink(quarantinePath);
      await fs.unlink(`${quarantinePath}.metadata`);

      logger.info('Quarantined file deleted', { quarantinePath });
    } catch (error) {
      logger.error('Failed to delete quarantined file', {
        quarantinePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async restoreQuarantinedFile(
    quarantinePath: string,
    restorePath: string
  ): Promise<void> {
    try {
      await fs.rename(quarantinePath, restorePath);
      await fs.unlink(`${quarantinePath}.metadata`);

      logger.info('Quarantined file restored', {
        quarantinePath,
        restorePath,
      });
    } catch (error) {
      logger.error('Failed to restore quarantined file', {
        quarantinePath,
        restorePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.clamScanPath} --version`, {
        timeout: 5000,
      });

      // Extract database version
      const versionMatch = stdout.match(/ClamAV (\d+\.\d+\.\d+)/);
      if (versionMatch) {
        this.databaseVersion = versionMatch[1];
      }

      return true;
    } catch {
      return false;
    }
  }

  async updateDatabase(): Promise<boolean> {
    try {
      logger.info('Starting ClamAV database update');

      const { stdout, stderr } = await execAsync('freshclam', {
        timeout: 300000, // 5 minutes timeout for database update
      });

      this.lastDatabaseUpdate = new Date();

      logger.info('ClamAV database updated successfully', {
        stdout: stdout.substring(0, 500), // Log first 500 chars
        updateTime: this.lastDatabaseUpdate,
      });

      return true;
    } catch (error) {
      logger.error('Failed to update ClamAV database', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async getDatabaseInfo(): Promise<{
    version?: string;
    lastUpdate?: Date;
    isUpToDate: boolean;
  }> {
    try {
      const { stdout } = await execAsync(`${this.clamScanPath} --version`, {
        timeout: 5000,
      });

      // Parse version and database info
      const versionMatch = stdout.match(/ClamAV (\d+\.\d+\.\d+)/);
      const databaseMatch = stdout.match(/Database version: (\d+)/);

      return {
        version: versionMatch ? versionMatch[1] : undefined,
        lastUpdate: this.lastDatabaseUpdate,
        isUpToDate: this.lastDatabaseUpdate
          ? Date.now() - this.lastDatabaseUpdate.getTime() < 24 * 60 * 60 * 1000 // 24 hours
          : false,
      };
    } catch (error) {
      logger.error('Failed to get database info', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isUpToDate: false,
      };
    }
  }

  async getStatistics(): Promise<{
    totalScans: number;
    cleanFiles: number;
    infectedFiles: number;
    quarantinedFiles: number;
    averageScanTime: number;
  }> {
    // This would typically be stored in a database or cache
    // For now, return placeholder data
    const quarantinedFiles = await this.getQuarantinedFiles();

    return {
      totalScans: 0,
      cleanFiles: 0,
      infectedFiles: quarantinedFiles.length,
      quarantinedFiles: quarantinedFiles.length,
      averageScanTime: 0,
    };
  }

  async performHealthCheck(): Promise<{
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if ClamAV is available
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      issues.push('ClamAV is not available or not properly installed');
      recommendations.push(
        'Install ClamAV and ensure it is in the system PATH'
      );
    }

    // Check database freshness
    const dbInfo = await this.getDatabaseInfo();
    if (!dbInfo.isUpToDate) {
      issues.push('Virus database is outdated');
      recommendations.push('Update the virus database using freshclam');
    }

    // Check quarantine directory
    if (this.enableQuarantine && this.quarantineDir) {
      try {
        await fs.access(this.quarantineDir);
      } catch {
        issues.push('Quarantine directory is not accessible');
        recommendations.push(
          'Ensure quarantine directory exists and is writable'
        );
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
    };
  }
}
