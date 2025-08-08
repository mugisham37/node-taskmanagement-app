import { Injectable } from '../decorators/injectable';
import { NotificationTemplateEntity } from '../../domain/notification/entities/notification-template.entity';
import { NotificationTemplateRepository } from '../../domain/notification/repositories/notification-template.repository';
import { NotificationType } from '../../domain/notification/value-objects/notification-type';
import { NotificationChannel } from '../../domain/notification/value-objects/notification-channel';
import { Logger } from '../../infrastructure/logging/logger';

export interface EmailTemplateData {
  // User information
  userName?: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;

  // Task information
  taskTitle?: string;
  taskDescription?: string;
  taskDueDate?: string;
  taskPriority?: string;
  taskAssignee?: string;
  taskUrl?: string;

  // Project information
  projectName?: string;
  projectDescription?: string;
  projectUrl?: string;

  // Team information
  teamName?: string;
  inviterName?: string;
  invitationUrl?: string;

  // System information
  appName?: string;
  appUrl?: string;
  supportEmail?: string;
  unsubscribeUrl?: string;

  // Generic data
  [key: string]: any;
}

export interface EmailTemplateService {
  // Template management
  createDefaultEmailTemplates(): Promise<void>;
  getEmailTemplate(
    type: NotificationType
  ): Promise<NotificationTemplateEntity | null>;
  renderEmailTemplate(
    type: NotificationType,
    data: EmailTemplateData
  ): Promise<{ subject: string; html: string; text: string }>;

  // Bulk operations
  renderBulkEmailTemplates(
    templates: Array<{ type: NotificationType; data: EmailTemplateData }>
  ): Promise<Map<string, { subject: string; html: string; text: string }>>;
}

@Injectable()
export class EmailTemplateServiceImpl implements EmailTemplateService {
  constructor(
    private readonly templateRepository: NotificationTemplateRepository,
    private readonly logger: Logger
  ) {}

  async createDefaultEmailTemplates(): Promise<void> {
    this.logger.info('Creating default email templates');

    const defaultTemplates = [
      // Task-related templates
      {
        name: 'Task Assignment Email',
        type: NotificationType.TASK_ASSIGNED,
        subject: '{{appName}} - New Task Assignment: {{taskTitle}}',
        bodyTemplate: this.getTaskAssignmentTemplate(),
        variables: [
          'userName',
          'taskTitle',
          'taskDescription',
          'taskAssignee',
          'taskUrl',
          'appName',
        ],
      },
      {
        name: 'Task Due Soon Email',
        type: NotificationType.TASK_DUE_SOON,
        subject: '{{appName}} - Task Due Soon: {{taskTitle}}',
        bodyTemplate: this.getTaskDueSoonTemplate(),
        variables: [
          'userName',
          'taskTitle',
          'taskDueDate',
          'taskUrl',
          'appName',
        ],
      },
      {
        name: 'Task Overdue Email',
        type: NotificationType.TASK_OVERDUE,
        subject: '{{appName}} - Overdue Task: {{taskTitle}}',
        bodyTemplate: this.getTaskOverdueTemplate(),
        variables: [
          'userName',
          'taskTitle',
          'taskDueDate',
          'taskUrl',
          'appName',
        ],
      },
      {
        name: 'Task Completed Email',
        type: NotificationType.TASK_COMPLETED,
        subject: '{{appName}} - Task Completed: {{taskTitle}}',
        bodyTemplate: this.getTaskCompletedTemplate(),
        variables: ['userName', 'taskTitle', 'taskUrl', 'appName'],
      },
      {
        name: 'Task Comment Email',
        type: NotificationType.TASK_COMMENTED,
        subject: '{{appName}} - New Comment on {{taskTitle}}',
        bodyTemplate: this.getTaskCommentTemplate(),
        variables: [
          'userName',
          'taskTitle',
          'commenterName',
          'commentText',
          'taskUrl',
          'appName',
        ],
      },

      // Project-related templates
      {
        name: 'Project Shared Email',
        type: NotificationType.PROJECT_SHARED,
        subject: '{{appName}} - Project Shared: {{projectName}}',
        bodyTemplate: this.getProjectSharedTemplate(),
        variables: [
          'userName',
          'projectName',
          'sharerName',
          'projectUrl',
          'appName',
        ],
      },

      // Team-related templates
      {
        name: 'Team Invitation Email',
        type: NotificationType.TEAM_INVITATION,
        subject: '{{appName}} - Team Invitation: {{teamName}}',
        bodyTemplate: this.getTeamInvitationTemplate(),
        variables: [
          'userName',
          'teamName',
          'inviterName',
          'invitationUrl',
          'appName',
        ],
      },
      {
        name: 'Workspace Invitation Email',
        type: NotificationType.WORKSPACE_INVITATION,
        subject: '{{appName}} - Workspace Invitation: {{workspaceName}}',
        bodyTemplate: this.getWorkspaceInvitationTemplate(),
        variables: [
          'userName',
          'workspaceName',
          'inviterName',
          'invitationUrl',
          'appName',
        ],
      },

      // System templates
      {
        name: 'System Announcement Email',
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        subject: '{{appName}} - {{announcementTitle}}',
        bodyTemplate: this.getSystemAnnouncementTemplate(),
        variables: [
          'userName',
          'announcementTitle',
          'announcementContent',
          'appName',
        ],
      },
      {
        name: 'Security Alert Email',
        type: NotificationType.SECURITY_ALERT,
        subject: '{{appName}} - Security Alert',
        bodyTemplate: this.getSecurityAlertTemplate(),
        variables: [
          'userName',
          'alertTitle',
          'alertDescription',
          'actionRequired',
          'appName',
        ],
      },

      // Calendar templates
      {
        name: 'Calendar Reminder Email',
        type: NotificationType.CALENDAR_REMINDER,
        subject: '{{appName}} - Reminder: {{eventTitle}}',
        bodyTemplate: this.getCalendarReminderTemplate(),
        variables: [
          'userName',
          'eventTitle',
          'eventDate',
          'eventTime',
          'eventUrl',
          'appName',
        ],
      },
    ];

    for (const templateData of defaultTemplates) {
      try {
        // Check if template already exists
        const existingTemplate =
          await this.templateRepository.findByTypeAndChannel(
            templateData.type,
            NotificationChannel.EMAIL
          );

        if (!existingTemplate) {
          const template = NotificationTemplateEntity.create(
            templateData.name,
            templateData.type,
            NotificationChannel.EMAIL,
            templateData.subject,
            templateData.bodyTemplate,
            templateData.variables
          );

          await this.templateRepository.save(template);

          this.logger.debug('Created default email template', {
            name: templateData.name,
            type: templateData.type.value,
          });
        }
      } catch (error) {
        this.logger.error('Failed to create default email template', {
          name: templateData.name,
          type: templateData.type.value,
          error: error.message,
        });
      }
    }

    this.logger.info('Default email templates creation completed');
  }

