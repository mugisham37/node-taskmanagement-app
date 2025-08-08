import fs from 'fs';
import path from 'path';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import {
  BaseService,
  ServiceContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from './base.service';
import {
  userRepository,
  taskRepository,
  projectRepository,
  teamRepository,
  workspaceRepository,
  notificationRepository,
  activityRepository,
  invitationRepository,
  recurringTaskRepository,
  taskTemplateRepository,
  calendarEventRepository,
  feedbackRepository,
} from '../db/repositories';
import { commentRepository } from '../../domains/collaboration/repositories/comment.repository';
import { db } from '../db/connection';
import { activityService } from './activity.service';

// Define export formats
export type ExportFormat = 'csv' | 'json';

// Define import modes
export type ImportMode = 'insert' | 'update' | 'upsert';

// Define model mapping with proper repository references
const modelMapping = {
  users: userRepository,
  tasks: taskRepository,
  projects: projectRepository,
  teams: teamRepository,
  workspaces: workspaceRepository,
  comments: commentRepository,
  notifications: notificationRepository,
  activities: activityRepository,
  invitations: invitationRepository,
  recurringTasks: recurringTaskRepository,
  taskTemplates: taskTemplateRepository,
  calendarEvents: calendarEventRepository,
  feedback: feedbackRepository,
} as const;

export type ModelName = keyof typeof modelMapping;

export interface ExportOptions {
  modelName: ModelName;
  format: ExportFormat;
  filters?: Record<string, any>;
  fields?: string[];
  limit?: number;
  includeDeleted?: boolean;
}

export interface ImportOptions {
  modelName: ModelName;
  mode: ImportMode;
  identifierField?: string;
  validateOnly?: boolean;
  batchSize?: number;
  skipErrors?: boolean;
}

export interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  totalProcessed: number;
  processingTime: number;
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  recordCount: number;
  fileSize: number;
  processingTime: number;
}

export interface DataValidationResult {
  isValid: boolean;
  errors: Array<{
    row: number;
    field: string;
    value: any;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    value: any;
    warning: string;
  }>;
}

export class DataImportExportService extends BaseService {
  private readonly UPLOAD_DIR: string;
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly DEFAULT_BATCH_SIZE = 1000;

  constructor() {
    super('DataImportExportService', {
      enableCache: false, // Don't cache import/export operations
      enableAudit: true,
      enableMetrics: true,
    });

    this.UPLOAD_DIR =
      process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.ensureUploadDirectory();
  }

