#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { MigrationModule } from '../migration.module';
import { MigrationTrackerService } from '../services/migration-tracker.service';
import { FileAnalysisService } from '../services/file-analysis.service';
import { CurrentSystemMapperService } from '../services/current-system-mapper.service';
import { BackupService } from '../services/backup.service';
import * as readline from 'readline';

class MigrationCLI {
  private app: any;
  private migrationTracker: MigrationTrackerService;
  private fileAnalysis: FileAnalysisService;
  private systemMapper: CurrentSystemMapperService;
  private backupService: BackupService;
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async initialize() {
    console.log('🚀 Initializing Migration CLI...');

    this.app = await NestFactory.createApplicationContext(MigrationModule, {
      logger: false,
    });

    this.migrationTracker = this.app.get(MigrationTrackerService);
    this.fileAnalysis = this.app.get(FileAnalysisService);
    this.systemMapper = this.app.get(CurrentSystemMapperService);
    this.backupService = this.app.get(BackupService);

    console.log('✅ Migration CLI initialized successfully');
  }

  async run() {
    await this.initialize();
    await this.showMainMenu();
  }

  private async showMainMenu() {
    console.log('\n📋 Migration Management CLI');
    console.log('==========================');
    console.log('1. Initialize new migration session');
    console.log('2. Check migration status');
    console.log('3. Analyze file');
    console.log('4. View system structure');
    console.log('5. List backups');
    console.log('6. Generate migration report');
    console.log('7. Cleanup old backups');
    console.log('8. Exit');

    const choice = await this.prompt('Select an option (1-8): ');

    switch (choice.trim()) {
      case '1':
        await this.initializeMigration();
        break;
      case '2':
        await this.checkStatus();
        break;
      case '3':
        await this.analyzeFile();
        break;
      case '4':
        await this.viewSystemStructure();
        break;
      case '5':
        await this.listBackups();
        break;
      case '6':
        await this.generateReport();
        break;
      case '7':
        await this.cleanupBackups();
        break;
      case '8':
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
      default:
        console.log('❌ Invalid option. Please try again.');
    }

    await this.showMainMenu();
  }

  private async initializeMigration() {
    console.log('\n🔄 Initializing migration session...');

    try {
      const session = await this.migrationTracker.initializeSession();
      console.log('✅ Migration session initialized successfully');
      console.log(`📊 Session ID: ${session.sessionId}`);
      console.log(`📁 Total files to process: ${session.totalFiles}`);
      console.log(`⏰ Started at: ${session.startTime.toLocaleString()}`);
    } catch (error) {
      console.log('❌ Failed to initialize migration session:', error.message);
    }
  }

  private async checkStatus() {
    console.log('\n📊 Checking migration status...');

    try {
      const session = await this.migrationTracker.getCurrentSession();

      if (!session) {
        console.log('ℹ️  No active migration session found');
        return;
      }

      console.log(`📋 Session ID: ${session.sessionId}`);
      console.log(`📈 Progress: ${session.progress.toFixed(2)}%`);
      console.log(
        `📁 Processed: ${session.processedFiles}/${session.totalFiles} files`
      );
      console.log(
        `🔧 Migrated functionalities: ${session.migratedFunctionalities}`
      );
      console.log(`🗑️  Deleted files: ${session.deletedFiles.length}`);
      console.log(`❌ Errors: ${session.errors.length}`);
      console.log(`📊 Status: ${session.status}`);

      if (session.currentFile) {
        console.log(`🔄 Currently processing: ${session.currentFile}`);
      }
    } catch (error) {
      console.log('❌ Failed to check status:', error.message);
    }
  }

