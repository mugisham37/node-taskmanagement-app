import { ValueObject } from '../../../shared/domain/value-object';

export interface FileVersionProps {
  version: number;
  storagePath: string;
  size: number;
  checksum: string;
  uploadedBy: string;
  uploadedAt: Date;
  changeDescription?: string;
  metadata: Record<string, any>;
}

export class FileVersion extends ValueObject<FileVersionProps> {
  constructor(props: FileVersionProps) {
    super(props);
  }

  get version(): number {
    return this.props.version;
  }

  get storagePath(): string {
    return this.props.storagePath;
  }

  get size(): number {
    return this.props.size;
  }

  get checksum(): string {
    return this.props.checksum;
  }

  get uploadedBy(): string {
    return this.props.uploadedBy;
  }

  get uploadedAt(): Date {
    return this.props.uploadedAt;
  }

  get changeDescription(): string | undefined {
    return this.props.changeDescription;
  }

  get metadata(): Record<string, any> {
    return this.props.metadata;
  }

  // Business methods
  isNewerThan(otherVersion: FileVersion): boolean {
    return this.version > otherVersion.version;
  }

  isOlderThan(otherVersion: FileVersion): boolean {
    return this.version < otherVersion.version;
  }

  isSameVersion(otherVersion: FileVersion): boolean {
    return this.version === otherVersion.version;
  }

  hasSameContent(otherVersion: FileVersion): boolean {
    return this.checksum === otherVersion.checksum;
  }

  getSizeDifference(otherVersion: FileVersion): number {
    return this.size - otherVersion.size;
  }

  getTimeDifference(otherVersion: FileVersion): number {
    return this.uploadedAt.getTime() - otherVersion.uploadedAt.getTime();
  }

  updateChangeDescription(description: string): FileVersion {
    return new FileVersion({
      ...this.props,
      changeDescription: description,
    });
  }

  updateMetadata(metadata: Record<string, any>): FileVersion {
    return new FileVersion({
      ...this.props,
      metadata: {
        ...this.props.metadata,
        ...metadata,
      },
    });
  }

  equals(other: FileVersion): boolean {
    return this.deepEquals(other);
  }

  toPlainObject(): Record<string, any> {
    return {
      version: this.version,
      storagePath: this.storagePath,
      size: this.size,
      checksum: this.checksum,
      uploadedBy: this.uploadedBy,
      uploadedAt: this.uploadedAt,
      changeDescription: this.changeDescription,
      metadata: this.metadata,
    };
  }
}
