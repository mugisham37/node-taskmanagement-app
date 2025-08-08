import { Injectable } from '../../application/decorators/injectable';
import { NotificationEntity } from '../../domain/notification/entities/notification.entity';
import { NotificationChannel } from '../../domain/notification/value-objects/notification-channel';
import {
  DeliveryProvider,
  DeliveryResult,
} from '../../domain/notification/services/notification-delivery.service';
import { Logger } from '../logging/logger';
import * as nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  replyTo?: string;
  maxConnections?: number;
  pool?: boolean;
  rateDelta?: number;
  rateLimit?: number;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailDeliveryProvider implements DeliveryProvider {
  public readonly channel = NotificationChannel.EMAIL;
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig;
  private isHealthy = false;
  private lastHealthCheck = new Date();

  constructor(
    config: EmailConfig,
    private readonly logger: Logger
  ) {
    this.config = config;
    this.initializeTransporter();
  }

  canDeliver(notification: NotificationEntity): boolean {
    // Check if notification has email channel
    const hasEmailChannel = notification.channels.some(channel =>
      channel.equals(NotificationChannel.EMAIL)
    );

    if (!hasEmailChannel) {
      return false;
    }

    // Check if transporter is available
    if (!this.transporter) {
      this.logger.warn('Email transporter not available', {
        notificationId: notification.id.value,
      });
      return false;
    }

    // Check if we have recipient information in notification data
    const hasRecipient =
      notification.data.email ||
      notification.data.recipientEmail ||
      notification.data.to;

    if (!hasRecipient) {
      this.logger.warn('No email recipient found in notification data', {
        notificationId: notification.id.value,
      });
      return false;
    }

    return true;
  }

  async deliver(
    notification: NotificationEntity,
    content: { subject: string; body: string }
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      // Extract recipient email from notification data
      const recipientEmail = this.extractRecipientEmail(notification);
      if (!recipientEmail) {
        throw new Error('No recipient email found');
      }

      // Prepare email options
      const mailOptions = this.prepareMailOptions(
        recipientEmail,
        content,
        notification
      );

      this.logger.debug('Sending email notification', {
        notificationId: notification.id.value,
        to: recipientEmail,
        subject: content.subject,
      });

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      const deliveryTime = Date.now() - startTime;

      this.logger.info('Email notification sent successfully', {
        notificationId: notification.id.value,
        messageId: result.messageId,
        deliveryTime,
      });

      return {
        success: true,
        channel: this.channel,
        messageId: result.messageId,
        timestamp: new Date(),
        metadata: {
          deliveryTime,
          response: result.response,
          envelope: result.envelope,
        },
      };
    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      this.logger.error('Failed to send email notification', {
        notificationId: notification.id.value,
        error: error.message,
        deliveryTime,
      });

      return {
        success: false,
        channel: this.channel,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          deliveryTime,
        },
      };
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      if (!this.transporter) {
        return false;
      }

      // Verify SMTP connection
      await this.transporter.verify();
      this.isHealthy = true;
      this.lastHealthCheck = new Date();

      this.logger.info('Email configuration validated successfully');
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      this.logger.error('Email configuration validation failed', {
        error: error.message,
      });

      return false;
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    details?: Record<string, any>;
  }> {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();

    // Re-check health if it's been more than 5 minutes
    if (timeSinceLastCheck > 300000) {
      await this.validateConfiguration();
    }

    return {
      healthy: this.isHealthy,
      details: {
        lastHealthCheck: this.lastHealthCheck,
        transporterAvailable: !!this.transporter,
        config: {
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure,
          from: this.config.from,
        },
      },
    };
  }

  // Email-specific methods
  async sendBulkEmails(
    notifications: NotificationEntity[],
    templates: Map<string, { subject: string; body: string }>
  ): Promise<Map<string, DeliveryResult>> {
    const results = new Map<string, DeliveryResult>();

    // Process in batches to avoid overwhelming the SMTP server
    const batchSize = this.config.rateLimit || 10;
    const batches = this.chunkArray(notifications, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async notification => {
        const template = templates.get(notification.type.value);
        if (!template) {
          const error = `No template found for notification type: ${notification.type.value}`;
          return {
            notificationId: notification.id.value,
            result: {
              success: false,
              channel: this.channel,
              error,
              timestamp: new Date(),
            } as DeliveryResult,
          };
        }

        const result = await this.deliver(notification, template);
        return {
          notificationId: notification.id.value,
          result,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ notificationId, result }) => {
        results.set(notificationId, result);
      });

      // Add delay between batches if rate limiting is configured
      if (
        this.config.rateDelta &&
        batches.indexOf(batch) < batches.length - 1
      ) {
        await this.delay(this.config.rateDelta);
      }
    }

    return results;
  }

  async sendDigestEmail(
    recipientEmail: string,
    digestData: {
      subject: string;
      notifications: NotificationEntity[];
      summary: {
        totalCount: number;
        unreadCount: number;
        urgentCount: number;
        categories: Record<string, number>;
      };
    }
  ): Promise<DeliveryResult> {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const htmlContent = this.generateDigestHtml(digestData);
      const textContent = this.generateDigestText(digestData);

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.from,
        to: recipientEmail,
        subject: digestData.subject,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Notification-Type': 'digest',
          'X-Notification-Count': digestData.summary.totalCount.toString(),
        },
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.info('Digest email sent successfully', {
        to: recipientEmail,
        messageId: result.messageId,
        notificationCount: digestData.summary.totalCount,
      });

      return {
        success: true,
        channel: this.channel,
        messageId: result.messageId,
        timestamp: new Date(),
        metadata: {
          type: 'digest',
          notificationCount: digestData.summary.totalCount,
        },
      };
    } catch (error) {
      this.logger.error('Failed to send digest email', {
        to: recipientEmail,
        error: error.message,
      });

      return {
        success: false,
        channel: this.channel,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          type: 'digest',
        },
      };
    }
  }

  // Configuration management
  updateConfiguration(newConfig: Partial<EmailConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeTransporter();
  }

  getConfiguration(): EmailConfig {
    return { ...this.config };
  }

  // Private helper methods
  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransporter({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        pool: this.config.pool || true,
        maxConnections: this.config.maxConnections || 5,
        rateDelta: this.config.rateDelta,
        rateLimit: this.config.rateLimit,
      });

      this.logger.info('Email transporter initialized', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
      });
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', {
        error: error.message,
      });
      this.transporter = null;
    }
  }

  private extractRecipientEmail(
    notification: NotificationEntity
  ): string | null {
    // Try different possible fields for recipient email
    const possibleFields = ['email', 'recipientEmail', 'to', 'userEmail'];

    for (const field of possibleFields) {
      if (notification.data[field]) {
        return notification.data[field];
      }
    }

    return null;
  }

  private prepareMailOptions(
    recipientEmail: string,
    content: { subject: string; body: string },
    notification: NotificationEntity
  ): nodemailer.SendMailOptions {
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.config.from,
      to: recipientEmail,
      subject: content.subject,
      html: content.body,
      text: this.htmlToText(content.body),
      replyTo: this.config.replyTo,
      headers: {
        'X-Notification-ID': notification.id.value,
        'X-Notification-Type': notification.type.value,
        'X-Notification-Priority': notification.priority.value,
      },
    };

    // Add action URL as a tracking parameter if available
    if (notification.actionUrl) {
      mailOptions.headers!['X-Action-URL'] = notification.actionUrl;
    }

    // Add attachments if specified in notification data
    if (notification.data.attachments) {
      mailOptions.attachments = notification.data.attachments;
    }

    return mailOptions;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private generateDigestHtml(digestData: {
    subject: string;
    notifications: NotificationEntity[];
    summary: {
      totalCount: number;
      unreadCount: number;
      urgentCount: number;
      categories: Record<string, number>;
    };
  }): string {
    const { notifications, summary } = digestData;

    let html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .summary { background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
            .notification { border-left: 4px solid #007bff; padding: 15px; margin-bottom: 15px; background-color: #f8f9fa; }
            .notification.urgent { border-left-color: #dc3545; }
            .notification.high { border-left-color: #fd7e14; }
            .notification-title { font-weight: bold; margin-bottom: 5px; }
            .notification-meta { font-size: 0.9em; color: #6c757d; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${digestData.subject}</h2>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Notifications:</strong> ${summary.totalCount}</p>
            <p><strong>Unread:</strong> ${summary.unreadCount}</p>
            <p><strong>Urgent:</strong> ${summary.urgentCount}</p>
          </div>
    `;

    // Group notifications by category
    const categorizedNotifications = notifications.reduce(
      (acc, notification) => {
        const category = notification.type.getCategory();
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(notification);
        return acc;
      },
      {} as Record<string, NotificationEntity[]>
    );

    // Render each category
    Object.entries(categorizedNotifications).forEach(
      ([category, categoryNotifications]) => {
        html += `<h3>${category.charAt(0).toUpperCase() + category.slice(1)} Notifications</h3>`;

        categoryNotifications.forEach(notification => {
          const priorityClass =
            notification.priority.value === 'urgent'
              ? 'urgent'
              : notification.priority.value === 'high'
                ? 'high'
                : '';

          html += `
          <div class="notification ${priorityClass}">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-meta">
              Priority: ${notification.priority.getDisplayName()} | 
              Created: ${notification.createdAt.toLocaleDateString()}
              ${notification.actionUrl ? ` | <a href="${notification.actionUrl}">View Details</a>` : ''}
            </div>
          </div>
        `;
        });
      }
    );

    html += `
          <div class="footer">
            <p>This is an automated digest email. Please do not reply to this message.</p>
          </div>
        </body>
      </html>
    `;

    return html;
  }

  private generateDigestText(digestData: {
    subject: string;
    notifications: NotificationEntity[];
    summary: {
      totalCount: number;
      unreadCount: number;
      urgentCount: number;
      categories: Record<string, number>;
    };
  }): string {
    const { notifications, summary } = digestData;

    let text = `${digestData.subject}\n\n`;
    text += `SUMMARY\n`;
    text += `Total Notifications: ${summary.totalCount}\n`;
    text += `Unread: ${summary.unreadCount}\n`;
    text += `Urgent: ${summary.urgentCount}\n\n`;

    // Group notifications by category
    const categorizedNotifications = notifications.reduce(
      (acc, notification) => {
        const category = notification.type.getCategory();
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(notification);
        return acc;
      },
      {} as Record<string, NotificationEntity[]>
    );

    // Render each category
    Object.entries(categorizedNotifications).forEach(
      ([category, categoryNotifications]) => {
        text += `${category.toUpperCase()} NOTIFICATIONS\n`;
        text += '='.repeat(category.length + 15) + '\n\n';

        categoryNotifications.forEach(notification => {
          text += `• ${notification.title}\n`;
          text += `  ${notification.message}\n`;
          text += `  Priority: ${notification.priority.getDisplayName()} | Created: ${notification.createdAt.toLocaleDateString()}`;
          if (notification.actionUrl) {
            text += ` | ${notification.actionUrl}`;
          }
          text += '\n\n';
        });
      }
    );

    text +=
      '\nThis is an automated digest email. Please do not reply to this message.\n';

    return text;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
