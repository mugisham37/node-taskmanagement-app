import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';
import { nanoid } from 'nanoid';

/**
 * Webhook Delivery ID value object
 * Represents a unique identifier for a webhook delivery
 */
export class WebhookDeliveryId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'webhookDeliveryId',
        'Webhook Delivery ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'webhookDeliveryId',
        'Webhook Delivery ID must be a string',
        value
      );
    }

    if (!WebhookDeliveryId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'webhookDeliveryId',
        'Webhook Delivery ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new WebhookDeliveryId
   */
  static create(): WebhookDeliveryId {
    return new WebhookDeliveryId(nanoid());
  }

  /**
   * Create a WebhookDeliveryId from a string
   */
  static fromString(id: string): WebhookDeliveryId {
    return new WebhookDeliveryId(id);
  }

  /**
   * Check if a string is a valid webhook delivery ID format
   */
  static isValid(id: string): boolean {
    try {
      new WebhookDeliveryId(id);
      return true;
    } catch {
      return false;
    }
  }
}
