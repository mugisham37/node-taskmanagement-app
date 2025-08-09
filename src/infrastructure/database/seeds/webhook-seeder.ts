import { DatabaseConnection } from '../connection';
import { WebhookRepository } from '../repositories/webhook-repository';
import {
  Webhook,
  WebhookEvent,
  WebhookStatus,
} from '../../../domain/entities/webhook';

export class WebhookSeeder {
  private connection: DatabaseConnection;
  private webhookRepository: WebhookRepository;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
    this.webhookRepository = new WebhookRepository();
  }

  async seed(
    userIds: string[],
    workspaceIds: string[],
    count: number = 20
  ): Promise<Webhook[]> {
    const webhooks: Webhook[] = [];

    const events = Object.values(WebhookEvent);
    const statuses = Object.values(WebhookStatus);

    const sampleUrls = [
      'https://api.example.com/webhooks/tasks',
      'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      'https://discord.com/api/webhooks/123456789/abcdefghijklmnop',
      'https://api.github.com/repos/owner/repo/hooks',
      'https://api.trello.com/1/webhooks',
      'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
      'https://api.notion.com/v1/webhooks',
      'https://api.asana.com/api/1.0/webhooks',
    ];

    const sampleNames = [
      'Task Updates Webhook',
      'Slack Notifications',
      'Discord Bot Integration',
      'GitHub Sync',
      'Trello Board Updates',
      'Zapier Automation',
      'Notion Database Sync',
      'Asana Project Updates',
    ];

    const sampleDescriptions = [
      'Sends task updates to external system',
      'Posts notifications to Slack channel',
      'Integrates with Discord bot for team updates',
      'Syncs project data with GitHub repository',
      'Updates Trello boards with task changes',
      'Triggers Zapier workflows on events',
      'Syncs data with Notion database',
      'Updates Asana projects with task progress',
    ];

    for (let i = 0; i < count; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const workspaceId =
        workspaceIds[Math.floor(Math.random() * workspaceIds.length)];
      const url = sampleUrls[Math.floor(Math.random() * sampleUrls.length)];
      const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const description =
        sampleDescriptions[
          Math.floor(Math.random() * sampleDescriptions.length)
        ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      // Randomly select 1-3 events for each webhook
      const eventCount = Math.floor(Math.random() * 3) + 1;
      const selectedEvents = [];
      for (let j = 0; j < eventCount; j++) {
        const event = events[Math.floor(Math.random() * events.length)];
        if (!selectedEvents.includes(event)) {
          selectedEvents.push(event);
        }
      }

      // Generate sample headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'TaskManagement-Webhook/1.0',
        'X-Webhook-Source': 'task-management-app',
      };

      // Add authorization header for some webhooks
      if (Math.random() > 0.5) {
        headers['Authorization'] =
          `Bearer ${Math.random().toString(36).substr(2, 32)}`;
      }

      // Generate sample configuration
      const config = {
        timeout: Math.floor(Math.random() * 20) + 5, // 5-25 seconds
        retryAttempts: Math.floor(Math.random() * 5) + 1, // 1-5 attempts
        retryDelay: Math.floor(Math.random() * 5) + 1, // 1-5 seconds
        includeMetadata: Math.random() > 0.5,
        filterCriteria: {
          priority: Math.random() > 0.7 ? ['high', 'critical'] : undefined,
          status:
            Math.random() > 0.7 ? ['completed', 'in_progress'] : undefined,
        },
      };

      const webhook = Webhook.create({
        name,
        description,
        url,
        events: selectedEvents,
        headers,
        isActive: Math.random() > 0.2, // 80% chance of being active
        userId,
        workspaceId,
        secret: `webhook_secret_${Math.random().toString(36).substr(2, 16)}`,
        config,
        status,
        lastTriggeredAt:
          Math.random() > 0.5
            ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            : undefined,
        metadata: {
          source: 'seeder',
          integration: name.toLowerCase().replace(/\s+/g, '_'),
          version: '1.0',
        },
      });

      webhooks.push(webhook);
    }

    // Save webhooks in batches
    const batchSize = 10;
    for (let i = 0; i < webhooks.length; i += batchSize) {
      const batch = webhooks.slice(i, i + batchSize);
      await Promise.all(
        batch.map(webhook => this.webhookRepository.save(webhook))
      );
    }

    console.log(`Seeded ${webhooks.length} webhooks`);
    return webhooks;
  }

  async getExistingWebhooks(): Promise<Webhook[]> {
    // This would need to be implemented based on your repository's findAll method
    return [];
  }
}
