import { ValueObject } from '../../../shared/domain/value-object';
import * as crypto from 'crypto';

export class WebhookSecret extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Webhook secret cannot be empty');
    }

    if (this.value.length < 16) {
      throw new Error('Webhook secret must be at least 16 characters long');
    }

    if (this.value.length > 256) {
      throw new Error('Webhook secret cannot exceed 256 characters');
    }

    // Check for basic entropy (at least some variety in characters)
    const uniqueChars = new Set(this.value).size;
    if (uniqueChars < 8) {
      throw new Error(
        'Webhook secret must have sufficient entropy (at least 8 unique characters)'
      );
    }
  }

  generateSignature(
    payload: string,
    algorithm: 'sha256' | 'sha1' | 'md5' = 'sha256'
  ): string {
    const hmac = crypto.createHmac(algorithm, this.value);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  verifySignature(
    payload: string,
    signature: string,
    algorithm: 'sha256' | 'sha1' | 'md5' = 'sha256'
  ): boolean {
    const expectedSignature = this.generateSignature(payload, algorithm);

    // Use crypto.timingSafeEqual to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(
      signature.replace(/^(sha256|sha1|md5)=/, ''),
      'hex'
    );

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  static generate(length: number = 32): WebhookSecret {
    if (length < 16) {
      throw new Error('Generated secret must be at least 16 characters long');
    }

    if (length > 256) {
      throw new Error('Generated secret cannot exceed 256 characters');
    }

    const secret = crypto
      .randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
    return new WebhookSecret(secret);
  }

  static fromString(value: string): WebhookSecret {
    return new WebhookSecret(value);
  }

  // For security, don't expose the actual secret value in logs
  toString(): string {
    return `[WebhookSecret:${this.value.length}chars]`;
  }

  toJSON(): string {
    return this.toString();
  }
}
