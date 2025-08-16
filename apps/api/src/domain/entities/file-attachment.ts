import { BaseEntity } from '../base/entity';

export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  SPREADSHEET = 'spreadsheet',
  PRESENTATION = 'presentation',
  VIDEO = 'video',
  AUDIO = 'audio',
  ARCHIVE = 'archive',
  OTHER = 'other',
}

export enum FileStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
  DELETED = 'deleted',
}

export interface FileAttachmentProps {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: FileType;
  status: FileStatus;
  url: string | undefined;
  thumbnailUrl: string | undefined;
  checksum: string;
  uploadedBy: string;
  workspaceId: string | undefined;
  projectId: string | undefined;
  taskId: string | undefined;
  commentId: string | undefined;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | undefined;
}

export class FileAttachment extends BaseEntity<string> {
  private props: FileAttachmentProps;

  constructor(props: FileAttachmentProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.props = props;
  }

  get filename(): string {
    return this.props.filename;
  }

  get originalName(): string {
    return this.props.originalName;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get size(): number {
    return this.props.size;
  }

  get type(): FileType {
    return this.props.type;
  }

  get status(): FileStatus {
    return this.props.status;
  }

  get url(): string | undefined {
    return this.props.url;
  }

  get thumbnailUrl(): string | undefined {
    return this.props.thumbnailUrl;
  }

  get checksum(): string {
    return this.props.checksum;
  }

  get uploadedBy(): string {
    return this.props.uploadedBy;
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get projectId(): string | undefined {
    return this.props.projectId;
  }

  get taskId(): string | undefined {
    return this.props.taskId;
  }

  get commentId(): string | undefined {
    return this.props.commentId;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  // Business methods
  public markAsReady(url: string, thumbnailUrl?: string): void {
    this.props.status = FileStatus.READY;
    this.props.url = url;
    if (thumbnailUrl) {
      this.props.thumbnailUrl = thumbnailUrl;
    }
    this.props.updatedAt = new Date();
  }

  public markAsProcessing(): void {
    this.props.status = FileStatus.PROCESSING;
    this.props.updatedAt = new Date();
  }

  public markAsError(): void {
    this.props.status = FileStatus.ERROR;
    this.props.updatedAt = new Date();
  }

  public isReady(): boolean {
    return this.props.status === FileStatus.READY;
  }

  public isImage(): boolean {
    return this.props.type === FileType.IMAGE;
  }

  public isDocument(): boolean {
    return [
      FileType.DOCUMENT,
      FileType.SPREADSHEET,
      FileType.PRESENTATION,
    ].includes(this.props.type);
  }

  public isMedia(): boolean {
    return [FileType.VIDEO, FileType.AUDIO].includes(this.props.type);
  }

  public isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  public getSizeInMB(): number {
    return this.props.size / (1024 * 1024);
  }

  public getFileExtension(): string {
    const parts = this.props.originalName.split('.');
    return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() || '') : '';
  }

  public updateMetadata(metadata: Record<string, any>): void {
    this.props.metadata = { ...this.props.metadata, ...metadata };
    this.props.updatedAt = new Date();
  }

  public softDelete(): void {
    this.props.status = FileStatus.DELETED;
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  public restore(): void {
    if (!this.isDeleted()) {
      throw new Error('File is not deleted');
    }

    this.props.status = FileStatus.READY;
    delete (this.props as any).deletedAt;
    this.props.updatedAt = new Date();
  }

  public static create(
    props: Omit<FileAttachmentProps, 'id' | 'createdAt' | 'updatedAt'>
  ): FileAttachment {
    const now = new Date();
    return new FileAttachment({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static detectFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) {
      return FileType.IMAGE;
    }
    if (mimeType.startsWith('video/')) {
      return FileType.VIDEO;
    }
    if (mimeType.startsWith('audio/')) {
      return FileType.AUDIO;
    }

    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/rtf',
    ];
    if (documentTypes.includes(mimeType)) {
      return FileType.DOCUMENT;
    }

    const spreadsheetTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];
    if (spreadsheetTypes.includes(mimeType)) {
      return FileType.SPREADSHEET;
    }

    const presentationTypes = [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (presentationTypes.includes(mimeType)) {
      return FileType.PRESENTATION;
    }

    const archiveTypes = [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-tar',
      'application/gzip',
    ];
    if (archiveTypes.includes(mimeType)) {
      return FileType.ARCHIVE;
    }

    return FileType.OTHER;
  }

  public static validateFileSize(
    size: number,
    maxSizeMB: number = 100
  ): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return size <= maxSizeBytes;
  }

  public static validateMimeType(
    mimeType: string,
    allowedTypes?: string[]
  ): boolean {
    if (!allowedTypes) {
      return true; // Allow all types if no restriction
    }
    return allowedTypes.includes(mimeType);
  }

  protected validate(): void {
    // FileAttachment validation will be handled by the infrastructure layer
    // This is a legacy entity that needs refactoring
  }

  getValidationErrors(): string[] {
    return [];
  }
}
