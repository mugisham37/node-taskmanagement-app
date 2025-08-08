import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../shared/domain/domain-event';
import { AuditLogId } from '../value-objects/audit-log-id';
import { UserId } from '../../authentication/value-objects/user-id';

export interface AuditLogProps {
  id: AuditLogId;
  userId?: UserId;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogCreatedEvent extends BaseDomainEvent {
  constructor(auditLogId: AuditLogId, action: string) {
    super(auditLogId.value, 'AuditLogCreated', {
      auditLogId: auditLogId.value,
      action,
    });
  }
}

export class AuditLogAggregate extends AggregateRoot<AuditLogProps> {
  private constructor(props: AuditLogProps) {
    super(props, props.id.value, props.timestamp, props.timestamp);
  }

  public static create(
    props: Omit<AuditLogProps, 'id' | 'timestamp'>
  ): AuditLogAggregate {
    const auditLog = new AuditLogAggregate({
      ...props,
      id: AuditLogId.generate(),
      timestamp: new Date(),
    });

    auditLog.addDomainEvent(
      new AuditLogCreatedEvent(auditLog.id, auditLog.action)
    );

    return auditLog;
  }

  public static fromPersistence(props: AuditLogProps): AuditLogAggregate {
    return new AuditLogAggregate(props);
  }

  get id(): AuditLogId {
    return this.props.id;
  }

  get action(): string {
    return this.props.action;
  }

  protected validate(): void {
    if (!this.props.action || this.props.action.trim().length === 0) {
      throw new Error('Audit log action cannot be empty');
    }
  }

  protected applyBusinessRules(): void {
    // Audit logs are immutable once created
  }
}
