/**
 * Webhook Event Types
 * Defines all available webhook event types that can trigger notifications
 */
export enum WebhookEvent {
  // Task Events
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_ASSIGNED = 'task.assigned',
  TASK_COMPLETED = 'task.completed',
  TASK_DELETED = 'task.deleted',

  // Project Events
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',
  PROJECT_MEMBER_ADDED = 'project.member.added',
  PROJECT_MEMBER_REMOVED = 'project.member.removed',

  // Workspace Events
  WORKSPACE_CREATED = 'workspace.created',
  WORKSPACE_UPDATED = 'workspace.updated',
  WORKSPACE_MEMBER_ADDED = 'workspace.member.added',
  WORKSPACE_MEMBER_REMOVED = 'workspace.member.removed',

  // User Events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',

  // Test Event
  WEBHOOK_TEST = 'webhook.test',
}

/**
 * Get all valid webhook event types as an array
 */
export function getValidWebhookEvents(): WebhookEvent[] {
  return Object.values(WebhookEvent);
}

/**
 * Check if a string is a valid webhook event
 */
export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return Object.values(WebhookEvent).includes(event as WebhookEvent);
}

/**
 * Convert string array to WebhookEvent array with validation
 */
export function validateWebhookEvents(events: string[]): WebhookEvent[] {
  const invalidEvents = events.filter(event => !isValidWebhookEvent(event));
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid webhook events: ${invalidEvents.join(', ')}`);
  }
  return events as WebhookEvent[];
}
