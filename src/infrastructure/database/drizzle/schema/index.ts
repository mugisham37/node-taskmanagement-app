// Re-export schemas from their respective domains
// This maintains backward compatibility for infrastructure components that need all schemas

// Authentication domain schemas
export * from '../../../domains/authentication/schemas/users';

// Analytics domain schemas
export * from '../../../domains/analytics/schemas/activities';

// Calendar domain schemas
export * from '../../../domains/calendar/schemas/calendar-events';
export * from '../../../domains/calendar/schemas/calendar-integrations';

// Collaboration domain schemas
export * from '../../../domains/collaboration/schemas/comments';

// Notification domain schemas
export * from '../../../domains/notification/schemas/notifications';

// Task Management domain schemas
// Note: These schemas should be imported from task-management domain once they are moved
// export * from '../../../domains/task-management/schemas/projects';
// export * from '../../../domains/task-management/schemas/tasks';
// export * from '../../../domains/task-management/schemas/teams';
// export * from '../../../domains/task-management/schemas/workspaces';
// export * from '../../../domains/task-management/schemas/invitations';
// export * from '../../../domains/task-management/schemas/recurring-tasks';
// export * from '../../../domains/task-management/schemas/task-templates';

// Other domain schemas
// export * from '../../../domains/[domain]/schemas/feedback';
