import { BaseEntity } from '../../../shared/domain/base-entity';
import { AuditAction } from '../schemas/audit-logs';

export interface AuditLogProps {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class AuditLogEntity extends BaseEntity {
  private constructor(private props: AuditLogProps) {
    super(props.id, props.createdAt, props.createdAt);
  }

  static create(
    props: Omit<AuditLogProps, 'id' | 'createdAt'>
  ): AuditLogEntity {
    const auditLog = new AuditLogEntity({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      metadata: props.metadata || {},
    });

    auditLog.validate();
    return auditLog;
  }

  static fromPersistence(props: AuditLogProps): AuditLogEntity {
    return new AuditLogEntity(props);
  }

  validate(): void {
    if (!this.props.entityType || this.props.entityType.trim().length === 0) {
      throw new Error('Entity type is required');
    }

    if (!this.props.entityId || this.props.entityId.trim().length === 0) {
      throw new Error('Entity ID is required');
    }

    if (!this.props.action || this.props.action.trim().length === 0) {
      throw new Error('Action is required');
    }

    if (this.props.entityType.length > 50) {
      throw new Error('Entity type must be 50 characters or less');
    }
  }

  toPrimitive(): Record<string, any> {
    return {
      id: this.props.id,
      entityType: this.props.entityType,
      entityId: this.props.entityId,
      action: this.props.action,
      userId: this.props.userId,
      userEmail: this.props.userEmail,
      ipAddress: this.props.ipAddress,
      userAgent: this.props.userAgent,
      oldValues: this.props.oldValues,
      newValues: this.props.newValues,
      changes: this.props.changes,
      metadata: this.props.metadata,
      createdAt: this.props.createdAt,
    };
  }

  // Getters
  get entityType(): string {
    return this.props.entityType;
  }

  get entityId(): string {
    return this.props.entityId;
  }

  get action(): AuditAction {
    return this.props.action;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get userEmail(): string | undefined {
    return this.props.userEmail;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get oldValues(): Record<string, any> | undefined {
    return this.props.oldValues;
  }

  get newValues(): Record<string, any> | undefined {
    return this.props.newValues;
  }

  get changes(): Record<string, any> | undefined {
    return this.props.changes;
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  // Business methods
  hasChanges(): boolean {
    return this.props.changes && Object.keys(this.props.changes).length > 0;
  }

  isUserAction(): boolean {
    return !!this.props.userId;
  }

  isSecurityEvent(): boolean {
    const securityActions: AuditAction[] = [
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'EMAIL_VERIFICATION',
      'PERMISSION_CHANGE',
    ];
    return securityActions.includes(this.props.action);
  }

  getChangedFields(): string[] {
    if (!this.props.changes) return [];
    return Object.keys(this.props.changes);
  }

  getFieldChange(fieldName: string): { oldValue: any; newValue: any } | null {
    if (!this.props.changes || !this.props.changes[fieldName]) {
      return null;
    }

    return {
      oldValue: this.props.oldValues?.[fieldName],
      newValue: this.props.newValues?.[fieldName],
    };
  }
}
