import { ValueObject } from '../../../shared/domain/value-object';

export type WebhookStatusValue = 'active' | 'inactive' | 'suspended';

export class WebhookStatus extends ValueObject<WebhookStatusValue> {
  constructor(value: WebhookStatusValue) {
    super(value);
    this.validate();
  }

  private validate(): void {
    const validStatuses: WebhookStatusValue[] = [
      'active',
      'inactive',
      'suspended',
    ];

    if (!validStatuses.includes(this.value)) {
      throw new Error(
        `Invalid webhook status: ${this.value}. Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  isActive(): boolean {
    return this.value === 'active';
  }

  isInactive(): boolean {
    return this.value === 'inactive';
  }

  isSuspended(): boolean {
    return this.value === 'suspended';
  }

  canReceiveEvents(): boolean {
    return this.isActive();
  }

  static active(): WebhookStatus {
    return new WebhookStatus('active');
  }

  static inactive(): WebhookStatus {
    return new WebhookStatus('inactive');
  }

  static suspended(): WebhookStatus {
    return new WebhookStatus('suspended');
  }

  static fromString(value: string): WebhookStatus {
    return new WebhookStatus(value as WebhookStatusValue);
  }
}
