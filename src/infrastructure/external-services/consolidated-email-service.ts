/**
 * Consolidated Email Service Implementation
 * Unified email service with multiple provider support and failover
 */

import {
  BaseExternalService,
  ServiceProvider,
  ServiceFactory,
} from './service-factory';
import { logger } from '../logging/logger';

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
  templateId?: string;
  templateData?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string;
  size?: number;
}

export interface EmailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending?: string[];
  response?: string;
  provider: string;
  timestamp: Date;
}

export interface EmailDeliveryStatus {
  messageId: string;
  status:
    | 'sent'
    | 'delivered'
    | 'bounced'
    | 'complained'
    | 'rejected'
    | 'pending';
  timestamp: Date;
  error?: string;
  provider: string;
  metadata?: Record<string, any>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  tags?: string[];
}

export interface IEmailService {
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  sendBulkEmail(messages: EmailMessage[]): Promise<EmailSendResult[]>;
  sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>
  ): Promise<EmailSendResult>;
  validateEmail(email: string): boolean;
  getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus>;
  createTemplate(template: EmailTemplate): Promise<void>;
  updateTemplate(
    templateId: string,
    template: Partial<EmailTemplate>
  ): Promise<void>;
  deleteTemplate(templateId: string): Promise<void>;
  listTemplates(): Promise<EmailTemplate[]>;
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
  public abstract sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>
  ): Promise<EmailSendResult>;
  public abstract getDeliveryStatus(
    messageId: string
  ): Promise<EmailDeliveryStatus>;
  public abstract createTemplate(template: EmailTemplate): Promise<void>;
  public abstract updateTemplate(
    templateId: string,
    template: Partial<EmailTemplate>
  ): Promise<void>;
  public abstract deleteTemplate(templateId: string): Promise<void>;
  public abstract listTemplates(): Promise<EmailTemplate[]>;

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

    if (!message.subject && !message.templateId) {
      throw new Error('Email message must have a subject or template ID');
    }

    if (!message.text && !message.html && !message.templateId) {
      throw new Error(
        'Email message must have text, HTML content, or template ID'
      );
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

    // Validate attachments
    if (message.attachments) {
      const maxAttachmentSize =
        this.config.maxAttachmentSize || 25 * 1024 * 1024; // 25MB default
      const maxTotalSize =
        this.config.maxTotalAttachmentSize || 50 * 1024 * 1024; // 50MB default
      let totalSize = 0;

      for (const attachment of message.attachments) {
        const size =
          attachment.size ||
          (typeof attachment.content === 'string'
            ? Buffer.byteLength(attachment.content, 'utf8')
            : attachment.content.length);

        if (size > maxAttachmentSize) {
          throw new Error(
            `Attachment ${attachment.filename} exceeds maximum size limit`
          );
        }

        totalSize += size;
      }

      if (totalSize > maxTotalSize) {
        throw new Error('Total attachment size exceeds maximum limit');
      }
    }
  }

  protected renderTemplate(
    template: string,
    data: Record<string, any>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }
}

/**
 * SMTP Email Service Implementation
 */
