import { BackupInfo } from '../types/migration.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class BackupService {
  private readonly backupBasePath = path.join(
    process.cwd(),
    '.migration',
    'backups'
  );

  async createBackup(targetPath: string): Promise<BackupInfo> {
    const backupId = uuidv4();
    const timestamp = new Date();
    const backupFileName = `${this.sanitizeFileName(targetPath)}_${timestamp.getTime()}.backup`;
    const backupPath = path.join(this.backupBasePath, backupFileName);

    // Ensure backup directory exists
    await fs.mkdir(this.backupBasePath, { recursive: true });

    try {
      // Check if target file exists
      await fs.access(targetPath);

      // Copy file to backup location
      await fs.copyFile(targetPath, backupPath);

      // Calculate checksum
      const content = await fs.readFile(backupPath);
      const checksum = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      const backupInfo: BackupInfo = {
        backupId,
        originalPath: targetPath,
        backupPath,
        timestamp,
        checksum,
      };

      // Save backup metadata
      const metadataPath = path.join(
        this.backupBasePath,
        `${backupId}.metadata.json`
      );
      await fs.writeFile(metadataPath, JSON.stringify(backupInfo, null, 2));

      return backupInfo;
    } catch (error) {
      // File doesn't exist, create empty backup record
      const backupInfo: BackupInfo = {
        backupId,
        originalPath: targetPath,
        backupPath: '',
        timestamp,
        checksum: '',
      };

      const metadataPath = path.join(
        this.backupBasePath,
        `${backupId}.metadata.json`
      );
      await fs.writeFile(metadataPath, JSON.stringify(backupInfo, null, 2));

      return backupInfo;
    }
  }

  async restoreBackup(backupInfo: BackupInfo): Promise<void> {
    if (!backupInfo.backupPath) {
      // File didn't exist originally, delete current file if it exists
      try {
        await fs.unlink(backupInfo.originalPath);
      } catch (error) {
        // File doesn't exist, which is expected
      }
      return;
    }

    // Verify backup integrity
    const isValid = await this.validateBackup(backupInfo);
    if (!isValid) {
      throw new Error(
        `Backup integrity check failed for ${backupInfo.backupId}`
      );
    }

    // Restore file
    await fs.copyFile(backupInfo.backupPath, backupInfo.originalPath);
  }

  async validateBackup(backupInfo: BackupInfo): Promise<boolean> {
    if (!backupInfo.backupPath) {
      return true; // Empty backup is valid
    }

    try {
      const content = await fs.readFile(backupInfo.backupPath);
      const checksum = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');
      return checksum === backupInfo.checksum;
    } catch (error) {
      return false;
    }
  }

  async cleanupOldBackups(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const files = await fs.readdir(this.backupBasePath);

      for (const file of files) {
        if (file.endsWith('.metadata.json')) {
          const metadataPath = path.join(this.backupBasePath, file);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          const backupDate = new Date(metadata.timestamp);

          if (backupDate < cutoffDate) {
            // Delete backup file and metadata
            if (metadata.backupPath) {
              try {
                await fs.unlink(metadata.backupPath);
              } catch (error) {
                // Backup file might already be deleted
              }
            }
            await fs.unlink(metadataPath);
          }
        }
      }
    } catch (error) {
      console.warn('Error cleaning up old backups:', error);
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    try {
      const files = await fs.readdir(this.backupBasePath);

      for (const file of files) {
        if (file.endsWith('.metadata.json')) {
          const metadataPath = path.join(this.backupBasePath, file);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          backups.push(metadata);
        }
      }
    } catch (error) {
      console.warn('Error listing backups:', error);
    }

    return backups.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private sanitizeFileName(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}
