import { DomainEvent } from './domain-event';

export class AuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly action: string,
    public readonly userId?: string
  ) {
    super('AuditLogCreated', {
      auditLogId,
      entityType,
      entityId,
      action,
      userId,
    });
  }
}

export class SecurityEventDetectedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: string,
    public readonly action: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly riskLevel: 'low' | 'medium' | 'high' = 'medium'
  ) {
    super('SecurityEventDetected', {
      auditLogId,
      action,
      userId,
      ipAddress,
      riskLevel,
    });
  }
}

export class ActivityTrackedEvent extends DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly userId: string,
    public readonly action: string,
    public readonly entityType?: string,
    public readonly entityId?: string
  ) {
    super('ActivityTracked', {
      activityId,
      userId,
      action,
      entityType,
      entityId,
    });
  }
}
