import { ValueObject } from '../../../shared/domain/value-object';

export type WebhookDeliveryStatusValue = 'pending' | 'delivered' | 'failed';

export class WebhookDeliveryStatus extends ValueObject<WebhookDeliveryStatusValue> {
  constructor(value: WebhookDeliveryStatusValue) {
    super(value);
    this.validate();
  }

  private validate(): void {
    const validStatuses: WebhookDeliveryStatusValue[] = [
      'pending',
      'delivered',
      'failed',
    ];

    if (!validStatuses.includes(this.value)) {
      throw new Error(
        `Invalid webhook delivery status: ${this.value}. Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  isPending(): boolean {
    return this.value === 'pending';
  }

  isDelivered(): boolean {
    return this.value === 'delivered';
  }

  isFailed(): boolean {
    return this.value === 'failed';
  }

  isCompleted(): boolean {
    return this.isDelivered() || this.isFailed();
  }

  static pending(): WebhookDeliveryStatus {
    return new WebhookDeliveryStatus('pending');
  }

  static delivered(): WebhookDeliveryStatus {
    return new WebhookDeliveryStatus('delivered');
  }

  static failed(): WebhookDeliveryStatus {
    return new WebhookDeliveryStatus('failed');
  }

  static fromString(value: string): WebhookDeliveryStatus {
    return new WebhookDeliveryStatus(value as WebhookDeliveryStatusValue);
  }
}
