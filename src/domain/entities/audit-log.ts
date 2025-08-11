import { BaseEntity } from './base-entity';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'EMAIL_VERIFICATION'
  | 'PERMISSION_CHANGE'
  | 'EXPORT'
  | 'IMPORT'
  | 'SHARE'
  | 'ARCHIVE'
  | 'RESTORE';

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

export class AuditLog extends BaseEntity<AuditLogProps> {
  private constructor(props: AuditLogProps) {
    super(props.id, props.createdAt, props.createdAt);
    this.props = props;
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
