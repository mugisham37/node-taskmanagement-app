import { DomainEvent } from './domain-event';

/**
 * Audit Log Created Event
 */
export class AuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly action: string,
    public readonly userId?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'AuditLogCreated';
  }

  getAggregateId(): string {
    return this.entityId;
  }

  protected getPayload(): Record<string, any> {
    return {
      auditLogId: this.auditLogId,
      entityType: this.entityType,
      entityId: this.entityId,
      action: this.action,
      userId: this.userId,
    };
  }
}

/**
 * Security Event Detected Event
 */
export class SecurityEventDetectedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: string,
    public readonly action: string,
    public readonly userId?: string,
    public readonly ipAddress?: string,
    public readonly riskLevel: 'low' | 'medium' | 'high' = 'medium'
  ) {
    super();
  }

  getEventName(): string {
    return 'SecurityEventDetected';
  }

  getAggregateId(): string {
    return this.auditLogId;
  }

  protected getPayload(): Record<string, any> {
    return {
      auditLogId: this.auditLogId,
      action: this.action,
      userId: this.userId,
      ipAddress: this.ipAddress,
      riskLevel: this.riskLevel,
    };
  }
}

/**
 * Activity Tracked Event
 */
export class ActivityTrackedEvent extends DomainEvent {
  constructor(
    public readonly activityId: string,
    public readonly userId: string,
    public readonly action: string,
    public readonly entityType?: string,
    public readonly entityId?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'ActivityTracked';
  }

  getAggregateId(): string {
    return this.entityId || this.activityId;
  }

  protected getPayload(): Record<string, any> {
    return {
      activityId: this.activityId,
      userId: this.userId,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
    };
  }
}
