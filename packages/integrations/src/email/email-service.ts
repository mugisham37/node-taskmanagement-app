import { ILogger } from '@taskmanagement/core';
import { EmailConfig, EmailMessage } from '@taskmanagement/types';

export interface IEmailService {
  sendEmail(message: EmailMessage): Promise<EmailResult>;
  sendBulkEmail(messages: EmailMessage[]): Promise<EmailResult[]>;
  validateEmail(email: string): boolean;
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
}

export interface EmailResult {
  messageId: string;
  status: 'sent' | 'failed' | 'queued';
  error?: string;
}

export interface DeliveryStatus {
  messageId: string;
  status: 'delivered' | 'bounced' | 'complained' | 'pending';
  timestamp: Date;
  details?: string;
}

export abstract class BaseEmailProvider {
  constructor(
    protected readonly config: EmailConfig,
    protected readonly logger: ILogger
  ) {}

  abstract sendEmail(message: EmailMessage): Promise<EmailResult>;
  abstract sendBulkEmail(messages: EmailMessage[]): Promise<EmailResult[]>;
  abstract getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  protected validateMessage(message: EmailMessage): void {
    if (!message.to || message.to.length === 0) {
      throw new Error('Email message must have at least one recipient');
    }

    if (!message.subject) {
      throw new Error('Email message must have a subject');
    }

    if (!message.body && !message.html) {
      throw new Error('Email message must have either text body or HTML content');
    }

    // Validate all email addresses
    const allEmails = [
      ...message.to,
      ...(message.cc || []),
      ...(message.bcc || []),
    ];

    for (const email of allEmails) {
      if (!this.validateEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }
  }
}

export class EmailService implements IEmailService {
  constructor(
    private readonly provider: BaseEmailProvider,
    private readonly logger: ILogger
  ) {}

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      this.logger.info('Sending email', {
        to: message.to,
        subject: message.subject,
      });

      const result = await this.provider.sendEmail(message);

      this.logger.info('Email sent successfully', {
        messageId: result.messageId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResult[]> {
    this.logger.info('Sending bulk email', { count: messages.length });

    const results = await this.provider.sendBulkEmail(messages);

    const successCount = results.filter(r => r.status === 'sent').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    this.logger.info('Bulk email completed', {
      total: messages.length,
      success: successCount,
      failed: failureCount,
    });

    return results;
  }

  validateEmail(email: string): boolean {
    return this.provider.validateEmail(email);
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    return this.provider.getDeliveryStatus(messageId);
  }
}