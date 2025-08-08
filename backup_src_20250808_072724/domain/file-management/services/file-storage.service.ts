import { Readable } from 'stream';

export interface StorageBackend {
  name: string;
  type: 'local' | 's3' | 'azure' | 'gcs';
  config: Record<string, any>;
  isHealthy: boolean;
  lastHealthCheck?: Date;
}

export interface UploadOptions {
  workspaceId: string;
  userId: string;
  generateThumbnail?: boolean;
  generatePreview?: boolean;
  runVirusScan?: boolean;
  compress?: boolean;
  maxSize?: number;
  allowedMimeTypes?: string[];
  customMetadata?: Record<string, any>;
  encryption?: boolean;
  retentionPolicy?: {
    deleteAfter?: Date;
    archiveAfter?: Date;
  };
}

export interface UploadResult {
  storagePath: string;
  size: number;
  checksum: string;
  mimeType: string;
  metadata: Record<string, any>;
  thumbnailPath?: string;
  previewPath?: string;
  compressionRatio?: number;
  virusScanResult?: 'clean' | 'infected' | 'pending' | 'error';
  encryptionKey?: string;
}

export interface DownloadOptions {
  version?: number;
  thumbnail?: boolean;
  preview?: boolean;
  range?: { start: number; end: number };
  decrypt?: boolean;
}

export interface DownloadResult {
  stream: Readable;
  mimeType: string;
  size: number;
  filename: string;
  lastModified?: Date;
  etag?: string;
  contentRange?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: Record<string, any>;
}

export interface BackupOptions {
  includeVersions?: boolean;
  compression?: boolean;
  encryption?: boolean;
  destination?: string;
}

export interface StorageUsage {
  used: number;
  available: number;
  total: number;
  fileCount: number;
  workspaceBreakdown: Record<
    string,
    {
      used: number;
      fileCount: number;
    }
  >;
}

export interface FileStorageService {
  // Core storage operations
  upload(
    buffer: Buffer,
    filename: string,
    options: UploadOptions
  ): Promise<UploadResult>;

  download(
    storagePath: string,
    options?: DownloadOptions
  ): Promise<DownloadResult>;

  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
  getMetadata(storagePath: string): Promise<Record<string, any>>;

  // File validation and security
  validateFile(
    buffer: Buffer,
    filename: string,
    options: UploadOptions
  ): Promise<FileValidationResult>;

  scanForVirus(storagePath: string): Promise<'clean' | 'infected' | 'error'>;

  // Version management
  uploadVersion(
    buffer: Buffer,
    originalStoragePath: string,
    version: number,
    options: UploadOptions
  ): Promise<UploadResult>;

  listVersions(storagePath: string): Promise<
    Array<{
      version: number;
      storagePath: string;
      size: number;
      uploadedAt: Date;
      checksum: string;
    }>
  >;

  deleteVersion(storagePath: string, version: number): Promise<void>;

  // Thumbnail and preview generation
  generateThumbnail(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void>;

  generatePreview(
    storagePath: string,
    outputPath: string,
    options?: { width?: number; height?: number; quality?: number }
  ): Promise<void>;

  // Compression and optimization
  compressFile(
    storagePath: string,
    outputPath: string,
    options?: { quality?: number; format?: string }
  ): Promise<{ size: number; compressionRatio: number }>;

  optimizeImage(
    storagePath: string,
    outputPath: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    }
  ): Promise<{ size: number; optimizationRatio: number }>;

  // Backup and recovery
  backup(
    storagePath: string,
    backupPath: string,
    options?: BackupOptions
  ): Promise<void>;

  restore(backupPath: string, storagePath: string): Promise<void>;

  createSnapshot(workspaceId: string): Promise<string>;

  restoreFromSnapshot(snapshotId: string, workspaceId: string): Promise<void>;

  // Maintenance and cleanup
  cleanup(olderThan: Date): Promise<string[]>;

  validateIntegrity(
    storagePath: string,
    expectedChecksum: string
  ): Promise<boolean>;

  repairCorruptedFiles(): Promise<
    Array<{
      storagePath: string;
      status: 'repaired' | 'failed' | 'unrecoverable';
    }>
  >;

  // Storage backend management
  getBackendInfo(): StorageBackend;

  getStorageUsage(workspaceId?: string): Promise<StorageUsage>;

  healthCheck(): Promise<boolean>;

  switchBackend(newBackend: StorageBackend): Promise<void>;

  // Advanced features
  createSignedUrl(
    storagePath: string,
    expiresIn: number,
    permissions?: ('read' | 'write' | 'delete')[]
  ): Promise<string>;

  bulkUpload(
    files: Array<{ buffer: Buffer; filename: string; options: UploadOptions }>
  ): Promise<UploadResult[]>;

  bulkDelete(storagePaths: string[]): Promise<void>;

  moveFile(
    fromPath: string,
    toPath: string,
    preserveVersions?: boolean
  ): Promise<void>;

  copyFile(
    fromPath: string,
    toPath: string,
    preserveVersions?: boolean
  ): Promise<void>;

  // Search and indexing
  indexFile(storagePath: string): Promise<void>;

  searchFiles(query: {
    workspaceId?: string;
    mimeType?: string;
    sizeRange?: { min: number; max: number };
    dateRange?: { from: Date; to: Date };
    tags?: string[];
    fullTextSearch?: string;
  }): Promise<
    Array<{
      storagePath: string;
      filename: string;
      size: number;
      mimeType: string;
      uploadedAt: Date;
      relevanceScore?: number;
    }>
  >;
}
