import { BaseService, ServiceContext, ValidationError } from './base.service';
import { userRepository, invitationRepository, teamRepository, taskRepository } from '../db/repositories';

export interface EmailConfig {
  service: string;
  user: string;
  password: string;
  from: string;
  appName: string;
  frontendUrl: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService extends BaseService {
  private config: EmailConfig;

  constructor() {
    super('EmailService', {
      enableCache: false,
      enableAudit: true,
      enableMetrics: true
    });

    this.config = {
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASSWORD || '',
      from: process.env.EMAIL_FROM || 'noreply@taskmanagement.com',
      appName: process.env.APP_NAME || 'Task Management',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };
  }

  /**
   * Send an email
   */
  async sendEmail(data: EmailData, context?: ServiceContext): Promise<boolean> {
    const ctx = this.createContext(context);
    this.logOperation('sendEmail', ctx, { to: data.to, subject: data.subject });

    try {
      this.validateEmailData(data);

      // In a real implementation, this would use nodemailer or similar
      console.log(`[EMAIL] Sending email to ${data.to}`);
      console.log(`[EMAIL] Subject: ${data.subject}`);
      console.log(`[EMAIL] HTML: ${data.html.substring(0, 100)}...`);

      await this.recordMetric('email.sent', 1, { 
        to: data.to.split('@')[1], // Domain only for privacy
        subject_length: data.subject.length.toString()
      });

      return true;
    } catch (error) {
      this.handleError(error, 'sendEmail', ctx);
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(to: string, token: string, context?: ServiceContext): Promise<boolean> {
    const verificationUrl = `${this.config.frontendUrl}/verify-email?token=${token}`;
    const subject = `${this.config.appName} - Verify Your Email`;
    const html = this.generateVerificationEmailHtml(verificationUrl);

    return this.sendEmail({ to, subject, html }, context);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, token: string, context?: ServiceContext): Promise<boolean> {
    const resetUrl = `${this.config.frontendUrl}/reset-password?token=${token}`;
    const subject = `${this.config.appName} - Reset Your Password`;
    const html = this.generatePasswordResetEmailHtml(resetUrl);

    return this.sendEmail({ to, subject, html }, context);
  }

  /**
   * Send team invitation email
   */
  async sendInvitationEmail(invitationId: string, context?: ServiceContext): Promise<boolean> {
    const ctx = this.createContext(context);
    this.logOperation('sendInvitationEmail', ctx, { invitationId });

    try {
      const invitation = await invitationRepository.findById(invitationId);
      if (!invitation) {
        throw new ValidationError('Invitation not found');
      }

      const team = await teamRepository.findById(invitation.teamId!);
      if (!team) {
        throw new ValidationError('Team not found');
      }

      const inviter = await userRepository.findById(invitation.invitedById);
      if (!inviter) {
        throw new ValidationError('Inviter not found');
      }

      const invitationUrl = `${this.config.frontendUrl}/invitations/${invitation.token}`;
      const subject = `${this.config.appName} - You've Been Invited to Join ${team.name}`;
      const html = this.generateInvitationEmailHtml(team.name, inviter.firstName || 'Someone', invitationUrl);

      return this.sendEmail({ to: invitation.email, subject, html }, context);
    } catch (error) {
      this.handleError(error, 'sendInvitationEmail', ctx);
    }
  }

  /**
   * Send task assignment notification email
   */
  async sendTaskAssignmentEmail(
    userId: string,
    taskId: string,
    assignerId: string,
    context?: ServiceContext
  ): Promise<boolean> {
    const ctx = this.createContext(context);
    this.logOperation('sendTaskAssignmentEmail', ctx, { userId, taskId, assignerId });

    try {
      const [user, task, assigner] = await Promise.all([
        userRepository.findById(userId),
        taskRepository.findById(taskId),
        userRepository.findById(assignerId)
      ]);

      if (!user || !task || !assigner) {
        throw new ValidationError('User, task, or assigner not found');
      }

      const taskUrl = `${this.config.frontendUrl}/tasks/${taskId}`;
      const subject = `${this.config.appName} - New Task Assignment`;
      const html = this.generateTaskAssignmentEmailHtml(
        task.title,
        assigner.firstName,
        taskUrl
      );

      return this.sendEmail({ to: user.email, subject, html }, context);
    } catch (error) {
      this.handleError(error, 'sendTaskAssignmentEmail', ctx);
    }
  }

  /**
   * Send task due date reminder email
   */
  async sendTaskDueDateReminderEmail(
    userId: string,
    taskId: string,
    context?: ServiceContext
  ): Promise<boolean> {
    const ctx = this.createContext(context);
    this.logOperation('sendTaskDueDateReminderEmail', ctx, { userId, taskId });

    try {
      const [user, task] = await Promise.all([
        userRepository.findById(userId),
        taskRepository.findById(taskId)
      ]);

      if (!user || !task) {
        throw new ValidationError('User or task not found');
      }

      const taskUrl = `${this.config.frontendUrl}/tasks/${taskId}`;
      const subject = `${this.config.appName} - Task Due Soon`;
      const html = this.generateTaskReminderEmailHtml(task.title, task.dueDate, taskUrl);

      return this.sendEmail({ to: user.email, subject, html }, context);
    } catch (error) {
      this.handleError(error, 'sendTaskDueDateReminderEmail', ctx);
    }
  }

  // Private Helper Methods
  private validateEmailData(data: EmailData): void {
    if (!data.to || !data.to.includes('@')) {
      throw new ValidationError('Valid recipient email is required');
    }

    if (!data.subject || data.subject.trim().length === 0) {
      throw new ValidationError('Email subject is required');
    }

    if (!data.html || data.html.trim().length === 0) {
      throw new ValidationError('Email content is required');
    }
  }

  private generateVerificationEmailHtml(verificationUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Verify Your Email Address</h2>
        <p>Thank you for registering with ${this.config.appName}. Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
        </div>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 14px;">© ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.</p>
      </div>
    `;
  }

  private generatePasswordResetEmailHtml(resetUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Reset Your Password</h2>
        <p>You requested a password reset for your ${this.config.appName} account. Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 14px;">© ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.</p>
      </div>
    `;
  }

  private generateInvitationEmailHtml(teamName: string, inviterName: string, invitationUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Team Invitation</h2>
        <p>${inviterName} has invited you to join the team "${teamName}" on ${this.config.appName}.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
        </div>
        <p>If you already have an account, you'll be able to join the team after logging in. If not, you'll be prompted to create an account.</p>
        <p>This invitation will expire in 7 days.</p>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${invitationUrl}</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 14px;">© ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.</p>
      </div>
    `;
  }

  private generateTaskAssignmentEmailHtml(taskTitle: string, assignerName: string, taskUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">New Task Assignment</h2>
        <p>${assignerName} has assigned you a task on ${this.config.appName}.</p>
        <p><strong>Task:</strong> ${taskTitle}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${taskUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Task</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${taskUrl}</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 14px;">© ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.</p>
      </div>
    `;
  }

  private generateTaskReminderEmailHtml(taskTitle: string, dueDate: Date | null, taskUrl: string): string {
    const dueDateStr = dueDate ? dueDate.toLocaleDateString() : 'soon';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Task Due Soon</h2>
        <p>This is a reminder that you have a task due ${dueDateStr} on ${this.config.appName}.</p>
        <p><strong>Task:</strong> ${taskTitle}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${taskUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Task</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${taskUrl}</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 14px;">© ${new Date().getFullYear()} ${this.config.appName}. All rights reserved.</p>
      </div>
    `;
  }
}

// Export singleton instance
export const emailService = new EmailService();
