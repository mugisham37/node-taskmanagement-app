import * as nodemailer from 'nodemailer';
import { CircuitBreaker } from './circuit-breaker';
import { LoggingService } from '../monitoring/logging-service';
import { EmailDeliveryStatus, EmailTemplate } from './email-types';

export interface SendEmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: any[];
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
  metadata?: Record<string, any>;
  templateId?: string;
}

export interface EmailQueueItem {
  id: string;
  data: SendEmailData;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastError?: string;
  lastAttemptAt?: Date;
  error?: string;
}

export interface TaskAssignmentTemplateData {
  assigneeName: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  assignedByName: string;
  dueDate?: Date;
}

export interface TaskReminderTemplateData {
  recipientName: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  creatorName: string;
  dueDate?: Date;
}

export interface UserActivationTemplateData {
  userName: string;
  activationLink?: string;
}

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  replyTo?: string;
  maxAttachmentSize?: number;
  maxTotalAttachmentSize?: number;
}

export interface EmailTemplateInterface {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter!: nodemailer.Transporter;
  private emailQueue: EmailQueueItem[] = [];
  private isProcessing = false;
  private circuitBreaker!: CircuitBreaker;
  private templates: Map<string, EmailTemplate> = new Map();
  private fallbackProviders: EmailService[] = [];

