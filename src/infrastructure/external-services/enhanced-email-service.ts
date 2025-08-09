/**
 * Enhanced Email Service
 * Comprehensive email service with multiple provider support, circuit breaker, and advanced features
 * Migrated and enhanced from older version
 */

import { logger } from '../monitoring/logging-service';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';

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

export interface EmailProvider {
  name: string;
  type: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
  config: Record<string, any>;
  priority: number;
  enabled: boolean;
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
  isHealthy(): Promise<boolean>;
}

export abstract class BaseEmailProvider implements IEmailService {
  protected circuitBreaker: CircuitBreaker;
  protected templates: Map<string, EmailTemplate> = new Map();

  constructor(
    protected name: string,
    protected config: Record<string, any>
  ) {
    this.circuitBreaker = new CircuitBreaker(`email-${name}`, {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000,
      monitoringPeriod: config.monitoringPeriod || 300000,
      onStateChange: state => {
        logger.info(`Email provider ${name} circuit breaker state changed`, {
          state,
        });
      },
    });
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
  public abstract isHealthy(): Promise<boolean>;

  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
        this.config.maxAttachmentSize || 25 * 1024 * 1024; // 25MB
      const maxTotalSize =
        this.config.maxTotalAttachmentSize || 50 * 1024 * 1024; // 50MB
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

  protected async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.circuitBreaker.execute(operation);
  }
}

/**
 * SMTP Email Provider
 */
export class SMTPEmailProvider extends BaseEmailProvider {
  private transporter: any;

  constructor(config: EmailProvider) {
    super(config.name, config.config);
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      // Mock transporter for now - would use nodemailer in real implementation
      this.transporter = {
        sendMail: async (options: any) => ({
          messageId: `smtp-${Date.now()}`,
          accepted: options.to.split(',').map((email: string) => email.trim()),
          rejected: [],
          response: 'Message sent successfully',
        }),
        verify: async () => true,
      };

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
    return {
      messageId,
      status: 'sent',
      timestamp: new Date(),
      provider: this.name,
    };
  }
}

/**
 * Enhanced Email Service Manager
 */
export class EnhancedEmailService {
  private providers: Map<string, BaseEmailProvider> = new Map();
  private primaryProvider?: BaseEmailProvider;
  private fallbackProviders: BaseEmailProvider[] = [];

  constructor(private emailProviders: EmailProvider[]) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Sort providers by priority
    const sortedProviders = this.emailProviders
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const providerConfig of sortedProviders) {
      let provider: BaseEmailProvider;

      switch (providerConfig.type) {
        case 'smtp':
          provider = new SMTPEmailProvider(providerConfig);
          break;
        default:
          logger.warn(`Unknown email provider type: ${providerConfig.type}`);
          continue;
      }

      this.providers.set(providerConfig.name, provider);

      if (!this.primaryProvider) {
        this.primaryProvider = provider;
      } else {
        this.fallbackProviders.push(provider);
      }
    }

    logger.info('Email providers initialized', {
      primary: this.primaryProvider?.name,
      fallbacks: this.fallbackProviders.map(p => p.name),
    });
  }

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.primaryProvider) {
      throw new Error('No email providers available');
    }

    // Try primary provider first
    try {
      return await this.primaryProvider.sendEmail(message);
    } catch (error) {
      logger.warn(
        `Primary email provider ${this.primaryProvider.name} failed`,
        { error }
      );

      // Try fallback providers
      for (const fallbackProvider of this.fallbackProviders) {
        try {
          logger.info(
            `Attempting fallback email provider: ${fallbackProvider.name}`
          );
          return await fallbackProvider.sendEmail(message);
        } catch (fallbackError) {
          logger.warn(
            `Fallback email provider ${fallbackProvider.name} failed`,
            {
              error: fallbackError,
            }
          );
        }
      }

      throw new Error('All email providers failed');
    }
  }

  public async sendBulkEmail(
    messages: EmailMessage[]
  ): Promise<EmailSendResult[]> {
    if (!this.primaryProvider) {
      throw new Error('No email providers available');
    }

    try {
      return await this.primaryProvider.sendBulkEmail(messages);
    } catch (error) {
      logger.warn(
        `Primary email provider ${this.primaryProvider.name} bulk send failed`,
        { error }
      );

      // For bulk operations, try to send individually through fallback providers
      const results: EmailSendResult[] = [];
      for (const message of messages) {
        try {
          const result = await this.sendEmail(message);
          results.push(result);
        } catch (messageError) {
          logger.error('Failed to send individual email in bulk operation', {
            error: messageError,
            to: message.to,
          });
          results.push({
            messageId: '',
            accepted: [],
            rejected: this.normalizeRecipients(message.to),
            provider: 'failed',
            timestamp: new Date(),
          });
        }
      }
      return results;
    }
  }

  public async sendTemplatedEmail(
    templateId: string,
    to: string | string[],
    data: Record<string, any>
  ): Promise<EmailSendResult> {
    if (!this.primaryProvider) {
      throw new Error('No email providers available');
    }

    try {
      return await this.primaryProvider.sendTemplatedEmail(
        templateId,
        to,
        data
      );
    } catch (error) {
      logger.warn(
        `Primary email provider ${this.primaryProvider.name} templated send failed`,
        { error }
      );

      // Try fallback providers
      for (const fallbackProvider of this.fallbackProviders) {
        try {
          return await fallbackProvider.sendTemplatedEmail(
            templateId,
            to,
            data
          );
        } catch (fallbackError) {
          logger.warn(
            `Fallback email provider ${fallbackProvider.name} templated send failed`,
            {
              error: fallbackError,
            }
          );
        }
      }

      throw new Error('All email providers failed for templated email');
    }
  }

  public async getHealthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        status[name] = {
          healthy: isHealthy,
          circuitBreakerState: provider['circuitBreaker'].getStats().state,
        };
      } catch (error) {
        status[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return status;
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  private normalizeRecipients(recipients: string | string[]): string[] {
    return Array.isArray(recipients) ? recipients : [recipients];
  }
}

// Default configuration
const defaultEmailProviders: EmailProvider[] = [
  {
    name: 'primary-smtp',
    type: 'smtp',
    priority: 1,
    enabled: true,
    config: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      username: process.env.SMTP_USERNAME,
      password: process.env.SMTP_PASSWORD,
      defaultFrom: process.env.SMTP_FROM || 'noreply@example.com',
      maxConnections: 5,
      maxMessages: 100,
      batchSize: 10,
      batchDelay: 1000,
    },
  },
];

export const enhancedEmailService = new EnhancedEmailService(
  defaultEmailProviders
);
