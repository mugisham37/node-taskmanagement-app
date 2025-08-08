import { BaseEntity } from '../../../shared/domain/entities/base.entity';
import { FileMetadata } from '../value-objects/file-metadata.vo';
import { FileAccessControl } from '../value-objects/file-access-control.vo';
import { FileVersion } from '../value-objects/file-version.vo';

export interface FileProps {
  id: string;
  workspaceId: string;
  uploadedBy: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  metadata: FileMetadata;
  accessControl: FileAccessControl;
  versions: FileVersion[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class FileEntity extends BaseEntity<FileProps> {
  constructor(props: FileProps) {
    super(props);
  }

  get id(): string {
    return this.props.id;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get uploadedBy(): string {
    return this.props.uploadedBy;
  }

  get originalName(): string {
    return this.props.originalName;
  }

  get storagePath(): string {
    return this.props.storagePath;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get size(): number {
    return this.props.size;
  }

  get metadata(): FileMetadata {
    return this.props.metadata;
  }

  get accessControl(): FileAccessControl {
    return this.props.accessControl;
  }

  get versions(): FileVersion[] {
    return this.props.versions;
  }

  get isDeleted(): boolean {
    return this.props.isDeleted;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  canBeAccessedBy(userId: string, permission: string): boolean {
    return this.accessControl.hasPermission(userId, permission);
  }

  addVersion(version: FileVersion): void {
    this.props.versions.push(version);
    this.props.updatedAt = new Date();
  }

  updateAccessControl(accessControl: FileAccessControl): void {
    this.props.accessControl = accessControl;
    this.props.updatedAt = new Date();
  }

  markAsDeleted(): void {
    this.props.isDeleted = true;
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  restore(): void {
    this.props.isDeleted = false;
    this.props.deletedAt = undefined;
    this.props.updatedAt = new Date();
  }

  updateMetadata(metadata: Partial<FileMetadata>): void {
    this.props.metadata = new FileMetadata({
      ...this.props.metadata.toPlainObject(),
      ...metadata,
    });
    this.props.updatedAt = new Date();
  }

  getLatestVersion(): FileVersion | undefined {
    return this.props.versions.sort((a, b) => b.version - a.version)[0];
  }

  getVersion(versionNumber: number): FileVersion | undefined {
    return this.props.versions.find(v => v.version === versionNumber);
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  isDocument(): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ];
    return documentTypes.includes(this.mimeType);
  }

  isVideo(): boolean {
    return this.mimeType.startsWith('video/');
  }

  isAudio(): boolean {
    return this.mimeType.startsWith('audio/');
  }

  getFileExtension(): string {
    const parts = this.originalName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  generateThumbnailPath(): string {
    const extension = this.getFileExtension();
    const basePath = this.storagePath.replace(`.${extension}`, '');
    return `${basePath}_thumb.jpg`;
  }

  generatePreviewPath(): string {
    const extension = this.getFileExtension();
    const basePath = this.storagePath.replace(`.${extension}`, '');
    return `${basePath}_preview.jpg`;
  }

  toPlainObject(): Record<string, any> {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      uploadedBy: this.uploadedBy,
      originalName: this.originalName,
      storagePath: this.storagePath,
      mimeType: this.mimeType,
      size: this.size,
      metadata: this.metadata.toPlainObject(),
      accessControl: this.accessControl.toPlainObject(),
      versions: this.versions.map(v => v.toPlainObject()),
      isDeleted: this.isDeleted,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
