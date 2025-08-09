import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
  replyTo?: string;
  maxConnections?: number;
  maxMessages?: number;
  rateDelta?: number;
  rateLimit?: number;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

export interface EmailQueueItem {
  id: string;
  data: SendEmailData;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastAttemptAt?: Date;
  error?: string;
}

export class EmailService {
  private transporter: Transporter;
  private queue: EmailQueueItem[] = [];
  private isProcessingQueue = false;
  private queueProcessingInterval: NodeJS.Timeout | null = null;

  constructor(private readonly config: EmailConfig) {
    this.initializeTransporter();
    this.startQueueProcessor();
  }

  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransporter({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        maxConnections: this.config.maxConnections || 5,
        maxMessages: this.config.maxMessages || 100,
        rateDelta: this.config.rateDelta || 1000,
        rateLimit: this.config.rateLimit || 10,
        pool: true,
      });

      // Verify connection configuration
      this.transporter.verify(error => {
        if (error) {
          console.error('Email service configuration error:', error);
        } else {
          console.log('Email service is ready to send messages');
        }
      });
    } catch (error) {
      throw new InfrastructureError(
        `Failed to initialize email service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send email immediately
   */
  async sendEmail(data: SendEmailData): Promise<void> {
    try {
      const mailOptions: SendMailOptions = {
        from: `${this.config.from.name} <${this.config.from.address}>`,
        to: Array.isArray(data.to) ? data.to.join(', ') : data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
        cc: data.cc
          ? Array.isArray(data.cc)
            ? data.cc.join(', ')
            : data.cc
          : undefined,
        bcc: data.bcc
          ? Array.isArray(data.bcc)
            ? data.bcc.join(', ')
            : data.bcc
          : undefined,
        replyTo: this.config.replyTo,
        priority: data.priority || 'normal',
        headers: data.headers,
        attachments: data.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Queue email for later delivery
   */
  async queueEmail(
    data: SendEmailData,
    scheduledAt?: Date,
    maxAttempts: number = 3
  ): Promise<string> {
    const emailId = this.generateEmailId();

    const queueItem: EmailQueueItem = {
      id: emailId,
      data,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
      scheduledAt,
    };

    this.queue.push(queueItem);
    console.log(`Email queued with ID: ${emailId}`);

    return emailId;
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentNotification(
    assigneeEmail: string,
    assigneeName: string,
    taskTitle: string,
    taskDescription: string,
    projectName: string,
    assignedByName: string,
    dueDate?: Date
  ): Promise<void> {
    const template = this.getTaskAssignmentTemplate({
      assigneeName,
      taskTitle,
      taskDescription,
      projectName,
      assignedByName,
      dueDate,
    });

    await this.sendEmail({
      to: assigneeEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: 'normal',
    });
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
  ): Promise<void> {
    const template = this.getTaskCompletionTemplate({
      recipientName,
      taskTitle,
      projectName,
      completedByName,
      completedAt,
    });

    await this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: 'normal',
    });
  }

  /**
   * Send project invitation notification
   */
  async sendProjectInvitationNotification(
    inviteeEmail: string,
    inviteeName: string,
    projectName: string,
    invitedByName: string,
    role: string,
    invitationLink: string
  ): Promise<void> {
    const template = this.getProjectInvitationTemplate({
      inviteeName,
      projectName,
      invitedByName,
      role,
      invitationLink,
    });

    await this.sendEmail({
      to: inviteeEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: 'high',
    });
  }

  /**
   * Send password reset notification
   */
  async sendPasswordResetNotification(
    userEmail: string,
    userName: string,
    resetLink: string,
    expiresAt: Date
  ): Promise<void> {
    const template = this.getPasswordResetTemplate({
      userName,
      resetLink,
      expiresAt,
    });

    await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: 'high',
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    activationLink?: string
  ): Promise<void> {
    const template = this.getWelcomeTemplate({
      userName,
      activationLink,
    });

    await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: 'normal',
    });
  }

  /**
   * Send daily digest email
   */
  async sendDailyDigest(
    userEmail: string,
    userName: string,
    digestData: {
      tasksCompleted: number;
      tasksAssigned: number;
      projectUpdates: number;
      upcomingDeadlines: Array<{
        taskTitle: string;
        dueDate: Date;
        projectName: string;
      }>;
    }
  ): Promise<void> {
    const template = this.getDailyDigestTemplate({
      userName,
      ...digestData,
    });

    await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      priority: 'low',
    });
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const now = new Date();
      const itemsToProcess = this.queue.filter(
        item => !item.scheduledAt || item.scheduledAt <= now
      );

      for (const item of itemsToProcess) {
        try {
          await this.sendEmail(item.data);

          // Remove successfully sent email from queue
          this.queue = this.queue.filter(queueItem => queueItem.id !== item.id);
          console.log(
            `Email ${item.id} sent successfully and removed from queue`
          );
        } catch (error) {
          item.attempts++;
          item.lastAttemptAt = now;
          item.error = error instanceof Error ? error.message : 'Unknown error';

          if (item.attempts >= item.maxAttempts) {
            // Remove failed email after max attempts
            this.queue = this.queue.filter(
              queueItem => queueItem.id !== item.id
            );
            console.error(
              `Email ${item.id} failed after ${item.maxAttempts} attempts:`,
              item.error
            );
          } else {
            console.warn(
              `Email ${item.id} failed (attempt ${item.attempts}/${item.maxAttempts}):`,
              item.error
            );
          }
        }
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    this.queueProcessingInterval = setInterval(() => {
      this.processQueue();
    }, 30000); // Process queue every 30 seconds
  }

  /**
   * Stop queue processor
   */
  stopQueueProcessor(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalItems: number;
    pendingItems: number;
    failedItems: number;
  } {
    const now = new Date();
    const pendingItems = this.queue.filter(
      item => !item.scheduledAt || item.scheduledAt <= now
    ).length;

    const failedItems = this.queue.filter(
      item => item.attempts > 0 && item.attempts < item.maxAttempts
    ).length;

    return {
      totalItems: this.queue.length,
      pendingItems,
      failedItems,
    };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Close email service
   */
  async close(): Promise<void> {
    this.stopQueueProcessor();

    if (this.transporter) {
      this.transporter.close();
    }
  }

  // Template methods
  private getTaskAssignmentTemplate(data: {
    assigneeName: string;
    taskTitle: string;
    taskDescription: string;
    projectName: string;
    assignedByName: string;
    dueDate?: Date;
  }): EmailTemplate {
    const dueDateText = data.dueDate
      ? `Due: ${data.dueDate.toLocaleDateString()}`
      : 'No due date set';

    return {
      subject: `New Task Assigned: ${data.taskTitle}`,
      html: `
        <h2>New Task Assignment</h2>
        <p>Hello ${data.assigneeName},</p>
        <p>You have been assigned a new task by ${data.assignedByName}.</p>
        
        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>${data.taskTitle}</h3>
          <p><strong>Project:</strong> ${data.projectName}</p>
          <p><strong>Description:</strong> ${data.taskDescription}</p>
          <p><strong>${dueDateText}</strong></p>
        </div>
        
        <p>Please log in to your dashboard to view more details and start working on this task.</p>
        <p>Best regards,<br>Task Management Team</p>
      `,
      text: `
        New Task Assignment
        
        Hello ${data.assigneeName},
        
        You have been assigned a new task by ${data.assignedByName}.
        
        Task: ${data.taskTitle}
        Project: ${data.projectName}
        Description: ${data.taskDescription}
        ${dueDateText}
        
        Please log in to your dashboard to view more details and start working on this task.
        
        Best regards,
        Task Management Team
      `,
    };
  }

  private getTaskCompletionTemplate(data: {
    recipientName: string;
    taskTitle: string;
    projectName: string;
    completedByName: string;
    completedAt: Date;
  }): EmailTemplate {
    return {
      subject: `Task Completed: ${data.taskTitle}`,
      html: `
        <h2>Task Completed</h2>
        <p>Hello ${data.recipientName},</p>
        <p>A task has been completed by ${data.completedByName}.</p>
        
        <div style="background: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>${data.taskTitle}</h3>
          <p><strong>Project:</strong> ${data.projectName}</p>
          <p><strong>Completed by:</strong> ${data.completedByName}</p>
          <p><strong>Completed at:</strong> ${data.completedAt.toLocaleString()}</p>
        </div>
        
        <p>You can view the completed task details in your dashboard.</p>
        <p>Best regards,<br>Task Management Team</p>
      `,
      text: `
        Task Completed
        
        Hello ${data.recipientName},
        
        A task has been completed by ${data.completedByName}.
        
        Task: ${data.taskTitle}
        Project: ${data.projectName}
        Completed by: ${data.completedByName}
        Completed at: ${data.completedAt.toLocaleString()}
        
        You can view the completed task details in your dashboard.
        
        Best regards,
        Task Management Team
      `,
    };
  }

  private getProjectInvitationTemplate(data: {
    inviteeName: string;
    projectName: string;
    invitedByName: string;
    role: string;
    invitationLink: string;
  }): EmailTemplate {
    return {
      subject: `Project Invitation: ${data.projectName}`,
      html: `
        <h2>Project Invitation</h2>
        <p>Hello ${data.inviteeName},</p>
        <p>${data.invitedByName} has invited you to join the project "${data.projectName}" as a ${data.role}.</p>
        
        <div style="background: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Project:</strong> ${data.projectName}</p>
          <p><strong>Role:</strong> ${data.role}</p>
          <p><strong>Invited by:</strong> ${data.invitedByName}</p>
        </div>
        
        <p><a href="${data.invitationLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
        
        <p>If you cannot click the button, copy and paste this link into your browser:</p>
        <p>${data.invitationLink}</p>
        
        <p>Best regards,<br>Task Management Team</p>
      `,
      text: `
        Project Invitation
        
        Hello ${data.inviteeName},
        
        ${data.invitedByName} has invited you to join the project "${data.projectName}" as a ${data.role}.
        
        Project: ${data.projectName}
        Role: ${data.role}
        Invited by: ${data.invitedByName}
        
        To accept this invitation, please visit: ${data.invitationLink}
        
        Best regards,
        Task Management Team
      `,
    };
  }

  private getPasswordResetTemplate(data: {
    userName: string;
    resetLink: string;
    expiresAt: Date;
  }): EmailTemplate {
    return {
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${data.userName},</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        
        <p><a href="${data.resetLink}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        
        <p>If you cannot click the button, copy and paste this link into your browser:</p>
        <p>${data.resetLink}</p>
        
        <p><strong>This link will expire at ${data.expiresAt.toLocaleString()}</strong></p>
        
        <p>If you didn't request this password reset, please ignore this email.</p>
        
        <p>Best regards,<br>Task Management Team</p>
      `,
      text: `
        Password Reset Request
        
        Hello ${data.userName},
        
        We received a request to reset your password. Please visit the following link to reset it:
        
        ${data.resetLink}
        
        This link will expire at ${data.expiresAt.toLocaleString()}
        
        If you didn't request this password reset, please ignore this email.
        
        Best regards,
        Task Management Team
      `,
    };
  }

  private getWelcomeTemplate(data: {
    userName: string;
    activationLink?: string;
  }): EmailTemplate {
    const activationSection = data.activationLink
      ? `
        <p>To get started, please activate your account by clicking the button below:</p>
        <p><a href="${data.activationLink}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activate Account</a></p>
        <p>If you cannot click the button, copy and paste this link into your browser:</p>
        <p>${data.activationLink}</p>
      `
      : '<p>Your account is ready to use. You can log in to your dashboard now.</p>';

    return {
      subject: 'Welcome to Task Management System',
      html: `
        <h2>Welcome to Task Management System!</h2>
        <p>Hello ${data.userName},</p>
        <p>Welcome to our task management platform! We're excited to have you on board.</p>
        
        ${activationSection}
        
        <p>Once you're logged in, you can:</p>
        <ul>
          <li>Create and manage tasks</li>
          <li>Collaborate with team members</li>
          <li>Track project progress</li>
          <li>Organize your workspace</li>
        </ul>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        
        <p>Best regards,<br>Task Management Team</p>
      `,
      text: `
        Welcome to Task Management System!
        
        Hello ${data.userName},
        
        Welcome to our task management platform! We're excited to have you on board.
        
        ${data.activationLink ? `To get started, please activate your account by visiting: ${data.activationLink}` : 'Your account is ready to use. You can log in to your dashboard now.'}
        
        Once you're logged in, you can:
        - Create and manage tasks
        - Collaborate with team members
        - Track project progress
        - Organize your workspace
        
        If you have any questions, feel free to reach out to our support team.
        
        Best regards,
        Task Management Team
      `,
    };
  }

  private getDailyDigestTemplate(data: {
    userName: string;
    tasksCompleted: number;
    tasksAssigned: number;
    projectUpdates: number;
    upcomingDeadlines: Array<{
      taskTitle: string;
      dueDate: Date;
      projectName: string;
    }>;
  }): EmailTemplate {
    const deadlinesList = data.upcomingDeadlines
      .map(
        item =>
          `<li>${item.taskTitle} (${item.projectName}) - Due: ${item.dueDate.toLocaleDateString()}</li>`
      )
      .join('');

    return {
      subject: 'Daily Activity Digest',
      html: `
        <h2>Daily Activity Digest</h2>
        <p>Hello ${data.userName},</p>
        <p>Here's your daily activity summary:</p>
        
        <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Today's Activity</h3>
          <ul>
            <li><strong>Tasks Completed:</strong> ${data.tasksCompleted}</li>
            <li><strong>New Tasks Assigned:</strong> ${data.tasksAssigned}</li>
            <li><strong>Project Updates:</strong> ${data.projectUpdates}</li>
          </ul>
        </div>
        
        ${
          data.upcomingDeadlines.length > 0
            ? `
          <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3>Upcoming Deadlines</h3>
            <ul>${deadlinesList}</ul>
          </div>
        `
            : ''
        }
        
        <p>Have a productive day!</p>
        <p>Best regards,<br>Task Management Team</p>
      `,
      text: `
        Daily Activity Digest
        
        Hello ${data.userName},
        
        Here's your daily activity summary:
        
        Today's Activity:
        - Tasks Completed: ${data.tasksCompleted}
        - New Tasks Assigned: ${data.tasksAssigned}
        - Project Updates: ${data.projectUpdates}
        
        ${
          data.upcomingDeadlines.length > 0
            ? `
        Upcoming Deadlines:
        ${data.upcomingDeadlines.map(item => `- ${item.taskTitle} (${item.projectName}) - Due: ${item.dueDate.toLocaleDateString()}`).join('\n')}
        `
            : ''
        }
        
        Have a productive day!
        
        Best regards,
        Task Management Team
      `,
    };
  }

  private generateEmailId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
