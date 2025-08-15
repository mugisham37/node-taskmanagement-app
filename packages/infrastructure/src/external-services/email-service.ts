import * as nodemailer from 'nodemailer';
import { DefaultCircuitBreaker } from './circuit-breaker';
import {
    EmailService,
    SendEmailData,
    TaskAssignmentTemplateData,
    TaskReminderTemplateData,
    UserActivationTemplateData,
    WorkspaceInvitationData
} from './interfaces';

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

export interface EmailQueueItem {
  id: string;
  data: SendEmailData;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastError?: string;
}

export class NodemailerEmailService implements EmailService {
  readonly name = 'email-service';
  private transporter!: nodemailer.Transporter;
  private emailQueue: EmailQueueItem[] = [];
  private isProcessing = false;
  private circuitBreaker: DefaultCircuitBreaker;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private readonly config: EmailConfig) {
    this.initializeTransporter();
    this.circuitBreaker = new DefaultCircuitBreaker('email-service', {
      failureThreshold: 5,
      recoveryTimeout: 300000,
      monitoringPeriod: 600000,
    });
    this.startQueueProcessor();
  }

  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransporter({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.auth,
    });
  }

  async sendEmail(data: SendEmailData): Promise<boolean> {
    this.validateMessage(data);

    return await this.circuitBreaker.execute(async () => {
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

      await this.transporter.sendMail(mailOptions);
      return true;
    });
  }

  async queueEmail(data: SendEmailData, scheduledAt?: Date): Promise<string> {
    const emailId = this.generateId();
    const queueItem: EmailQueueItem = {
      id: emailId,
      data,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      ...(scheduledAt && { scheduledAt }),
    };

    this.emailQueue.push(queueItem);
    return emailId;
  }

  async sendTaskAssignmentEmail(
    assigneeEmail: string,
    data: TaskAssignmentTemplateData
  ): Promise<boolean> {
    const html = `
      <h2>New Task Assigned</h2>
      <p>Hello ${data.assigneeName},</p>
      <p>You have been assigned a new task: <strong>${data.taskTitle}</strong></p>
      <p><strong>Project:</strong> ${data.projectName}</p>
      <p><strong>Description:</strong> ${data.taskDescription}</p>
      ${data.dueDate ? `<p><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</p>` : ''}
      <p><strong>Assigned by:</strong> ${data.assignedByName}</p>
      <p>Best regards,<br>Task Management Team</p>
    `;

    return this.sendEmail({
      to: assigneeEmail,
      subject: `New Task Assigned: ${data.taskTitle}`,
      html,
      priority: 'normal',
      tags: ['task', 'assignment'],
    });
  }

  async sendTaskReminderEmail(
    recipientEmail: string,
    data: TaskReminderTemplateData
  ): Promise<boolean> {
    const html = `
      <h2>Task Reminder</h2>
      <p>Hello ${data.recipientName},</p>
      <p>This is a reminder about the task: <strong>${data.taskTitle}</strong></p>
      <p><strong>Project:</strong> ${data.projectName}</p>
      <p><strong>Description:</strong> ${data.taskDescription}</p>
      ${data.dueDate ? `<p><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</p>` : ''}
      <p><strong>Created by:</strong> ${data.creatorName}</p>
      <p>Best regards,<br>Task Management Team</p>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Reminder: ${data.taskTitle}`,
      html,
      priority: 'normal',
      tags: ['task', 'reminder'],
    });
  }

  async sendUserActivationEmail(
    userEmail: string,
    data: UserActivationTemplateData
  ): Promise<boolean> {
    const html = `
      <h2>Activate Your Account</h2>
      <p>Hello ${data.userName},</p>
      <p>Welcome to Task Management System! Please activate your account.</p>
      ${data.activationLink ? `<p><a href="${data.activationLink}">Activate Account</a></p>` : ''}
      <p>Best regards,<br>Task Management Team</p>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Activate Your Account',
      html,
      priority: 'normal',
      tags: ['activation', 'welcome'],
    });
  }

  async sendWorkspaceInvitation(data: WorkspaceInvitationData): Promise<boolean> {
    const html = `
      <h2>Workspace Invitation</h2>
      <p>Hello,</p>
      <p>${data.inviterName} has invited you to join the "${data.workspaceName}" workspace.</p>
      <p><a href="${data.invitationLink}">Accept Invitation</a></p>
      <p>Best regards,<br>Task Management Team</p>
    `;

    return this.sendEmail({
      to: data.recipientEmail,
      subject: `Invitation to join ${data.workspaceName}`,
      html,
      priority: 'normal',
      tags: ['workspace', 'invitation'],
    });
  }

  async sendTwoFactorCode(
    email: string,
    code: string,
    expirationMinutes: number = 10
  ): Promise<void> {
    const html = `
      <h2>Two-Factor Authentication Code</h2>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in ${expirationMinutes} minutes.</p>
      <p>If you didn't request this code, please secure your account immediately.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Your Two-Factor Authentication Code',
      html,
      priority: 'high',
      tags: ['2fa', 'security'],
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const isHealthy = await this.isHealthy();
    return {
      smtp: {
        healthy: isHealthy,
        circuitBreakerState: this.circuitBreaker.getStats().state,
      },
      queue: {
        size: this.emailQueue.length,
        processing: this.isProcessing,
      },
    };
  }

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
          this.emailQueue = this.emailQueue.filter(queueItem => queueItem.id !== item.id);
        } catch (error) {
          item.attempts++;
          item.lastError = error instanceof Error ? error.message : 'Unknown error';

          if (item.attempts >= item.maxAttempts) {
            this.emailQueue = this.emailQueue.filter(
              queueItem => queueItem.id !== item.id
            );
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private startQueueProcessor(): void {
    this.cleanupInterval = setInterval(() => {
      this.processQueue();
    }, 30000); // Process queue every 30 seconds
  }

  private generateId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateMessage(message: SendEmailData): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      throw new Error('Email message must have at least one recipient');
    }

    if (!message.subject || (!message.html && !message.text)) {
      throw new Error('Email message must have a subject and content');
    }

    // Validate email addresses
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
  }

  private normalizeRecipients(recipients: string | string[]): string[] {
    return Array.isArray(recipients) ? recipients : [recipients];
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.circuitBreaker.destroy();
  }
}