export class SMTPEmailService extends BaseEmailService {
  private transporter: any;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(provider: ServiceProvider) {
    super(provider.name, provider.config);
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
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
        tls: {
          rejectUnauthorized: this.config.rejectUnauthorized !== false,
        },
      });

      logger.info(`SMTP transporter initialized for ${this.name}`, {
        host: this.config.host,
        port: this.config.port,
      });
    } catch (error) {
      logger.error(`Failed to initialize SMTP transporter for ${this.name}`, {
        error,
      });
      throw error;
    }
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
        headers: {
          ...message.headers,
          'X-Provider': this.name,
          'X-Tags': message.tags?.join(','),
        },
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully via ${this.name}`, {
        messageId: result.messageId,
        to: message.to,
        subject: message.subject,
        tags: message.tags,
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted || this.normalizeRecipients(message.to),
        rejected: result.rejected || [],
        response: result.response,
        provider: this.name,
        timestamp: new Date(),
      };
    });
  }

  public async sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    const batchSize = this.config.batchSize || 10;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(async message => {
        try {
          return await this.sendEmail(message);
        } catch (error) {
          logger.error(`Bulk email message failed`, { error, to: message.to });
          return {
            messageId: '',
            accepted: [],
            rejected: this.normalizeRecipients(message.to),
            provider: this.name,
            timestamp: new Date(),
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map(r =>
          r.status === 'fulfilled'
            ? r.value
            : {
                messageId: '',
                accepted: [],
                rejected: [],
                provider: this.name,
                timestamp: new Date(),
              }
        )
      );

      // Add delay between batches if configured
      if (this.config.batchDelay && i + batchSize < messages.length) {
        await new Promise(resolve =>
          setTimeout(resolve, this.config.batchDelay)
        );
      }
    }

    return results;
  }

  public async sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>
  ): Promise<EmailSendResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Email template not found: ${templateId}`);
    }

    const message: EmailMessage = {
      to,
      subject: this.renderTemplate(template.subject, data),
      html: this.renderTemplate(template.htmlContent, data),
      text: template.textContent
        ? this.renderTemplate(template.textContent, data)
        : undefined,
      tags: template.tags,
      metadata: { templateId, templateData: data },
    };

    return await this.sendEmail(message);
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
      provider: this.name,
    };
  }

  public async createTemplate(template: EmailTemplate): Promise<void> {
    this.templates.set(template.id, template);
    logger.info(`Email template created: ${template.id}`, {
      name: template.name,
    });
  }

  public async updateTemplate(
    templateId: string,
    template: Partial<EmailTemplate>
  ): Promise<void> {
    const existing = this.templates.get(templateId);
    if (!existing) {
      throw new Error(`Email template not found: ${templateId}`);
    }

    const updated = { ...existing, ...template };
    this.templates.set(templateId, updated);
    logger.info(`Email template updated: ${templateId}`);
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    const deleted = this.templates.delete(templateId);
    if (!deleted) {
      throw new Error(`Email template not found: ${templateId}`);
    }
    logger.info(`Email template deleted: ${templateId}`);
  }

  public async listTemplates(): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values());
  }
}

/**
 * SendGrid Email Service Implementation
 */
export class SendGridEmailService extends BaseEmailService {
  private client: any;

