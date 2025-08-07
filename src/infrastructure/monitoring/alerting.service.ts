import { EventEmitter } from 'events';
import { Alert, AlertRule } from './monitoring-dashboard.service';
import { logSystem, logError, logSecurity } from '../../config/logger';

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  channelId: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  error?: string;
}

export interface Runbook {
  id: string;
  name: string;
  description: string;
  triggers: string[]; // Alert rule IDs that trigger this runbook
  steps: RunbookStep[];
  tags: string[];
  lastUpdated: Date;
}

export interface RunbookStep {
  id: string;
  title: string;
  description: string;
  type: 'manual' | 'automated' | 'verification';
  command?: string;
  expectedResult?: string;
  automationScript?: string;
}

export class AlertingService extends EventEmitter {
  private readonly notificationChannels = new Map<
    string,
    NotificationChannel
  >();
  private readonly pendingNotifications = new Map<string, AlertNotification>();
  private readonly runbooks = new Map<string, Runbook>();
  private retryInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDefaultChannels();
    this.initializeDefaultRunbooks();
    this.startRetryProcessor();
  }

  private initializeDefaultChannels(): void {
    // Default email channel (would be configured via environment variables)
    const emailChannel: NotificationChannel = {
      id: 'default_email',
      name: 'Default Email',
      type: 'email',
      config: {
        smtpHost: process.env.SMTP_HOST || 'localhost',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.ALERT_FROM_EMAIL || 'alerts@company.com',
        toEmails: (process.env.ALERT_TO_EMAILS || '')
          .split(',')
          .filter(Boolean),
      },
      enabled: !!process.env.SMTP_HOST,
    };

    this.notificationChannels.set(emailChannel.id, emailChannel);

    // Default webhook channel
    const webhookChannel: NotificationChannel = {
      id: 'default_webhook',
      name: 'Default Webhook',
      type: 'webhook',
      config: {
        url: process.env.ALERT_WEBHOOK_URL || '',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.ALERT_WEBHOOK_TOKEN
            ? `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
            : '',
        },
      },
      enabled: !!process.env.ALERT_WEBHOOK_URL,
    };

    this.notificationChannels.set(webhookChannel.id, webhookChannel);

    logSystem(
      `Initialized ${this.notificationChannels.size} notification channels`
    );
  }

  private initializeDefaultRunbooks(): void {
    const runbooks: Runbook[] = [
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage Response',
        description: 'Steps to investigate and resolve high CPU usage',
        triggers: ['cpu_high', 'cpu_critical'],
        tags: ['performance', 'cpu', 'system'],
        lastUpdated: new Date(),
        steps: [
          {
            id: 'check_processes',
            title: 'Check Top CPU Processes',
            description: 'Identify processes consuming the most CPU',
            type: 'manual',
            command: 'top -o %CPU',
            expectedResult: 'List of processes sorted by CPU usage',
          },
          {
            id: 'check_load_average',
            title: 'Check System Load Average',
            description: 'Verify system load average over time',
            type: 'manual',
            command: 'uptime && cat /proc/loadavg',
            expectedResult: 'Current load average values',
          },
          {
            id: 'check_application_logs',
            title: 'Check Application Logs',
            description:
              'Look for errors or unusual activity in application logs',
            type: 'manual',
            command: 'tail -n 100 logs/combined.log | grep -i error',
            expectedResult: 'Recent error messages if any',
          },
          {
            id: 'restart_if_needed',
            title: 'Restart Application if Necessary',
            description:
              'If a specific process is causing issues, consider restarting it',
            type: 'manual',
            command: 'systemctl restart application-service',
            expectedResult: 'Service restarted successfully',
          },
        ],
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage Response',
        description: 'Steps to investigate and resolve high memory usage',
        triggers: ['memory_high', 'memory_critical'],
        tags: ['performance', 'memory', 'system'],
        lastUpdated: new Date(),
        steps: [
          {
            id: 'check_memory_usage',
            title: 'Check Memory Usage Details',
            description: 'Get detailed memory usage information',
            type: 'manual',
            command: 'free -h && cat /proc/meminfo',
            expectedResult: 'Detailed memory usage statistics',
          },
          {
            id: 'check_memory_processes',
            title: 'Check Top Memory Processes',
            description: 'Identify processes consuming the most memory',
            type: 'manual',
            command: 'ps aux --sort=-%mem | head -20',
            expectedResult: 'List of processes sorted by memory usage',
          },
          {
            id: 'check_swap_usage',
            title: 'Check Swap Usage',
            description: 'Verify if system is using swap space',
            type: 'manual',
            command: 'swapon -s && cat /proc/swaps',
            expectedResult: 'Swap usage information',
          },
          {
            id: 'clear_caches',
            title: 'Clear System Caches',
            description: 'Clear system caches to free up memory',
            type: 'automated',
            command: 'sync && echo 3 > /proc/sys/vm/drop_caches',
            automationScript: 'clear-system-caches.sh',
            expectedResult: 'System caches cleared',
          },
        ],
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate Response',
        description:
          'Steps to investigate and resolve high application error rates',
        triggers: ['error_rate_high', 'error_rate_critical'],
        tags: ['application', 'errors', 'debugging'],
        lastUpdated: new Date(),
        steps: [
          {
            id: 'check_recent_errors',
            title: 'Check Recent Error Logs',
            description: 'Examine recent error messages in application logs',
            type: 'manual',
            command: 'tail -n 200 logs/error.log',
            expectedResult: 'Recent error messages and stack traces',
          },
          {
            id: 'check_error_patterns',
            title: 'Analyze Error Patterns',
            description: 'Look for patterns in error messages',
            type: 'manual',
            command:
              'grep -E "(ERROR|FATAL)" logs/combined.log | tail -50 | cut -d" " -f4- | sort | uniq -c | sort -nr',
            expectedResult: 'Most common error messages',
          },
          {
            id: 'check_database_health',
            title: 'Check Database Health',
            description: 'Verify database connectivity and performance',
            type: 'verification',
            command: 'curl -f http://localhost:3000/health/database',
            expectedResult: 'Database health check passes',
          },
          {
            id: 'check_external_services',
            title: 'Check External Service Dependencies',
            description: 'Verify external service connectivity',
            type: 'verification',
            command: 'curl -f http://localhost:3000/health/detailed',
            expectedResult: 'All external services are healthy',
          },
        ],
      },
      {
        id: 'database_performance',
        name: 'Database Performance Issues',
        description:
          'Steps to investigate and resolve database performance problems',
        triggers: ['database_slow'],
        tags: ['database', 'performance', 'queries'],
        lastUpdated: new Date(),
        steps: [
          {
            id: 'check_slow_queries',
            title: 'Check Slow Query Log',
            description: 'Examine slow queries in the database',
            type: 'manual',
            command:
              'SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;',
            expectedResult: 'List of slowest database queries',
          },
          {
            id: 'check_connection_pool',
            title: 'Check Database Connection Pool',
            description: 'Verify database connection pool status',
            type: 'verification',
            command: 'curl -f http://localhost:3000/health/database',
            expectedResult: 'Connection pool utilization within normal limits',
          },
          {
            id: 'check_database_locks',
            title: 'Check for Database Locks',
            description: 'Look for blocking queries or locks',
            type: 'manual',
            command: 'SELECT * FROM pg_locks WHERE NOT granted;',
            expectedResult: 'No blocking locks found',
          },
          {
            id: 'analyze_query_plans',
            title: 'Analyze Query Execution Plans',
            description: 'Review execution plans for slow queries',
            type: 'manual',
            command: 'EXPLAIN ANALYZE <slow_query>;',
            expectedResult: 'Query execution plan with timing information',
          },
        ],
      },
    ];

    runbooks.forEach(runbook => {
      this.runbooks.set(runbook.id, runbook);
    });

    logSystem(`Initialized ${runbooks.length} operational runbooks`);
  }

  async sendAlert(alert: Alert): Promise<void> {
    logSystem(`Sending alert: ${alert.message}`, 'warn', {
      alertId: alert.id,
      severity: alert.severity,
      ruleId: alert.ruleId,
    });

    // Get enabled notification channels
    const enabledChannels = Array.from(
      this.notificationChannels.values()
    ).filter(channel => channel.enabled);

    if (enabledChannels.length === 0) {
      logSystem('No enabled notification channels found', 'warn');
      return;
    }

    // Send notifications to all enabled channels
    for (const channel of enabledChannels) {
      await this.sendNotification(alert, channel);
    }

    // Log security event for critical alerts
    if (alert.severity === 'critical') {
      logSecurity('critical_alert_triggered', 'critical', {
        alertId: alert.id,
        ruleName: alert.ruleName,
        value: alert.value,
        threshold: alert.threshold,
      });
    }
  }

  private async sendNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    const notificationId = `${alert.id}_${channel.id}_${Date.now()}`;

    const notification: AlertNotification = {
      id: notificationId,
      alertId: alert.id,
      channelId: channel.id,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      lastAttempt: new Date(),
    };

    this.pendingNotifications.set(notificationId, notification);

    try {
      await this.deliverNotification(alert, channel, notification);

      notification.status = 'sent';
      logSystem(`Alert notification sent successfully`, 'info', {
        notificationId,
        alertId: alert.id,
        channelType: channel.type,
      });
    } catch (error) {
      notification.status = 'failed';
      notification.error = (error as Error).message;
      notification.nextRetry = new Date(
        Date.now() + this.getRetryDelay(notification.attempts)
      );

      logError(error as Error, `Failed to send alert notification`, {
        notificationId,
        alertId: alert.id,
        channelType: channel.type,
      });
    }
  }

  private async deliverNotification(
    alert: Alert,
    channel: NotificationChannel,
    notification: AlertNotification
  ): Promise<void> {
    notification.attempts++;
    notification.lastAttempt = new Date();

    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel);
        break;
      case 'sms':
        await this.sendSMSNotification(alert, channel);
        break;
      default:
        throw new Error(
          `Unsupported notification channel type: ${channel.type}`
        );
    }
  }

  private async sendEmailNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    // This would integrate with your email service
    // For now, just log the notification
    logSystem('Email notification sent', 'info', {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      recipients: channel.config.toEmails,
    });
  }

  private async sendWebhookNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    const payload = {
      alert: {
        id: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp.toISOString(),
      },
      runbook: this.getRunbookForAlert(alert),
    };

    // This would make an HTTP request to the webhook URL
    // For now, just log the notification
    logSystem('Webhook notification sent', 'info', {
      alertId: alert.id,
      webhookUrl: channel.config.url,
      payload,
    });
  }

  private async sendSlackNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    // This would integrate with Slack API
    // For now, just log the notification
    logSystem('Slack notification sent', 'info', {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
    });
  }

  private async sendSMSNotification(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<void> {
    // This would integrate with SMS service (Twilio, etc.)
    // For now, just log the notification
    logSystem('SMS notification sent', 'info', {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
    });
  }

  private startRetryProcessor(): void {
    this.retryInterval = setInterval(() => {
      this.processRetries();
    }, 60000); // Check every minute
  }

  private async processRetries(): Promise<void> {
    const now = new Date();
    const retryNotifications = Array.from(
      this.pendingNotifications.values()
    ).filter(
      notification =>
        notification.status === 'failed' &&
        notification.attempts < notification.maxAttempts &&
        notification.nextRetry &&
        notification.nextRetry <= now
    );

    for (const notification of retryNotifications) {
      try {
        notification.status = 'retrying';

        const channel = this.notificationChannels.get(notification.channelId);
        if (!channel) {
          continue;
        }

        // Find the original alert (this would typically come from a database)
        // For now, we'll skip the retry since we don't have the alert object
        logSystem(`Retrying notification`, 'info', {
          notificationId: notification.id,
          attempt: notification.attempts + 1,
        });
      } catch (error) {
        notification.status = 'failed';
        notification.error = (error as Error).message;
        notification.nextRetry = new Date(
          Date.now() + this.getRetryDelay(notification.attempts)
        );

        logError(error as Error, `Notification retry failed`, {
          notificationId: notification.id,
          attempt: notification.attempts,
        });
      }
    }
  }

  private getRetryDelay(attempts: number): number {
    // Exponential backoff: 1min, 2min, 4min
    return Math.min(60000 * Math.pow(2, attempts), 240000);
  }

  getRunbookForAlert(alert: Alert): Runbook | null {
    for (const runbook of this.runbooks.values()) {
      if (runbook.triggers.includes(alert.ruleId)) {
        return runbook;
      }
    }
    return null;
  }

  // Notification Channel Management
  addNotificationChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, channel);
    logSystem(`Notification channel added: ${channel.name}`);
  }

  updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannel>
  ): void {
    const channel = this.notificationChannels.get(channelId);
    if (!channel) {
      throw new Error(`Notification channel not found: ${channelId}`);
    }

    Object.assign(channel, updates);
    logSystem(`Notification channel updated: ${channel.name}`);
  }

  removeNotificationChannel(channelId: string): void {
    const channel = this.notificationChannels.get(channelId);
    if (!channel) {
      throw new Error(`Notification channel not found: ${channelId}`);
    }

    this.notificationChannels.delete(channelId);
    logSystem(`Notification channel removed: ${channel.name}`);
  }

  getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  // Runbook Management
  addRunbook(runbook: Runbook): void {
    this.runbooks.set(runbook.id, runbook);
    logSystem(`Runbook added: ${runbook.name}`);
  }

  updateRunbook(runbookId: string, updates: Partial<Runbook>): void {
    const runbook = this.runbooks.get(runbookId);
    if (!runbook) {
      throw new Error(`Runbook not found: ${runbookId}`);
    }

    Object.assign(runbook, { ...updates, lastUpdated: new Date() });
    logSystem(`Runbook updated: ${runbook.name}`);
  }

  removeRunbook(runbookId: string): void {
    const runbook = this.runbooks.get(runbookId);
    if (!runbook) {
      throw new Error(`Runbook not found: ${runbookId}`);
    }

    this.runbooks.delete(runbookId);
    logSystem(`Runbook removed: ${runbook.name}`);
  }

  getRunbooks(): Runbook[] {
    return Array.from(this.runbooks.values());
  }

  getRunbook(runbookId: string): Runbook | undefined {
    return this.runbooks.get(runbookId);
  }

  searchRunbooks(tags: string[]): Runbook[] {
    return Array.from(this.runbooks.values()).filter(runbook =>
      tags.some(tag => runbook.tags.includes(tag))
    );
  }

  // Cleanup
  cleanup(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
