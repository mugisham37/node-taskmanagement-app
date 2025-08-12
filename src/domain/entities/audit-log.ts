import { Entity } from '../base/entity';
import { AuditLogId } from '../value-objects/audit-log-id';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  SHARE = 'SHARE',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
  ACCESS = 'ACCESS',
}

export interface AuditLogProps {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId?: string | undefined;
  userEmail?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  oldValues?: Record<string, any> | undefined;
  newValues?: Record<string, any> | undefined;
  changes?: Record<string, any> | undefined;
  metadata?: Record<string, any> | undefined;
  createdAt: Date;
}

export class AuditLog implements Entity<string> {
  private props: AuditLogProps;

  private constructor(props: AuditLogProps) {
    this.props = props;
  }

  // Entity interface implementation
  get id(): string {
    return this.props.id;
  }

  // Get AuditLogId value object
  get auditLogId(): AuditLogId {
    return AuditLogId.fromString(this.props.id);
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.createdAt; // AuditLog is immutable, so updatedAt = createdAt
  }

  static create(props: Omit<AuditLogProps, 'id' | 'createdAt'>): AuditLog {
    const auditLog = new AuditLog({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      metadata: props.metadata || {},
    });

    auditLog.validate();
    return auditLog;
  }

  static fromPersistence(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }

  protected validate(): void {
    // AuditLog validation will be handled by the infrastructure layer
    // This is a legacy entity that needs refactoring
  }

  getValidationErrors(): string[] {
    return [];
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
    return !!(this.props.changes && Object.keys(this.props.changes).length > 0);
  }

  isUserAction(): boolean {
    return !!this.props.userId;
  }

  isSecurityEvent(): boolean {
    const securityActions: AuditAction[] = [
      AuditAction.LOGIN,
      AuditAction.LOGOUT,
      AuditAction.PASSWORD_CHANGE,
      AuditAction.EMAIL_VERIFICATION,
      AuditAction.PERMISSION_CHANGE,
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
