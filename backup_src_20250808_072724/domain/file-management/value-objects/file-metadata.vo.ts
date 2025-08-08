import { ValueObject } from '../../shared/base/value-object';

export interface FileMetadataProps {
  checksum: string;
  encoding?: string;
  width?: number;
  height?: number;
  duration?: number; // For video/audio files in seconds
  pages?: number; // For documents
  tags: string[];
  customProperties: Record<string, any>;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'error';
  virusScanDate?: Date;
  compressionRatio?: number;
  isCompressed: boolean;
  thumbnailGenerated: boolean;
  previewGenerated: boolean;
  ocrText?: string; // For documents with OCR
  exifData?: Record<string, any>; // For images
}

export class FileMetadata extends ValueObject<FileMetadataProps> {
  constructor(props: FileMetadataProps) {
    super(props);
  }

  get checksum(): string {
    return this.props.checksum;
  }

  get encoding(): string | undefined {
    return this.props.encoding;
  }

  get width(): number | undefined {
    return this.props.width;
  }

  get height(): number | undefined {
    return this.props.height;
  }

  get duration(): number | undefined {
    return this.props.duration;
  }

  get pages(): number | undefined {
    return this.props.pages;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get customProperties(): Record<string, any> {
    return this.props.customProperties;
  }

  get virusScanStatus(): 'pending' | 'clean' | 'infected' | 'error' {
    return this.props.virusScanStatus;
  }

  get virusScanDate(): Date | undefined {
    return this.props.virusScanDate;
  }

  get compressionRatio(): number | undefined {
    return this.props.compressionRatio;
  }

  get isCompressed(): boolean {
    return this.props.isCompressed;
  }

  get thumbnailGenerated(): boolean {
    return this.props.thumbnailGenerated;
  }

  get previewGenerated(): boolean {
    return this.props.previewGenerated;
  }

  get ocrText(): string | undefined {
    return this.props.ocrText;
  }

  get exifData(): Record<string, any> | undefined {
    return this.props.exifData;
  }

  // Business methods
  addTag(tag: string): FileMetadata {
    if (!this.props.tags.includes(tag)) {
      return new FileMetadata({
        ...this.props,
        tags: [...this.props.tags, tag],
      });
    }
    return this;
  }

  removeTag(tag: string): FileMetadata {
    return new FileMetadata({
      ...this.props,
      tags: this.props.tags.filter(t => t !== tag),
    });
  }

  updateVirusScanResult(status: 'clean' | 'infected' | 'error'): FileMetadata {
    return new FileMetadata({
      ...this.props,
      virusScanStatus: status,
      virusScanDate: new Date(),
    });
  }

  markThumbnailGenerated(): FileMetadata {
    return new FileMetadata({
      ...this.props,
      thumbnailGenerated: true,
    });
  }

  markPreviewGenerated(): FileMetadata {
    return new FileMetadata({
      ...this.props,
      previewGenerated: true,
    });
  }

  updateOcrText(text: string): FileMetadata {
    return new FileMetadata({
      ...this.props,
      ocrText: text,
    });
  }

  updateCustomProperty(key: string, value: any): FileMetadata {
    return new FileMetadata({
      ...this.props,
      customProperties: {
        ...this.props.customProperties,
        [key]: value,
      },
    });
  }

  isVirusClean(): boolean {
    return this.virusScanStatus === 'clean';
  }

  isImage(): boolean {
    return this.width !== undefined && this.height !== undefined;
  }

  isVideo(): boolean {
    return this.duration !== undefined && this.width !== undefined;
  }

  isDocument(): boolean {
    return this.pages !== undefined;
  }

  hasOcr(): boolean {
    return this.ocrText !== undefined && this.ocrText.length > 0;
  }

  equals(other: FileMetadata): boolean {
    return this.deepEquals(other);
  }

  toPlainObject(): Record<string, any> {
    return {
      checksum: this.checksum,
      encoding: this.encoding,
      width: this.width,
      height: this.height,
      duration: this.duration,
      pages: this.pages,
      tags: this.tags,
      customProperties: this.customProperties,
      virusScanStatus: this.virusScanStatus,
      virusScanDate: this.virusScanDate,
      compressionRatio: this.compressionRatio,
      isCompressed: this.isCompressed,
      thumbnailGenerated: this.thumbnailGenerated,
      previewGenerated: this.previewGenerated,
      ocrText: this.ocrText,
      exifData: this.exifData,
    };
  }
}
