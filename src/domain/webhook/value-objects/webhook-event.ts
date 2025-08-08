import { ValueObject } from '../../../shared/domain/value-object';

export type WebhookEventValue =
  // Task events
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.assigned'
  | 'task.completed'
  | 'task.status_changed'
  | 'task.priority_changed'
  | 'task.due_date_changed'
  | 'task.comment_added'

  // Project events
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.archived'
  | 'project.member_added'
  | 'project.member_removed'

  // Workspace events
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.member_added'
  | 'workspace.member_removed'
  | 'workspace.member_role_changed'

  // Team events
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'team.member_added'
  | 'team.member_removed'

  // User events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.login'
  | 'user.logout'

  // Comment events
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'

  // Notification events
  | 'notification.created'
  | 'notification.delivered'
  | 'notification.read'

  // Calendar events
  | 'calendar.event_created'
  | 'calendar.event_updated'
  | 'calendar.event_deleted'
  | 'calendar.reminder_sent'

  // System events
  | 'system.maintenance_started'
  | 'system.maintenance_completed'
  | 'system.backup_completed'
  | 'system.error_occurred'

  // Webhook events
  | 'webhook.test'
  | 'webhook.delivery_failed';

export class WebhookEvent extends ValueObject<WebhookEventValue> {
  constructor(value: WebhookEventValue) {
    super(value);
    this.validate();
  }

  private validate(): void {
    const validEvents: WebhookEventValue[] = [
      // Task events
      'task.created',
      'task.updated',
      'task.deleted',
      'task.assigned',
      'task.completed',
      'task.status_changed',
      'task.priority_changed',
      'task.due_date_changed',
      'task.comment_added',

      // Project events
      'project.created',
      'project.updated',
      'project.deleted',
      'project.archived',
      'project.member_added',
      'project.member_removed',

      // Workspace events
      'workspace.created',
      'workspace.updated',
      'workspace.member_added',
      'workspace.member_removed',
      'workspace.member_role_changed',

      // Team events
      'team.created',
      'team.updated',
      'team.deleted',
      'team.member_added',
      'team.member_removed',

      // User events
      'user.created',
      'user.updated',
      'user.deleted',
      'user.login',
      'user.logout',

      // Comment events
      'comment.created',
      'comment.updated',
      'comment.deleted',

      // Notification events
      'notification.created',
      'notification.delivered',
      'notification.read',

      // Calendar events
      'calendar.event_created',
      'calendar.event_updated',
      'calendar.event_deleted',
      'calendar.reminder_sent',

      // System events
      'system.maintenance_started',
      'system.maintenance_completed',
      'system.backup_completed',
      'system.error_occurred',

      // Webhook events
      'webhook.test',
      'webhook.delivery_failed',
    ];

    if (!validEvents.includes(this.value)) {
      throw new Error(
        `Invalid webhook event: ${this.value}. Must be one of the supported event types.`
      );
    }
  }

  get category(): string {
    return this.value.split('.')[0];
  }

  get action(): string {
    return this.value.split('.').slice(1).join('.');
  }

  isTaskEvent(): boolean {
    return this.category === 'task';
  }

  isProjectEvent(): boolean {
    return this.category === 'project';
  }

  isWorkspaceEvent(): boolean {
    return this.category === 'workspace';
  }

  isTeamEvent(): boolean {
    return this.category === 'team';
  }

  isUserEvent(): boolean {
    return this.category === 'user';
  }

  isCommentEvent(): boolean {
    return this.category === 'comment';
  }

  isNotificationEvent(): boolean {
    return this.category === 'notification';
  }

  isCalendarEvent(): boolean {
    return this.category === 'calendar';
  }

  isSystemEvent(): boolean {
    return this.category === 'system';
  }

  isWebhookEvent(): boolean {
    return this.category === 'webhook';
  }

  static fromString(value: string): WebhookEvent {
    return new WebhookEvent(value as WebhookEventValue);
  }

  static getAllEvents(): WebhookEventValue[] {
    return [
      // Task events
      'task.created',
      'task.updated',
      'task.deleted',
      'task.assigned',
      'task.completed',
      'task.status_changed',
      'task.priority_changed',
      'task.due_date_changed',
      'task.comment_added',

      // Project events
      'project.created',
      'project.updated',
      'project.deleted',
      'project.archived',
      'project.member_added',
      'project.member_removed',

      // Workspace events
      'workspace.created',
      'workspace.updated',
      'workspace.member_added',
      'workspace.member_removed',
      'workspace.member_role_changed',

      // Team events
      'team.created',
      'team.updated',
      'team.deleted',
      'team.member_added',
      'team.member_removed',

      // User events
      'user.created',
      'user.updated',
      'user.deleted',
      'user.login',
      'user.logout',

      // Comment events
      'comment.created',
      'comment.updated',
      'comment.deleted',

      // Notification events
      'notification.created',
      'notification.delivered',
      'notification.read',

      // Calendar events
      'calendar.event_created',
      'calendar.event_updated',
      'calendar.event_deleted',
      'calendar.reminder_sent',

      // System events
      'system.maintenance_started',
      'system.maintenance_completed',
      'system.backup_completed',
      'system.error_occurred',

      // Webhook events
      'webhook.test',
      'webhook.delivery_failed',
    ];
  }

  static getEventsByCategory(category: string): WebhookEventValue[] {
    return this.getAllEvents().filter(event =>
      event.startsWith(`${category}.`)
    );
  }
}
