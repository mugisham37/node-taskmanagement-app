import { LoggingService } from '@taskmanagement/observability';
import * as nodemailer from 'nodemailer';
import { CircuitBreaker } from './circuit-breaker';
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

    const text = template.textContent ? this.renderTemplate(template.textContent, data) : '';

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

    const text = template.textContent ? this.renderTemplate(template.textContent, data) : '';

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

    const text = template.textContent ? this.renderTemplate(template.textContent, data) : '';

    return this.sendEmail({
      to: userEmail,
      subject: this.renderTemplate(template.subject, data),
      html,
      text,
      priority: 'normal',
    });
  }

  /**
   * Send workspace invitation email
   */
  async sendWorkspaceInvitation(data: {
    recipientEmail: string;
    workspaceName: string;
    inviterName: string;
    invitationLink: string;
  }): Promise<boolean> {
    const template = await this.getTemplate('workspace-invitation');
    if (!template) {
      // Fallback to basic template if not found
      const html = `
        <h2>You've been invited to join ${data.workspaceName}</h2>
        <p>Hello,</p>
        <p>${data.inviterName} has invited you to join the "${data.workspaceName}" workspace.</p>
        <p><a href="${data.invitationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Accept Invitation</a></p>
        <p>If you can't click the button, copy and paste this link into your browser:</p>
        <p>${data.invitationLink}</p>
        <p>Best regards,<br>The Task Management Team</p>
      `;

      const text = `
        You've been invited to join ${data.workspaceName}
        
        ${data.inviterName} has invited you to join the "${data.workspaceName}" workspace.
        
        To accept the invitation, visit: ${data.invitationLink}
        
        Best regards,
        The Task Management Team
      `;

      return this.sendEmail({
        to: data.recipientEmail,
        subject: `Invitation to join ${data.workspaceName}`,
        html: html.trim(),
        text: text.trim(),
        priority: 'normal',
      });
    }

    const templateData = {
      recipientEmail: data.recipientEmail,
      workspaceName: data.workspaceName,
      inviterName: data.inviterName,
      invitationLink: data.invitationLink,
    };

    const html = this.renderTemplate(template.htmlContent, templateData);
    const text = template.textContent
      ? this.renderTemplate(template.textContent, templateData)
      : '';

    return this.sendEmail({
      to: data.recipientEmail,
      subject: this.renderTemplate(template.subject, templateData),
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
        (item) => !item.scheduledAt || item.scheduledAt <= now
      );

      for (const item of itemsToProcess) {
        try {
          await this.sendEmail(item.data);

          // Remove successfully sent email from queue
          this.emailQueue = this.emailQueue.filter((queueItem) => queueItem.id !== item.id);
          this.logger.info('Email sent successfully and removed from queue', {
            emailId: item.id,
          });
        } catch (error) {
          item.attempts++;
          item.lastError = error instanceof Error ? error.message : 'Unknown error';

          if (item.attempts >= item.maxAttempts) {
            // Remove failed email after max attempts
            this.emailQueue = this.emailQueue.filter((queueItem) => queueItem.id !== item.id);
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
      const maxAttachmentSize = this.config.maxAttachmentSize || 25 * 1024 * 1024; // 25MB
      const maxTotalSize = this.config.maxTotalAttachmentSize || 50 * 1024 * 1024; // 50MB
      let totalSize = 0;

      for (const attachment of message.attachments) {
        const size =
          attachment.size ||
          (typeof attachment.content === 'string'
            ? Buffer.byteLength(attachment.content, 'utf8')
            : attachment.content.length);

        if (size > maxAttachmentSize) {
          throw new Error(`Attachment ${attachment.filename} exceeds maximum size limit`);
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
  async updateTemplate(templateId: string, template: Partial<EmailTemplate>): Promise<void> {
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

  /**
   * Send task creation notification
   */
  async sendTaskCreationNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    taskDescription: string,
    projectName: string,
    creatorName: string,
    dueDate?: Date
  ): Promise<boolean> {
    try {
      const subject = `New Task Created: ${taskTitle}`;
      const html = `
        <h2>New Task Created</h2>
        <p>Hello ${recipientName},</p>
        <p>A new task has been created in project <strong>${projectName}</strong>:</p>
        <ul>
          <li><strong>Title:</strong> ${taskTitle}</li>
          <li><strong>Description:</strong> ${taskDescription}</li>
          <li><strong>Created by:</strong> ${creatorName}</li>
          ${dueDate ? `<li><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</li>` : ''}
        </ul>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['task', 'notification'],
      });
    } catch (error) {
      this.logger.error('Failed to send task creation notification', error as Error);
      throw error;
    }
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    taskDescription: string,
    projectName: string,
    assignedByName: string,
    dueDate?: Date
  ): Promise<boolean> {
    try {
      const subject = `Task Assigned: ${taskTitle}`;
      const html = `
        <h2>Task Assigned to You</h2>
        <p>Hello ${recipientName},</p>
        <p>You have been assigned a task in project <strong>${projectName}</strong>:</p>
        <ul>
          <li><strong>Title:</strong> ${taskTitle}</li>
          <li><strong>Description:</strong> ${taskDescription}</li>
          <li><strong>Assigned by:</strong> ${assignedByName}</li>
          ${dueDate ? `<li><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</li>` : ''}
        </ul>
        <p>Please review and start working on this task.</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['task', 'assignment'],
      });
    } catch (error) {
      this.logger.error('Failed to send task assignment notification', error as Error);
      throw error;
    }
  }

  /**
   * Send task completion notification
   */
  async sendTaskCompletionNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    projectName: string,
    completedByName: string,
    completedAt: Date
  ): Promise<boolean> {
    try {
      const subject = `Task Completed: ${taskTitle}`;
      const html = `
        <h2>Task Completed</h2>
        <p>Hello ${recipientName},</p>
        <p>A task has been completed in project <strong>${projectName}</strong>:</p>
        <ul>
          <li><strong>Title:</strong> ${taskTitle}</li>
          <li><strong>Completed by:</strong> ${completedByName}</li>
          <li><strong>Completed at:</strong> ${completedAt.toLocaleDateString()}</li>
        </ul>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['task', 'completion'],
      });
    } catch (error) {
      this.logger.error('Failed to send task completion notification', error as Error);
      throw error;
    }
  }

  /**
   * Send project member welcome notification
   */
  async sendProjectMemberWelcome(
    recipientEmail: string,
    recipientName: string,
    projectName: string,
    projectDescription: string,
    addedByName: string,
    role: string
  ): Promise<boolean> {
    try {
      const subject = `Welcome to Project: ${projectName}`;
      const html = `
        <h2>Welcome to the Project</h2>
        <p>Hello ${recipientName},</p>
        <p>You have been added to project <strong>${projectName}</strong> by ${addedByName}.</p>
        <ul>
          <li><strong>Project:</strong> ${projectName}</li>
          <li><strong>Description:</strong> ${projectDescription}</li>
          <li><strong>Your Role:</strong> ${role}</li>
        </ul>
        <p>Welcome to the team!</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['project', 'welcome'],
      });
    } catch (error) {
      this.logger.error('Failed to send project member welcome', error as Error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(recipientEmail: string, recipientName: string): Promise<boolean> {
    try {
      const subject = 'Welcome to Task Management System';
      const html = `
        <h2>Welcome!</h2>
        <p>Hello ${recipientName},</p>
        <p>Welcome to our Task Management System! Your account has been successfully created.</p>
        <p>You can now start creating projects, managing tasks, and collaborating with your team.</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['welcome', 'registration'],
      });
    } catch (error) {
      this.logger.error('Failed to send welcome email', error as Error);
      throw error;
    }
  }

  /**
   * Send task start notification
   */
  async sendTaskStartNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    projectName: string,
    startedByName: string,
    startedAt: Date
  ): Promise<boolean> {
    try {
      const subject = `Task Started: ${taskTitle}`;
      const html = `
        <h2>Task Started</h2>
        <p>Hello ${recipientName},</p>
        <p>Work has started on a task in project <strong>${projectName}</strong>:</p>
        <ul>
          <li><strong>Title:</strong> ${taskTitle}</li>
          <li><strong>Started by:</strong> ${startedByName}</li>
          <li><strong>Started at:</strong> ${startedAt.toLocaleDateString()}</li>
        </ul>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['task', 'start'],
      });
    } catch (error) {
      this.logger.error('Failed to send task start notification', error as Error);
      throw error;
    }
  }

  /**
   * Send calendar invitation email
   */
  async sendCalendarInvitation(data: {
    recipientEmail: string;
    recipientName: string;
    eventTitle: string;
    eventDescription?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    organizerName: string;
  }): Promise<boolean> {
    try {
      const subject = `Calendar Invitation: ${data.eventTitle}`;
      const locationText = data.location
        ? `<li><strong>Location:</strong> ${data.location}</li>`
        : '';

      const html = `
        <h2>Calendar Invitation</h2>
        <p>Hello ${data.recipientName},</p>
        <p>You have been invited to the following calendar event:</p>
        <ul>
          <li><strong>Title:</strong> ${data.eventTitle}</li>
          <li><strong>Description:</strong> ${data.eventDescription || 'No description provided'}</li>
          <li><strong>Start Time:</strong> ${data.startTime.toLocaleString()}</li>
          <li><strong>End Time:</strong> ${data.endTime.toLocaleString()}</li>
          ${locationText}
        </ul>
        <p>Please mark your calendar and join us for this event.</p>
        <p>Best regards,<br>${data.organizerName}</p>
      `;

      const text = `
Calendar Invitation: ${data.eventTitle}

Hello ${data.recipientName},

You have been invited to the following calendar event:

Title: ${data.eventTitle}
Description: ${data.eventDescription || 'No description provided'}
Start Time: ${data.startTime.toLocaleString()}
End Time: ${data.endTime.toLocaleString()}
${data.location ? `Location: ${data.location}` : ''}

Please mark your calendar and join us for this event.

Best regards,
${data.organizerName}
      `.trim();

      return this.sendEmail({
        to: data.recipientEmail,
        subject,
        html,
        text,
        priority: 'normal',
        tags: ['calendar', 'invitation'],
        metadata: {
          type: 'calendar_invitation',
          eventTitle: data.eventTitle,
          startTime: data.startTime.toISOString(),
          endTime: data.endTime.toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send calendar invitation', error as Error);
      throw error;
    }
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(data: {
    recipientEmail: string;
    recipientName: string;
    verificationUrl: string;
  }): Promise<boolean> {
    try {
      const subject = 'Verify Your Email Address';

      const html = `
        <h2>Email Verification</h2>
        <p>Hello ${data.recipientName},</p>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="${data.verificationUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${data.verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      const text = `
Email Verification

Hello ${data.recipientName},

Please visit the following link to verify your email address:
${data.verificationUrl}

This link will expire in 24 hours.

Best regards,
Task Management Team
      `.trim();

      return this.sendEmail({
        to: data.recipientEmail,
        subject,
        html,
        text,
        priority: 'high',
        tags: ['authentication', 'verification'],
        metadata: {
          type: 'email_verification',
          recipientEmail: data.recipientEmail,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send email verification', error as Error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(data: {
    recipientEmail: string;
    recipientName: string;
    resetUrl: string;
  }): Promise<boolean> {
    try {
      const subject = 'Password Reset Request';

      const html = `
        <h2>Password Reset</h2>
        <p>Hello ${data.recipientName},</p>
        <p>You have requested to reset your password. Please click the link below to set a new password:</p>
        <p><a href="${data.resetUrl}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${data.resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      const text = `
Password Reset

Hello ${data.recipientName},

You have requested to reset your password. Please visit the following link to set a new password:
${data.resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email.

Best regards,
Task Management Team
      `.trim();

      return this.sendEmail({
        to: data.recipientEmail,
        subject,
        html,
        text,
        priority: 'high',
        tags: ['authentication', 'password-reset'],
        metadata: {
          type: 'password_reset',
          recipientEmail: data.recipientEmail,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email', error as Error);
      throw error;
    }
  }

  /**
   * Send user activation confirmation
   */
  async sendUserActivationConfirmation(
    recipientEmail: string,
    recipientName: string
  ): Promise<boolean> {
    try {
      const subject = 'Account Activated Successfully';
      const html = `
        <h2>Account Activated</h2>
        <p>Hello ${recipientName},</p>
        <p>Your account has been successfully activated!</p>
        <p>You now have full access to all features of the Task Management System.</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['activation', 'confirmation'],
      });
    } catch (error) {
      this.logger.error('Failed to send user activation confirmation', error as Error);
      throw error;
    }
  }

  /**
   * Send task created notification
   */
  async sendTaskCreatedNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    projectName: string,
    taskDescription: string,
    taskPriority: string
  ): Promise<boolean> {
    try {
      const subject = `New Task Created: ${taskTitle}`;
      const html = `
        <h2>New Task Created</h2>
        <p>Hello ${recipientName},</p>
        <p>A new task has been created in project "${projectName}":</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3>${taskTitle}</h3>
          <p><strong>Description:</strong> ${taskDescription}</p>
          <p><strong>Priority:</strong> ${taskPriority}</p>
          <p><strong>Project:</strong> ${projectName}</p>
        </div>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: taskPriority === 'HIGH' ? 'high' : 'normal',
        tags: ['task', 'created', 'notification'],
      });
    } catch (error) {
      this.logger.error('Failed to send task created notification', error as Error);
      throw error;
    }
  }

  /**
   * Send task assigned notification
   */
  async sendTaskAssignedNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    projectName: string,
    taskDescription: string,
    taskPriority: string
  ): Promise<boolean> {
    try {
      const subject = `Task Assigned: ${taskTitle}`;
      const html = `
        <h2>Task Assigned to You</h2>
        <p>Hello ${recipientName},</p>
        <p>You have been assigned a new task in project "${projectName}":</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3>${taskTitle}</h3>
          <p><strong>Description:</strong> ${taskDescription}</p>
          <p><strong>Priority:</strong> ${taskPriority}</p>
          <p><strong>Project:</strong> ${projectName}</p>
        </div>
        <p>Please log in to view the full details and start working on this task.</p>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: taskPriority === 'HIGH' ? 'high' : 'normal',
        tags: ['task', 'assigned', 'notification'],
      });
    } catch (error) {
      this.logger.error('Failed to send task assigned notification', error as Error);
      throw error;
    }
  }

  /**
   * Send task completed notification
   */
  async sendTaskCompletedNotification(
    recipientEmail: string,
    recipientName: string,
    taskTitle: string,
    projectName: string,
    taskDescription: string,
    completedAt: Date
  ): Promise<boolean> {
    try {
      const subject = `Task Completed: ${taskTitle}`;
      const html = `
        <h2>Task Completed</h2>
        <p>Hello ${recipientName},</p>
        <p>A task has been completed in project "${projectName}":</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3>${taskTitle}</h3>
          <p><strong>Description:</strong> ${taskDescription}</p>
          <p><strong>Project:</strong> ${projectName}</p>
          <p><strong>Completed:</strong> ${completedAt.toLocaleDateString()}</p>
        </div>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'normal',
        tags: ['task', 'completed', 'notification'],
      });
    } catch (error) {
      this.logger.error('Failed to send task completed notification', error as Error);
      throw error;
    }
  }

  /**
   * Send daily digest
   */
  async sendDailyDigest(
    recipientEmail: string,
    recipientName: string,
    digest: any
  ): Promise<boolean> {
    try {
      const subject = 'Daily Task Digest';
      const html = `
        <h2>Your Daily Task Digest</h2>
        <p>Hello ${recipientName},</p>
        <p>Here's your daily summary:</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3>Tasks Summary</h3>
          <p><strong>New Tasks:</strong> ${digest.newTasks || 0}</p>
          <p><strong>Completed Tasks:</strong> ${digest.completedTasks || 0}</p>
          <p><strong>Pending Tasks:</strong> ${digest.pendingTasks || 0}</p>
        </div>
        <p>Best regards,<br>Task Management Team</p>
      `;

      return this.sendEmail({
        to: recipientEmail,
        subject,
        html,
        priority: 'low',
        tags: ['digest', 'daily', 'summary'],
      });
    } catch (error) {
      this.logger.error('Failed to send daily digest', error as Error);
      throw error;
    }
  }
}