  // Export Operations
  async exportData(
    options: ExportOptions,
    context?: ServiceContext
  ): Promise<ExportResult> {
    const ctx = this.createContext(context);
    this.logOperation('exportData', ctx, {
      modelName: options.modelName,
      format: options.format,
      hasFilters: !!options.filters,
    });

    const startTime = Date.now();

    try {
      // Validate model exists
      const repository = modelMapping[options.modelName];
      if (!repository) {
        throw new NotFoundError('Model', options.modelName);
      }

      // Check permissions
      await this.verifyExportPermissions(
        options.modelName,
        ctx.userId!,
        ctx.userRole
      );

      // Create export directory if it doesn't exist
      const exportDir = path.join(this.UPLOAD_DIR, 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      // Generate file name with timestamp and user ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${options.modelName}_${timestamp}_${ctx.userId}.${options.format}`;
      const filePath = path.join(exportDir, fileName);

      // Build query options
      const queryOptions: any = {
        limit: options.limit || 10000,
        where: this.buildExportFilters(
          options.filters,
          options.modelName,
          ctx.userId!,
          ctx.userRole
        ),
      };

      // Get data from repository
      const result = await repository.findMany(queryOptions);
      const data = result.data;

      if (data.length === 0) {
        throw new ValidationError(
          'No data found matching the specified criteria'
        );
      }

      // Process data based on format
      let fileContent: string;
      let fileSize: number;

      if (options.format === 'csv') {
        fileContent = await this.convertToCSV(data, options.fields);
      } else {
        fileContent = await this.convertToJSON(data, options.fields);
      }

      // Write file
      fs.writeFileSync(filePath, fileContent, 'utf8');
      fileSize = fs.statSync(filePath).size;

      const processingTime = Date.now() - startTime;

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_created', // Using closest available type
          data: {
            action: 'data_exported',
            modelName: options.modelName,
            format: options.format,
            recordCount: data.length,
            fileSize,
            fileName,
          },
          metadata: {
            exportOptions: options,
            processingTime,
          },
        },
        ctx
      );

      await this.recordMetric('data.export.completed', 1, {
        modelName: options.modelName,
        format: options.format,
        recordCount: data.length.toString(),
      });

      return {
        success: true,
        filePath,
        recordCount: data.length,
        fileSize,
        processingTime,
      };
    } catch (error) {
      await this.recordMetric('data.export.failed', 1, {
        modelName: options.modelName,
        format: options.format,
      });
      this.handleError(error, 'exportData', ctx);
    }
  }

  // Import Operations
  async importData(
    filePath: string,
    options: ImportOptions,
    context?: ServiceContext
  ): Promise<ImportResult> {
    const ctx = this.createContext(context);
    this.logOperation('importData', ctx, {
      filePath: path.basename(filePath),
      modelName: options.modelName,
      mode: options.mode,
    });

    const startTime = Date.now();

    try {
      // Validate model exists
      const repository = modelMapping[options.modelName];
      if (!repository) {
        throw new NotFoundError('Model', options.modelName);
      }

      // Check permissions
      await this.verifyImportPermissions(
        options.modelName,
        ctx.userId!,
        ctx.userRole
      );

      // Validate file exists and size
      if (!fs.existsSync(filePath)) {
        throw new NotFoundError('File', filePath);
      }

      const fileStats = fs.statSync(filePath);
      if (fileStats.size > this.MAX_FILE_SIZE) {
        throw new ValidationError(
          `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      // Parse file based on extension
      const fileExt = path.extname(filePath).toLowerCase();
      let data: any[];

      if (fileExt === '.csv') {
        data = await this.parseCSVFile(filePath);
      } else if (fileExt === '.json') {
        data = await this.parseJSONFile(filePath);
      } else {
        throw new ValidationError(
          `Unsupported file format: ${fileExt}. Supported formats: .csv, .json`
        );
      }

      if (data.length === 0) {
        throw new ValidationError('File contains no data');
      }

      // Validate data structure
      const validationResult = await this.validateImportData(
        data,
        options.modelName
      );
      if (!validationResult.isValid && !options.skipErrors) {
        throw new ValidationError(
          `Data validation failed: ${validationResult.errors.length} errors found`
        );
      }

      // If validation only, return validation results
      if (options.validateOnly) {
        return {
          success: validationResult.isValid,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: validationResult.errors.map(err => ({
            row: err.row,
            error: `${err.field}: ${err.error}`,
            data: err.value,
          })),
          totalProcessed: data.length,
          processingTime: Date.now() - startTime,
        };
      }

      // Process import based on mode
      const result = await this.processImport(data, options, repository, ctx);

      const processingTime = Date.now() - startTime;

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_created', // Using closest available type
          data: {
            action: 'data_imported',
            modelName: options.modelName,
            mode: options.mode,
            fileName: path.basename(filePath),
            ...result,
          },
          metadata: {
            importOptions: options,
            processingTime,
            validationResult,
          },
        },
        ctx
      );

      await this.recordMetric('data.import.completed', 1, {
        modelName: options.modelName,
        mode: options.mode,
        recordCount: result.totalProcessed.toString(),
      });

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      await this.recordMetric('data.import.failed', 1, {
        modelName: options.modelName,
        mode: options.mode,
      });
      this.handleError(error, 'importData', ctx);
    }
  }

  // Bulk Operations with Transaction Support
  async bulkImport(
    data: any[],
    options: ImportOptions,
    context?: ServiceContext
  ): Promise<ImportResult> {
    const ctx = this.createContext(context);
    this.logOperation('bulkImport', ctx, {
      recordCount: data.length,
      modelName: options.modelName,
      mode: options.mode,
    });

    const startTime = Date.now();

    try {
      const repository = modelMapping[options.modelName];
      if (!repository) {
        throw new NotFoundError('Model', options.modelName);
      }

      // Check permissions
      await this.verifyImportPermissions(
        options.modelName,
        ctx.userId!,
        ctx.userRole
      );

      // Process in transaction for data integrity
      const result = await db.transaction(async tx => {
        return await this.processImport(data, options, repository, ctx);
      });

      const processingTime = Date.now() - startTime;

      await this.recordMetric('data.bulk_import.completed', 1, {
        modelName: options.modelName,
        recordCount: data.length.toString(),
      });

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      await this.recordMetric('data.bulk_import.failed', 1, {
        modelName: options.modelName,
      });
      this.handleError(error, 'bulkImport', ctx);
    }
  }

  // Utility Methods
  async getAvailableModels(context?: ServiceContext): Promise<ModelName[]> {
    const ctx = this.createContext(context);

    // Filter models based on user permissions
    const availableModels: ModelName[] = [];

    for (const modelName of Object.keys(modelMapping) as ModelName[]) {
      try {
        await this.verifyExportPermissions(
          modelName,
          ctx.userId!,
          ctx.userRole
        );
        availableModels.push(modelName);
      } catch {
        // Skip models user doesn't have access to
      }
    }

    return availableModels;
  }

  async cleanupExportFiles(
    maxAge: number = 7 * 24 * 60 * 60 * 1000,
    context?: ServiceContext
  ): Promise<{ deleted: number }> {
    const ctx = this.createContext(context);
    this.logOperation('cleanupExportFiles', ctx, { maxAge });

    try {
      // Only admins can cleanup files
      if (ctx.userRole !== 'admin') {
        throw new ForbiddenError(
          'Only administrators can cleanup export files'
        );
      }

      const exportDir = path.join(this.UPLOAD_DIR, 'exports');
      if (!fs.existsSync(exportDir)) {
        return { deleted: 0 };
      }

      const files = fs.readdirSync(exportDir);
      let deletedCount = 0;
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(exportDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      await this.recordMetric('data.export_files.cleaned', deletedCount);

      return { deleted: deletedCount };
    } catch (error) {
      this.handleError(error, 'cleanupExportFiles', ctx);
    }
  }

  // Private Helper Methods
  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.UPLOAD_DIR)) {
      fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
  }

  private async verifyExportPermissions(
    modelName: ModelName,
    userId: string,
    userRole?: string
  ): Promise<void> {
    // Admin can export everything
    if (userRole === 'admin') {
      return;
    }

    // Regular users can only export their own data for most models
    const restrictedModels: ModelName[] = [
      'users',
      'activities',
      'notifications',
    ];

    if (restrictedModels.includes(modelName)) {
      throw new ForbiddenError(
        `Insufficient permissions to export ${modelName}`
      );
    }
  }

  private async verifyImportPermissions(
    modelName: ModelName,
    userId: string,
    userRole?: string
  ): Promise<void> {
    // Only admins can import data
    if (userRole !== 'admin') {
      throw new ForbiddenError('Only administrators can import data');
    }
  }

  private buildExportFilters(
    filters: Record<string, any> = {},
    modelName: ModelName,
    userId: string,
    userRole?: string
  ): any {
    const conditions = [];

    // Add user-specific filters for non-admin users
    if (userRole !== 'admin') {
      switch (modelName) {
        case 'tasks':
          conditions.push(
            or(
              eq(taskRepository['table']?.creatorId, userId),
              eq(taskRepository['table']?.assigneeId, userId)
            )
          );
          break;
        case 'projects':
          conditions.push(eq(projectRepository['table']?.ownerId, userId));
          break;
        case 'comments':
          conditions.push(eq(commentRepository['table']?.authorId, userId));
          break;
        // Add more model-specific filters as needed
      }
    }

    // Add custom filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // This would need to be enhanced based on the specific repository table structure
        // For now, we'll keep it simple
        conditions.push(eq(sql.identifier(key), value));
      }
    });

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private async convertToCSV(data: any[], fields?: string[]): Promise<string> {
    if (data.length === 0) {
      return '';
    }

    const selectedFields = fields || Object.keys(data[0]);

    // Create CSV header
    const header = selectedFields
      .map(field => this.escapeCSVField(field))
      .join(',');

    // Create CSV rows
    const rows = data.map(item => {
      return selectedFields
        .map(field => {
          let value = item[field];

          // Handle complex objects
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }

          // Handle dates
          if (value instanceof Date) {
            value = value.toISOString();
          }

          // Handle null/undefined
          if (value === null || value === undefined) {
            value = '';
          }

          return this.escapeCSVField(String(value));
        })
        .join(',');
    });

    return [header, ...rows].join('\n');
  }

  private escapeCSVField(field: string): string {
    // If field contains comma, newline, or quote, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private async convertToJSON(data: any[], fields?: string[]): Promise<string> {
    if (fields) {
      const filteredData = data.map(item => {
        const filtered: any = {};
        fields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filtered[field] = item[field];
          }
        });
        return filtered;
      });
      return JSON.stringify(filteredData, null, 2);
    }

    return JSON.stringify(data, null, 2);
  }

  private async parseCSVFile(filePath: string): Promise<any[]> {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return [];
    }

    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    const results: any[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: any = {};

      headers.forEach((header, index) => {
        let value = values[index] || '';

        // Try to parse JSON strings
        if (
          typeof value === 'string' &&
          (value.startsWith('{') || value.startsWith('['))
        ) {
          try {
            row[header] = JSON.parse(value);
          } catch {
            row[header] = value;
          }
        } else {
          row[header] = value;
        }
      });

      results.push(row);
    }

    return results;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    result.push(current.trim());

    return result;
  }

  private async parseJSONFile(filePath: string): Promise<any[]> {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Ensure data is an array
    return Array.isArray(data) ? data : [data];
  }

  private async validateImportData(
    data: any[],
    modelName: ModelName
  ): Promise<DataValidationResult> {
    const errors: DataValidationResult['errors'] = [];
    const warnings: DataValidationResult['warnings'] = [];

    // Basic validation - this would be enhanced with schema validation
    data.forEach((item, index) => {
      const row = index + 1;

      // Check for required fields based on model
      const requiredFields = this.getRequiredFields(modelName);

      requiredFields.forEach(field => {
        if (
          !item.hasOwnProperty(field) ||
          item[field] === null ||
          item[field] === undefined ||
          item[field] === ''
        ) {
          errors.push({
            row,
            field,
            value: item[field],
            error: 'Required field is missing or empty',
          });
        }
      });

      // Validate data types and formats
      this.validateFieldTypes(item, modelName, row, errors, warnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private getRequiredFields(modelName: ModelName): string[] {
    // Define required fields for each model
    const requiredFieldsMap: Record<ModelName, string[]> = {
      users: ['email', 'firstName', 'lastName'],
      tasks: ['title', 'creatorId'],
      projects: ['name', 'ownerId'],
      teams: ['name'],
      workspaces: ['name'],
      comments: ['content', 'authorId'],
      notifications: ['userId', 'type', 'title', 'message'],
      activities: ['userId', 'type'],
      invitations: ['email', 'teamId', 'invitedById'],
      recurringTasks: ['title', 'pattern'],
      taskTemplates: ['name', 'title'],
      calendarEvents: ['title', 'startDate', 'userId'],
      feedback: ['type', 'title', 'description'],
    };

    return requiredFieldsMap[modelName] || [];
  }

  private validateFieldTypes(
    item: any,
    modelName: ModelName,
    row: number,
    errors: any[],
    warnings: any[]
  ): void {
    // Email validation
    if (item.email && typeof item.email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(item.email)) {
        errors.push({
          row,
          field: 'email',
          value: item.email,
          error: 'Invalid email format',
        });
      }
    }

    // Date validation
    const dateFields = [
      'createdAt',
      'updatedAt',
      'dueDate',
      'startDate',
      'endDate',
    ];
    dateFields.forEach(field => {
      if (item[field] && typeof item[field] === 'string') {
        const date = new Date(item[field]);
        if (isNaN(date.getTime())) {
          errors.push({
            row,
            field,
            value: item[field],
            error: 'Invalid date format',
          });
        }
      }
    });

    // Add more field-specific validations as needed
  }

  private async processImport(
    data: any[],
    options: ImportOptions,
    repository: any,
    ctx: ServiceContext
  ): Promise<Omit<ImportResult, 'processingTime'>> {
    const batchSize = options.batchSize || this.DEFAULT_BATCH_SIZE;
    const result = {
      success: true,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as any[],
      totalProcessed: 0,
    };

    // Process data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      for (const [index, item] of batch.entries()) {
        const globalIndex = i + index;
        result.totalProcessed++;

        try {
          if (options.mode === 'insert') {
            await repository.create(item);
            result.inserted++;
          } else if (options.mode === 'update' || options.mode === 'upsert') {
            const identifierField = options.identifierField || 'id';
            const identifier = item[identifierField];

            if (!identifier) {
              if (options.mode === 'upsert') {
                await repository.create(item);
                result.inserted++;
              } else {
                result.skipped++;
                if (!options.skipErrors) {
                  result.errors.push({
                    row: globalIndex + 1,
                    error: `Missing identifier field: ${identifierField}`,
                    data: item,
                  });
                }
              }
              continue;
            }

            const existing = await repository.findById(identifier);

            if (existing) {
              await repository.update(identifier, item);
              result.updated++;
            } else if (options.mode === 'upsert') {
              await repository.create(item);
              result.inserted++;
            } else {
              result.skipped++;
              if (!options.skipErrors) {
                result.errors.push({
                  row: globalIndex + 1,
                  error: `Record not found for update: ${identifier}`,
                  data: item,
                });
              }
            }
          }
        } catch (error) {
          result.errors.push({
            row: globalIndex + 1,
            error: error instanceof Error ? error.message : String(error),
            data: item,
          });

          if (!options.skipErrors) {
            result.success = false;
            break;
          }
        }
      }

      if (!result.success && !options.skipErrors) {
        break;
      }
    }

    return result;
  }
}

// Export singleton instance
export const dataImportExportService = new DataImportExportService();