  private async analyzeFile() {
    const filePath = await this.prompt('\n📁 Enter file path to analyze: ');

    if (!filePath.trim()) {
      console.log('❌ File path cannot be empty');
      return;
    }

    console.log(`🔍 Analyzing file: ${filePath}`);

    try {
      const functionalities = await this.fileAnalysis.analyzeFile(
        filePath.trim()
      );
      const dependencies = await this.fileAnalysis.extractDependencies(
        filePath.trim()
      );

      console.log(`✅ Analysis complete`);
      console.log(`🔧 Found ${functionalities.length} functionalities`);
      console.log(`📦 Found ${dependencies.length} dependencies`);

      if (functionalities.length > 0) {
        console.log('\n📋 Functionalities:');
        functionalities.forEach((func, index) => {
          console.log(`  ${index + 1}. ${func.name} (${func.type})`);
          console.log(`     Description: ${func.description}`);
          console.log(`     Action: ${func.migrationAction}`);
        });
      }

      if (dependencies.length > 0) {
        console.log('\n📦 Dependencies:');
        dependencies.forEach((dep, index) => {
          console.log(`  ${index + 1}. ${dep}`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to analyze file:', error.message);
    }
  }

  private async viewSystemStructure() {
    console.log('\n🏗️  Mapping current system structure...');

    try {
      const structure = await this.systemMapper.mapCurrentStructure();

      console.log('✅ System structure mapped successfully');
      console.log(`📁 Total directories: ${structure.totalDirectories}`);
      console.log(`📄 Total files: ${structure.totalFiles}`);

      console.log('\n📂 Directory structure by layer:');
      const layerGroups = structure.directories.reduce(
        (acc, dir) => {
          if (!acc[dir.layer]) acc[dir.layer] = [];
          acc[dir.layer].push(dir);
          return acc;
        },
        {} as Record<string, any[]>
      );

      Object.entries(layerGroups).forEach(([layer, dirs]) => {
        console.log(`\n  ${layer.toUpperCase()}:`);
        dirs.forEach(dir => {
          console.log(`    📁 ${dir.path} (${dir.fileCount} files)`);
        });
      });
    } catch (error) {
      console.log('❌ Failed to map system structure:', error.message);
    }
  }

  private async listBackups() {
    console.log('\n💾 Listing backups...');

    try {
      const backups = await this.backupService.listBackups();

      if (backups.length === 0) {
        console.log('ℹ️  No backups found');
        return;
      }

      console.log(`✅ Found ${backups.length} backups:`);
      backups.forEach((backup, index) => {
        console.log(`\n  ${index + 1}. Backup ID: ${backup.backupId}`);
        console.log(`     Original: ${backup.originalPath}`);
        console.log(`     Created: ${backup.timestamp.toLocaleString()}`);
        console.log(`     Checksum: ${backup.checksum.substring(0, 16)}...`);
      });
    } catch (error) {
      console.log('❌ Failed to list backups:', error.message);
    }
  }

  private async generateReport() {
    console.log('\n📊 Generating migration report...');

    try {
      const reportJson = await this.migrationTracker.getSessionReport();
      const report = JSON.parse(reportJson);

      console.log('✅ Migration Report Generated');
      console.log('============================');
      console.log(`Session ID: ${report.sessionId}`);
      console.log(`Duration: ${Math.round(report.duration / 1000)} seconds`);
      console.log(`Progress: ${report.progress}%`);
      console.log(
        `Files Processed: ${report.filesProcessed}/${report.totalFiles}`
      );
      console.log(
        `Functionalities Migrated: ${report.functionalitiesMigrated}`
      );
      console.log(`Files Deleted: ${report.filesDeleted}`);
      console.log(`Errors: ${report.errors}`);
      console.log(`Status: ${report.status}`);
    } catch (error) {
      console.log('❌ Failed to generate report:', error.message);
    }
  }

  private async cleanupBackups() {
    const daysInput = await this.prompt(
      '\n🗑️  Delete backups older than how many days? (default: 7): '
    );
    const days = parseInt(daysInput.trim()) || 7;

    console.log(`🗑️  Cleaning up backups older than ${days} days...`);

    try {
      await this.backupService.cleanupOldBackups(days);
      console.log('✅ Backup cleanup completed successfully');
    } catch (error) {
      console.log('❌ Failed to cleanup backups:', error.message);
    }
  }

  private prompt(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  async close() {
    this.rl.close();
    if (this.app) {
      await this.app.close();
    }
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new MigrationCLI();

  cli.run().catch(error => {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await cli.close();
    process.exit(0);
  });
}

export { MigrationCLI };
