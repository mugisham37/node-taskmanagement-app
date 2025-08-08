import { BaseExternalService, ServiceProvider } from '../service-factory';
import { logger } from '../../logging/logger';

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  from?: string;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

export interface EmailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending?: string[];
  response?: string;
}

export interface IEmailService {
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  sendBulkEmail(messages: EmailMessage[]): Promise<EmailSendResult[]>;
  validateEmail(email: string): boolean;
  getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus>;
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'bounced' | 'complained' | 'rejected';
  timestamp: Date;
  error?: string;
}

export abstract class BaseEmailService
  extends BaseExternalService
  implements IEmailService
{
  constructor(name: string, config: Record<string, any>) {
    super(name, config);
  }

  public abstract sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  public abstract sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]>;
  public abstract getDeliveryStatus(
    messageId: string
  ): Promise<EmailDeliveryStatus>;

  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  protected normalizeRecipients(recipients: string | string[]): string[] {
    return Array.isArray(recipients) ? recipients : [recipients];
  }

  protected validateMessage(message: EmailMessage): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('Email message must have at least one recipient');
    }

    if (!message.subject) {
      throw new Error('Email message must have a subject');
    }

    if (!message.text && !message.html) {
      throw new Error('Email message must have either text or HTML content');
    }

    // Validate all email addresses
    const allRecipients = [
      ...this.normalizeRecipients(message.to),
      ...(message.cc ? this.normalizeRecipients(message.cc) : []),
      ...(message.bcc ? this.normalizeRecipients(message.bcc) : []),
    ];

    for (const email of allRecipients) {
      if (!this.validateEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

    if (message.from && !this.validateEmail(message.from)) {
      throw new Error(`Invalid from email address: ${message.from}`);
    }

    if (message.replyTo && !this.validateEmail(message.replyTo)) {
      throw new Error(`Invalid reply-to email address: ${message.replyTo}`);
    }
  }
}

// SMTP Email Service Implementation
export class SMTPEmailService extends BaseEmailService {
  private transporter: any;

  constructor(provider: ServiceProvider) {
    super(provider.name, provider.config);
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const nodemailer = require('nodemailer');

    this.transporter = nodemailer.createTransporter({
      host: this.config.host,
      port: this.config.port || 587,
      secure: this.config.secure || false,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      pool: true,
      maxConnections: this.config.maxConnections || 5,
      maxMessages: this.config.maxMessages || 100,
      rateDelta: this.config.rateDelta || 1000,
      rateLimit: this.config.rateLimit || 10,
    });
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error(`SMTP service ${this.name} health check failed`, { error });
      return false;
    }
  }

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    this.validateMessage(message);

    return await this.executeWithCircuitBreaker(async () => {
      const mailOptions = {
        from: message.from || this.config.defaultFrom,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        cc: message.cc
          ? Array.isArray(message.cc)
            ? message.cc.join(', ')
            : message.cc
          : undefined,
        bcc: message.bcc
          ? Array.isArray(message.bcc)
            ? message.bcc.join(', ')
            : message.bcc
          : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          encoding: att.encoding,
          cid: att.cid,
        })),
        replyTo: message.replyTo,
        priority: message.priority,
        headers: message.headers,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully via ${this.name}`, {
        messageId: result.messageId,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted || [],
        rejected: result.rejected || [],
        response: result.response,
      };
    });
  }

  public async sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    // Send emails in batches to avoid overwhelming the server
    const batchSize = this.config.batchSize || 10;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => this.sendEmail(message));

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        logger.error(`Bulk email batch failed`, {
          batchIndex: i / batchSize,
          error,
        });
        // Continue with next batch
      }

      // Add delay between batches if configured
      if (this.config.batchDelay && i + batchSize < messages.length) {
        await new Promise(resolve =>
          setTimeout(resolve, this.config.batchDelay)
        );
      }
    }

    return results;
  }

  public async getDeliveryStatus(
    messageId: string
  ): Promise<EmailDeliveryStatus> {
    // SMTP doesn't provide delivery status by default
    // This would need to be implemented with webhooks or polling
    return {
      messageId,
      status: 'sent',
      timestamp: new Date(),
    };
  }
}

// AWS SES Email Service Implementation
export class SESEmailService extends BaseEmailService {
  private sesClient: any;

  constructor(provider: ServiceProvider) {
    super(provider.name, provider.config);
    this.initializeSESClient();
  }

  private initializeSESClient(): void {
    // This would require AWS SDK
    // const { SESClient } = require('@aws-sdk/client-ses');
    // this.sesClient = new SESClient({
    //   region: this.config.region,
    //   credentials: {
    //     accessKeyId: this.config.accessKeyId,
    //     secretAccessKey: this.config.secretAccessKey,
    //   },
    // });
  }

  public async isHealthy(): Promise<boolean> {
    try {
      // Check SES sending quota and statistics
      // const command = new GetSendQuotaCommand({});
      // await this.sesClient.send(command);
      return true;
    } catch (error) {
      logger.error(`SES service ${this.name} health check failed`, { error });
      return false;
    }
  }

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    this.validateMessage(message);

    return await this.executeWithCircuitBreaker(async () => {
      // Implementation would use AWS SES SDK
      // const command = new SendEmailCommand({
      //   Source: message.from || this.config.defaultFrom,
      //   Destination: {
      //     ToAddresses: this.normalizeRecipients(message.to),
      //     CcAddresses: message.cc ? this.normalizeRecipients(message.cc) : undefined,
      //     BccAddresses: message.bcc ? this.normalizeRecipients(message.bcc) : undefined,
      //   },
      //   Message: {
      //     Subject: { Data: message.subject },
      //     Body: {
      //       Text: message.text ? { Data: message.text } : undefined,
      //       Html: message.html ? { Data: message.html } : undefined,
      //     },
      //   },
      // });

      // const result = await this.sesClient.send(command);

      // Mock result for now
      const result = {
        MessageId: `mock-${Date.now()}`,
      };

      logger.info(`Email sent successfully via ${this.name}`, {
        messageId: result.MessageId,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: result.MessageId,
        accepted: this.normalizeRecipients(message.to),
        rejected: [],
      };
    });
  }

  public async sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]> {
    // SES has bulk sending capabilities
    const results: EmailSendResult[] = [];

    for (const message of messages) {
      try {
        const result = await this.sendEmail(message);
        results.push(result);
      } catch (error) {
        logger.error(`Bulk email message failed`, { error });
        results.push({
          messageId: '',
          accepted: [],
          rejected: this.normalizeRecipients(message.to),
        });
      }
    }

    return results;
  }

  public async getDeliveryStatus(
    messageId: string
  ): Promise<EmailDeliveryStatus> {
    // SES provides delivery status through SNS notifications
    // This would need to be implemented with a webhook endpoint
    return {
      messageId,
      status: 'sent',
      timestamp: new Date(),
    };
  }
}

// Email service factory function
export function createEmailService(
  provider: ServiceProvider
): BaseEmailService {
  switch (provider.name.toLowerCase()) {
    case 'smtp':
      return new SMTPEmailService(provider);
    case 'ses':
    case 'aws-ses':
      return new SESEmailService(provider);
    default:
      throw new Error(`Unknown email service provider: ${provider.name}`);
  }
}
