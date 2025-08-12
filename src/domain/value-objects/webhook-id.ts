import { ValueObject } from './value-object';
import { ValidationError } from '../../shared/errors';

/**
 * Webhook ID value object
 * Represents a unique identifier for a webhook
 */
export class WebhookId extends ValueObject<string> {
  private static readonly ID_PATTERN = /^[a-zA-Z0-9_-]{21}$/;

  protected validate(value: string): void {
    if (!value) {
      throw ValidationError.forField(
        'webhookId',
        'Webhook ID cannot be empty',
        value
      );
    }

    if (typeof value !== 'string') {
      throw ValidationError.forField(
        'webhookId',
        'Webhook ID must be a string',
        value
      );
    }

    if (!WebhookId.ID_PATTERN.test(value)) {
      throw ValidationError.forField(
        'webhookId',
        'Webhook ID must be a valid nanoid (21 characters, alphanumeric with _ and -)',
        value
      );
    }
  }

  /**
   * Create a new WebhookId from a string
   */
  static create(id: string): WebhookId {
    return new WebhookId(id);
  }

  /**
   * Check if a string is a valid webhook ID format
   */
  static isValid(id: string): boolean {
    try {
      new WebhookId(id);
      return true;
    } catch {
      return false;
    }
  }
}
