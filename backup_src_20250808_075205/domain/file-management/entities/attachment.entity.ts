import { BaseEntity } from '../../shared/entities/base.entity';

export interface AttachmentProps {
  id: string;
  fileId: string;
  workspaceId: string;
  attachedTo: string; // 'task', 'comment', 'project'
  attachedToId: string;
  attachedBy: string;
  description?: string;
  position: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AttachmentEntity extends BaseEntity<AttachmentProps> {
  constructor(props: AttachmentProps) {
    super(props);
  }

  get id(): string {
    return this.props.id;
  }

  get fileId(): string {
    return this.props.fileId;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get attachedTo(): string {
    return this.props.attachedTo;
  }

  get attachedToId(): string {
    return this.props.attachedToId;
  }

  get attachedBy(): string {
    return this.props.attachedBy;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get position(): number {
    return this.props.position;
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
  updateDescription(description: string): void {
    this.props.description = description;
    this.props.updatedAt = new Date();
  }

  updatePosition(position: number): void {
    this.props.position = position;
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

  isAttachedToTask(): boolean {
    return this.attachedTo === 'task';
  }

  isAttachedToComment(): boolean {
    return this.attachedTo === 'comment';
  }

  isAttachedToProject(): boolean {
    return this.attachedTo === 'project';
  }

  toPlainObject(): Record<string, any> {
    return {
      id: this.id,
      fileId: this.fileId,
      workspaceId: this.workspaceId,
      attachedTo: this.attachedTo,
      attachedToId: this.attachedToId,
      attachedBy: this.attachedBy,
      description: this.description,
      position: this.position,
      isDeleted: this.isDeleted,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