  constructor(
    private readonly config: EmailConfig,
    private readonly logger: LoggingService
  ) {
    this.initializeTransporter();
    this.initializeCircuitBreaker();
    this.startQueueProcessor();
  }

  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.auth,
    });
  }

  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker('email-service', {
      failureThreshold: 5,
      recoveryTimeout: 300000,
      monitoringPeriod: 600000,
    });
  }

  /**
   * Send email immediately
   */
  async sendEmail(data: SendEmailData): Promise<boolean> {
    this.validateMessage(data);

    return await this.sendDirectEmail(data);
  }

  /**
   * Send email directly using nodemailer
   */
  private async sendDirectEmail(data: SendEmailData): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      const mailOptions: nodemailer.SendMailOptions = {
        from: data.from || this.config.from,
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
        replyTo: data.replyTo || this.config.replyTo,
        cc: data.cc,
        bcc: data.bcc,
        attachments: data.attachments,
        headers: {
          'X-Provider': 'Task Management System',
          'X-Tags': data.tags?.join(','),
        } as Record<string, string>,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: data.to,
        subject: data.subject,
        tags: data.tags,
      });

      return true;
    });
  }

  /**
   * Send task assignment email
   */
  async sendTaskAssignmentEmail(
    assigneeEmail: string,
    data: TaskAssignmentTemplateData
  ): Promise<boolean> {
    const template = await this.getTemplate('task-assignment');
    if (!template) {
      throw new Error('Task assignment template not found');
    }

    const html = this.renderTemplate(template.htmlContent, {
      assigneeName: data.assigneeName,
      taskTitle: data.taskTitle,
      taskDescription: data.taskDescription,
      projectName: data.projectName,
      assignedByName: data.assignedByName,
      dueDate: data.dueDate || undefined,
    });

    const text = template.textContent
      ? this.renderTemplate(template.textContent, data)
      : '';

    return this.sendEmail({
      to: assigneeEmail,
      subject: this.renderTemplate(template.subject, data),
      html,
      text,
      priority: 'normal',
    });
  }

  /**
   * Send task reminder email
   */
  async sendTaskReminderEmail(
    recipientEmail: string,
    data: TaskReminderTemplateData
  ): Promise<boolean> {
    const template = await this.getTemplate('task-reminder');
    if (!template) {
      throw new Error('Task reminder template not found');
    }

    const html = this.renderTemplate(template.htmlContent, {
      recipientName: data.recipientName,
      taskTitle: data.taskTitle,
      taskDescription: data.taskDescription,
      projectName: data.projectName,
      creatorName: data.creatorName,
      dueDate: data.dueDate || undefined,
    });

    const text = template.textContent
      ? this.renderTemplate(template.textContent, data)
      : '';

    return this.sendEmail({
      to: recipientEmail,
      subject: this.renderTemplate(template.subject, data),
      html,
      text,
      priority: 'normal',
    });
  }

  /**
   * Send user activation email
   */
  async sendUserActivationEmail(
    userEmail: string,
    data: UserActivationTemplateData
  ): Promise<boolean> {
    const template = await this.getTemplate('user-activation');
    if (!template) {
      throw new Error('User activation template not found');
    }

    const html = this.renderTemplate(template.htmlContent, {
      userName: data.userName,
      activationLink: data.activationLink || undefined,
    });

    const text = template.textContent
      ? this.renderTemplate(template.textContent, data)
      : '';

    return this.sendEmail({
      to: userEmail,
      subject: this.renderTemplate(template.subject, data),
      html,
      text,
      priority: 'normal',
    });
  }

  /**
   * Add email to queue
   */
  async queueEmail(data: SendEmailData, scheduledAt?: Date): Promise<string> {
    const emailId = this.addToQueue(data, scheduledAt);
    return emailId;
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      const itemsToProcess = this.emailQueue.filter(
        item => !item.scheduledAt || item.scheduledAt <= now
      );

      for (const item of itemsToProcess) {
        try {
          await this.sendEmail(item.data);

          // Remove successfully sent email from queue
          this.emailQueue = this.emailQueue.filter(queueItem => queueItem.id !== item.id);
          this.logger.info('Email sent successfully and removed from queue', {
            emailId: item.id,
          });
        } catch (error) {
          item.attempts++;
          item.lastError = error instanceof Error ? error.message : 'Unknown error';

          if (item.attempts >= item.maxAttempts) {
            // Remove failed email after max attempts
            this.emailQueue = this.emailQueue.filter(
              queueItem => queueItem.id !== item.id
            );
            this.logger.error('Email failed after max attempts', undefined, {
              emailId: item.id,
              maxAttempts: item.maxAttempts,
              errorMessage: item.lastError,
            });
          } else {
            this.logger.warn('Email attempt failed', {
              emailId: item.id,
              attempt: item.attempts,
              maxAttempts: item.maxAttempts,
              error: item.lastError,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing email queue', error as Error, {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 30000); // Process queue every 30 seconds
  }

  /**
   * Add to queue
   */
  private addToQueue(data: SendEmailData, scheduledAt?: Date): string {
    const queueItem: EmailQueueItem = {
      id: this.generateId(),
      data,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      ...(scheduledAt && { scheduledAt }),
    };

    this.emailQueue.push(queueItem);
    return queueItem.id;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate email message
   */
  private validateMessage(message: SendEmailData): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('Email message must have at least one recipient');
    }

    if (!message.subject && !message.html && !message.text) {
      throw new Error('Email message must have a subject and content');
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

  /**
   * Normalize recipients to array
   */
  private normalizeRecipients(recipients: string | string[]): string[] {
    return Array.isArray(recipients) ? recipients : [recipients];
  }

  /**
   * Validate email address
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Render template with data
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const replacement = value?.toString() || '';
      rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
    });
    return rendered;
  }

  /**
   * Get email template by name
   */
  private async getTemplate(name: string): Promise<EmailTemplate | null> {
    // Simulate template retrieval
    const templates: Record<string, EmailTemplate> = {
      'task-assignment': {
        id: 'task-assignment',
        name: 'Task Assignment',
        subject: 'New Task Assigned: {{taskTitle}}',
        htmlContent: `<p>Hello {{assigneeName}},</p>
                      <p>You have been assigned a new task: <strong>{{taskTitle}}</strong>.</p>
                      <p>Project: {{projectName}}</p>
                      <p>Description: {{taskDescription}}</p>
                      <p>Due Date: {{dueDate}}</p>
                      <p>Assigned by: {{assignedByName}}</p>`,
        textContent: `Hello {{assigneeName}},

You have been assigned a new task: {{taskTitle}}.

Project: {{projectName}}
Description: {{taskDescription}}
Due Date: {{dueDate}}
Assigned by: {{assignedByName}}`,
        variables: [
          'assigneeName',
          'taskTitle',
          'taskDescription',
          'projectName',
          'assignedByName',
          'dueDate',
        ],
        html: `<p>Hello {{assigneeName}},</p>
                      <p>You have been assigned a new task: <strong>{{taskTitle}}</strong>.</p>
                      <p>Project: {{projectName}}</p>
                      <p>Description: {{taskDescription}}</p>
                      <p>Due Date: {{dueDate}}</p>
                      <p>Assigned by: {{assignedByName}}</p>`,
        text: `Hello {{assigneeName}},

You have been assigned a new task: {{taskTitle}}.

Project: {{projectName}}
Description: {{taskDescription}}
Due Date: {{dueDate}}
Assigned by: {{assignedByName}}`,
      },
      'task-reminder': {
        id: 'task-reminder',
        name: 'Task Reminder',
        subject: 'Reminder: Task "{{taskTitle}}" is due soon',
        htmlContent: `<p>Hello {{recipientName}},</p>
                      <p>This is a reminder that the task "<strong>{{taskTitle}}</strong>" is due soon.</p>
                      <p>Project: {{projectName}}</p>
                      <p>Description: {{taskDescription}}</p>
                      <p>Due Date: {{dueDate}}</p>
                      <p>Created by: {{creatorName}}</p>`,
        textContent: `Hello {{recipientName}},

This is a reminder that the task "{{taskTitle}}" is due soon.

Project: {{projectName}}
Description: {{taskDescription}}
Due Date: {{dueDate}}
Created by: {{creatorName}}`,
        variables: [
          'recipientName',
          'taskTitle',
          'taskDescription',
          'projectName',
          'creatorName',
          'dueDate',
        ],
        html: `<p>Hello {{recipientName}},</p>
                      <p>This is a reminder that the task "<strong>{{taskTitle}}</strong>" is due soon.</p>
                      <p>Project: {{projectName}}</p>
                      <p>Description: {{taskDescription}}</p>
                      <p>Due Date: {{dueDate}}</p>
                      <p>Created by: {{creatorName}}</p>`,
        text: `Hello {{recipientName}},

This is a reminder that the task "{{taskTitle}}" is due soon.

Project: {{projectName}}
Description: {{taskDescription}}
Due Date: {{dueDate}}
Created by: {{creatorName}}`,
      },
      'user-activation': {
        id: 'user-activation',
        name: 'User Activation',
        subject: 'Activate your account',
        htmlContent: `<p>Hello {{userName}},</p>
                      <p>Welcome to the Task Management System!</p>
                      <p>Please activate your account by clicking the link below:</p>
                      <p><a href="{{activationLink}}">Activate Account</a></p>`,
        textContent: `Hello {{userName}},

Welcome to the Task Management System!

Please activate your account by clicking the link below:
{{activationLink}}`,
        variables: ['userName', 'activationLink'],
        html: `<p>Hello {{userName}},</p>
                      <p>Welcome to the Task Management System!</p>
                      <p>Please activate your account by clicking the link below:</p>
                      <p><a href="{{activationLink}}">Activate Account</a></p>`,
        text: `Hello {{userName}},

Welcome to the Task Management System!

Please activate your account by clicking the link below:
{{activationLink}}`,
      },
    };

    return templates[name] || null;
  }

  /**
   * Create email template
   */
  async createTemplate(template: EmailTemplate): Promise<void> {
    if (!template.id) {
      template.id = this.generateId();
    }
    this.templates.set(template.id, template);
    this.logger.info('Email template created', { templateId: template.id });
  }

  /**
   * Update email template
   */
  async updateTemplate(
    templateId: string,
    template: Partial<EmailTemplate>
  ): Promise<void> {
    const existing = this.templates.get(templateId);
    if (!existing) {
      throw new Error(`Email template not found: ${templateId}`);
    }

    const updated = { ...existing, ...template };
    this.templates.set(templateId, updated);
    this.logger.info('Email template updated', { templateId });
  }

  /**
   * Delete email template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const deleted = this.templates.delete(templateId);
    if (!deleted) {
      throw new Error(`Email template not found: ${templateId}`);
    }
    this.logger.info('Email template deleted', { templateId });
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Get delivery status
   */
  async getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus> {
    // SMTP doesn't provide delivery status by default
    return {
      messageId,
      status: 'sent',
      timestamp: new Date(),
      provider: 'smtp',
    };
  }

  /**
   * Check service health
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('Email service health check failed', error as Error, {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get health status including circuit breaker
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const isHealthy = await this.isHealthy();
    return {
      smtp: {
        healthy: isHealthy,
        circuitBreakerState: this.circuitBreaker.getStats().state,
      },
    };
  }

  /**
   * Add fallback provider
   */
  addFallbackProvider(provider: EmailService): void {
    this.fallbackProviders.push(provider);
  }

  /**
   * Send two-factor authentication code via email
   */
  async sendTwoFactorCode(
    email: string,
    code: string,
    expirationMinutes: number = 10
  ): Promise<void> {
    try {
      const subject = 'Your Two-Factor Authentication Code';
      const html = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #343a40; margin-bottom: 16px;">Two-Factor Authentication Code</h2>
              <p style="color: #6c757d; margin-bottom: 16px;">
                You have requested a two-factor authentication code. Please use the code below to complete your login:
              </p>
              <div style="background-color: #ffffff; padding: 20px; border-radius: 4px; border: 2px solid #007bff; text-align: center; margin: 20px 0;">
                <h1 style="color: #007bff; font-size: 32px; letter-spacing: 8px; margin: 0; font-family: monospace;">
                  ${code}
                </h1>
              </div>
              <p style="color: #6c757d; font-size: 14px; margin-bottom: 8px;">
                <strong>Important:</strong>
              </p>
              <ul style="color: #6c757d; font-size: 14px; margin-bottom: 16px;">
                <li>This code will expire in ${expirationMinutes} minutes</li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this code, please secure your account immediately</li>
              </ul>
            </div>
            <div style="color: #6c757d; font-size: 12px; text-align: center; border-top: 1px solid #dee2e6; padding-top: 16px;">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </body>
        </html>
      `;

      const text = `
Your Two-Factor Authentication Code

You have requested a two-factor authentication code. Please use the code below to complete your login:

Code: ${code}

Important:
- This code will expire in ${expirationMinutes} minutes
- Do not share this code with anyone
- If you didn't request this code, please secure your account immediately

This is an automated message, please do not reply to this email.
      `.trim();

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
        priority: 'high',
        tags: ['2fa', 'security'],
        metadata: {
          type: 'two_factor_auth',
          expirationMinutes,
        },
      });

      this.logger.info('Two-factor authentication code sent', {
        email,
        expirationMinutes,
      });
    } catch (error) {
      this.logger.error('Failed to send two-factor authentication code', error as Error, {
        email,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