  async getEmailTemplate(
    type: NotificationType
  ): Promise<NotificationTemplateEntity | null> {
    return this.templateRepository.findActiveByTypeAndChannel(
      type,
      NotificationChannel.EMAIL
    );
  }

  async renderEmailTemplate(
    type: NotificationType,
    data: EmailTemplateData
  ): Promise<{ subject: string; html: string; text: string }> {
    const template = await this.getEmailTemplate(type);

    if (!template) {
      throw new Error(
        `No email template found for notification type: ${type.value}`
      );
    }

    // Add default data
    const templateData = {
      appName: 'Task Management Platform',
      appUrl: process.env.APP_URL || 'https://app.example.com',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
      unsubscribeUrl:
        process.env.UNSUBSCRIBE_URL || 'https://app.example.com/unsubscribe',
      ...data,
    };

    // Validate required variables
    const missingVariables = template.validateVariables(templateData);
    if (missingVariables.length > 0) {
      this.logger.warn('Missing template variables', {
        type: type.value,
        missingVariables,
      });
    }

    // Render template
    const rendered = template.render(templateData);

    // Convert HTML to text for text version
    const text = this.htmlToText(rendered.body);

    return {
      subject: rendered.subject,
      html: rendered.body,
      text,
    };
  }

  async renderBulkEmailTemplates(
    templates: Array<{ type: NotificationType; data: EmailTemplateData }>
  ): Promise<Map<string, { subject: string; html: string; text: string }>> {
    const results = new Map<
      string,
      { subject: string; html: string; text: string }
    >();

    for (const { type, data } of templates) {
      try {
        const rendered = await this.renderEmailTemplate(type, data);
        results.set(type.value, rendered);
      } catch (error) {
        this.logger.error('Failed to render email template', {
          type: type.value,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Private template methods
  private getTaskAssignmentTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f8f9fa; }
            .task-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Task Assignment</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>You have been assigned a new task:</p>
              
              <div class="task-details">
                <h3>{{taskTitle}}</h3>
                {{#if taskDescription}}
                <p><strong>Description:</strong> {{taskDescription}}</p>
                {{/if}}
                <p><strong>Assigned by:</strong> {{taskAssignee}}</p>
              </div>
              
              {{#if taskUrl}}
              <a href="{{taskUrl}}" class="button">View Task</a>
              {{/if}}
              
              <p>Please review the task details and start working on it at your earliest convenience.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTaskDueSoonTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ffc107; color: #212529; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #fff3cd; }
            .task-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ffc107; color: #212529; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Task Due Soon</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>This is a reminder that your task is due soon:</p>
              
              <div class="task-details">
                <h3>{{taskTitle}}</h3>
                <p><strong>Due Date:</strong> {{taskDueDate}}</p>
              </div>
              
              {{#if taskUrl}}
              <a href="{{taskUrl}}" class="button">View Task</a>
              {{/if}}
              
              <p>Please make sure to complete this task before the due date to avoid any delays.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTaskOverdueTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f8d7da; }
            .task-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Task Overdue</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p><strong>URGENT:</strong> Your task is now overdue:</p>
              
              <div class="task-details">
                <h3>{{taskTitle}}</h3>
                <p><strong>Was Due:</strong> {{taskDueDate}}</p>
              </div>
              
              {{#if taskUrl}}
              <a href="{{taskUrl}}" class="button">Complete Task Now</a>
              {{/if}}
              
              <p>Please complete this task as soon as possible to minimize project delays.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTaskCompletedTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #d4edda; }
            .task-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745; }
            .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Task Completed</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>Congratulations! Your task has been completed:</p>
              
              <div class="task-details">
                <h3>{{taskTitle}}</h3>
              </div>
              
              {{#if taskUrl}}
              <a href="{{taskUrl}}" class="button">View Task</a>
              {{/if}}
              
              <p>Great job on completing this task! Keep up the excellent work.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTaskCommentTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #d1ecf1; }
            .comment-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #17a2b8; }
            .button { display: inline-block; padding: 12px 24px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💬 New Comment</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>{{commenterName}} has added a new comment to your task:</p>
              
              <div class="comment-details">
                <h3>{{taskTitle}}</h3>
                <p><strong>Comment:</strong></p>
                <p>{{commentText}}</p>
              </div>
              
              {{#if taskUrl}}
              <a href="{{taskUrl}}" class="button">View Task & Reply</a>
              {{/if}}
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getProjectSharedTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6f42c1; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #e2d9f3; }
            .project-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #6f42c1; }
            .button { display: inline-block; padding: 12px 24px; background-color: #6f42c1; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"></div>   <h1>📁 Project Shared</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>{{sharerName}} has shared a project with you:</p>
              
              <div class="project-details">
                <h3>{{projectName}}</h3>
              </div>
              
              {{#if projectUrl}}
              <a href="{{projectUrl}}" class="button">View Project</a>
              {{/if}}
              
              <p>You now have access to this project and can collaborate with the team.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getTeamInvitationTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #fd7e14; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #fff3cd; }
            .invitation-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #fd7e14; }
            .button { display: inline-block; padding: 12px 24px; background-color: #fd7e14; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👥 Team Invitation</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>{{inviterName}} has invited you to join the team:</p>
              
              <div class="invitation-details">
                <h3>{{teamName}}</h3>
              </div>
              
              {{#if invitationUrl}}
              <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
              {{/if}}
              
              <p>Click the button above to accept the invitation and start collaborating with your team.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWorkspaceInvitationTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #20c997; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #d1f2eb; }
            .invitation-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #20c997; }
            .button { display: inline-block; padding: 12px 24px; background-color: #20c997; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏢 Workspace Invitation</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>{{inviterName}} has invited you to join the workspace:</p>
              
              <div class="invitation-details">
                <h3>{{workspaceName}}</h3>
              </div>
              
              {{#if invitationUrl}}
              <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
              {{/if}}
              
              <p>Join this workspace to collaborate with your organization and access shared projects.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getSystemAnnouncementTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f8f9fa; }
            .announcement-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #6c757d; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📢 System Announcement</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              
              <div class="announcement-details">
                <h3>{{announcementTitle}}</h3>
                <p>{{announcementContent}}</p>
              </div>
              
              <p>Thank you for your attention.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getSecurityAlertTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f8d7da; }
            .alert-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Security Alert</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p><strong>IMPORTANT SECURITY NOTICE:</strong></p>
              
              <div class="alert-details">
                <h3>{{alertTitle}}</h3>
                <p>{{alertDescription}}</p>
                {{#if actionRequired}}
                <p><strong>Action Required:</strong> {{actionRequired}}</p>
                {{/if}}
              </div>
              
              <p>If you did not initiate this action, please contact our support team immediately at {{supportEmail}}.</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}} for security purposes.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getCalendarReminderTemplate(): string {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #cce5ff; }
            .event-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #007bff; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Calendar Reminder</h1>
            </div>
            <div class="content">
              <p>Hello {{userName}},</p>
              <p>This is a reminder for your upcoming event:</p>
              
              <div class="event-details">
                <h3>{{eventTitle}}</h3>
                <p><strong>Date:</strong> {{eventDate}}</p>
                <p><strong>Time:</strong> {{eventTime}}</p>
              </div>
              
              {{#if eventUrl}}
              <a href="{{eventUrl}}" class="button">View Event Details</a>
              {{/if}}
              
              <p>Don't forget to prepare for this event!</p>
            </div>
            <div class="footer">
              <p>This email was sent by {{appName}}. If you no longer wish to receive these notifications, <a href="{{unsubscribeUrl}}">unsubscribe here</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .trim();
  }
}