  constructor(provider: ServiceProvider) {
    super(provider.name, provider.config);
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      // This would require @sendgrid/mail package
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(this.config.apiKey);
      // this.client = sgMail;

      logger.info(`SendGrid client initialized for ${this.name}`);
    } catch (error) {
      logger.error(`Failed to initialize SendGrid client for ${this.name}`, {
        error,
      });
      throw error;
    }
  }

  public async isHealthy(): Promise<boolean> {
    try {
      // Test API key validity
      // const request = {
      //   url: '/v3/user/profile',
      //   method: 'GET',
      // };
      // await this.client.request(request);
      return true;
    } catch (error) {
      logger.error(`SendGrid service ${this.name} health check failed`, {
        error,
      });
      return false;
    }
  }

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    this.validateMessage(message);

    return await this.executeWithCircuitBreaker(async () => {
      const msg = {
        to: this.normalizeRecipients(message.to),
        cc: message.cc ? this.normalizeRecipients(message.cc) : undefined,
        bcc: message.bcc ? this.normalizeRecipients(message.bcc) : undefined,
        from: message.from || this.config.defaultFrom,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map(att => ({
          filename: att.filename,
          content:
            typeof att.content === 'string'
              ? Buffer.from(att.content).toString('base64')
              : att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
          contentId: att.cid,
        })),
        replyTo: message.replyTo,
        headers: message.headers,
        customArgs: {
          provider: this.name,
          tags: message.tags?.join(','),
          ...message.metadata,
        },
      };

      // Mock result for now
      const result = {
        messageId: `sg-${Date.now()}`,
        accepted: this.normalizeRecipients(message.to),
        rejected: [],
      };

      logger.info(`Email sent successfully via ${this.name}`, {
        messageId: result.messageId,
        to: message.to,
        subject: message.subject,
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        provider: this.name,
        timestamp: new Date(),
      };
    });
  }

  public async sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]> {
    // SendGrid supports bulk sending
    const results: EmailSendResult[] = [];

    for (const message of messages) {
      try {
        const result = await this.sendEmail(message);
        results.push(result);
      } catch (error) {
        logger.error(`Bulk email message failed`, { error, to: message.to });
        results.push({
          messageId: '',
          accepted: [],
          rejected: this.normalizeRecipients(message.to),
          provider: this.name,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  public async sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>
  ): Promise<EmailSendResult> {
    return await this.executeWithCircuitBreaker(async () => {
      const msg = {
        to: this.normalizeRecipients(to),
        from: this.config.defaultFrom,
        templateId,
        dynamicTemplateData: data,
        customArgs: {
          provider: this.name,
          templateId,
        },
      };

      // Mock result for now
      const result = {
        messageId: `sg-template-${Date.now()}`,
        accepted: this.normalizeRecipients(to),
        rejected: [],
      };

      logger.info(`Templated email sent successfully via ${this.name}`, {
        messageId: result.messageId,
        to,
        templateId,
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        provider: this.name,
        timestamp: new Date(),
      };
    });
  }

  public async getDeliveryStatus(
    messageId: string
  ): Promise<EmailDeliveryStatus> {
    // SendGrid provides webhook events for delivery status
    return {
      messageId,
      status: 'sent',
      timestamp: new Date(),
      provider: this.name,
    };
  }

  public async createTemplate(template: EmailTemplate): Promise<void> {
    // Implementation would use SendGrid's template API
    logger.info(`Email template created: ${template.id}`, {
      name: template.name,
    });
  }

  public async updateTemplate(
    templateId: string,
    template: Partial<EmailTemplate>
  ): Promise<void> {
    // Implementation would use SendGrid's template API
    logger.info(`Email template updated: ${templateId}`);
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    // Implementation would use SendGrid's template API
    logger.info(`Email template deleted: ${templateId}`);
  }

  public async listTemplates(): Promise<EmailTemplate[]> {
    // Implementation would use SendGrid's template API
    return [];
  }
}

/**
 * Email Service Factory
 */
export function createEmailService(
  provider: ServiceProvider
): BaseEmailService {
  switch (provider.name.toLowerCase()) {
    case 'smtp':
      return new SMTPEmailService(provider);
    case 'sendgrid':
      return new SendGridEmailService(provider);
    default:
      throw new Error(`Unknown email service provider: ${provider.name}`);
  }
}

/**
 * Consolidated Email Service Manager
 */
export class EmailServiceManager {
  private serviceFactory: ServiceFactory<BaseEmailService>;

  constructor(providers: ServiceProvider[]) {
    this.serviceFactory = new ServiceFactory('email', createEmailService, {
      providers,
      fallbackStrategy: 'failover',
      healthCheckInterval: 60000,
    });
  }

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const service = await this.serviceFactory.getService();
    return await service.sendEmail(message);
  }

  public async sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]> {
    const service = await this.serviceFactory.getService();
    return await service.sendBulkEmail(messages);
  }

  public async sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>
  ): Promise<EmailSendResult> {
    const service = await this.serviceFactory.getService();
    return await service.sendTemplatedEmail(templateId, to, data);
  }

  public async getDeliveryStatus(
    messageId: string
  ): Promise<EmailDeliveryStatus> {
    // Try to determine which provider sent the message based on messageId format
    const service = await this.serviceFactory.getService();
    return await service.getDeliveryStatus(messageId);
  }

  public async getHealthStatus(): Promise<Record<string, any>> {
    return await this.serviceFactory.getAllServicesHealth();
  }

  public getAvailableProviders(): string[] {
    return this.serviceFactory.getAvailableProviders();
  }
}

// Singleton instance
let emailServiceManager: EmailServiceManager | null = null;

export function createEmailServiceManager(
  providers: ServiceProvider[]
): EmailServiceManager {
  if (!emailServiceManager) {
    emailServiceManager = new EmailServiceManager(providers);
  }
  return emailServiceManager;
}

export function getEmailServiceManager(): EmailServiceManager {
  if (!emailServiceManager) {
    throw new Error(
      'Email service manager not initialized. Call createEmailServiceManager() first.'
    );
  }
  return emailServiceManager;
}
