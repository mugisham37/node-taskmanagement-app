import { ValueObject } from '../../../shared/domain/value-object';

export class WebhookUrl extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  private validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Webhook URL cannot be empty');
    }

    try {
      const url = new URL(this.value);

      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Webhook URL must use HTTP or HTTPS protocol');
      }

      // Prevent localhost and private IP ranges in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = url.hostname.toLowerCase();

        // Block localhost
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1'
        ) {
          throw new Error('Localhost URLs are not allowed in production');
        }

        // Block private IP ranges
        if (this.isPrivateIP(hostname)) {
          throw new Error('Private IP addresses are not allowed in production');
        }
      }

      // URL length validation
      if (this.value.length > 2048) {
        throw new Error('Webhook URL cannot exceed 2048 characters');
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid webhook URL format');
      }
      throw error;
    }
  }

  private isPrivateIP(hostname: string): boolean {
    // IPv4 private ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);

    if (ipv4Match) {
      const [, a, b, c, d] = ipv4Match.map(Number);

      // 10.0.0.0/8
      if (a === 10) return true;

      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;

      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;

      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true;
    }

    return false;
  }

  get domain(): string {
    try {
      return new URL(this.value).hostname;
    } catch {
      return '';
    }
  }

  get protocol(): string {
    try {
      return new URL(this.value).protocol;
    } catch {
      return '';
    }
  }

  get isSecure(): boolean {
    return this.protocol === 'https:';
  }

  static fromString(value: string): WebhookUrl {
    return new WebhookUrl(value);
  }
}
