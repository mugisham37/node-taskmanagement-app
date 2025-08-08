// Core service exports
export * from './user.service';
export * from './task.service';
export * from './project.service';
export * from './notification.service';
export * from './email.service';
export * from './team.service';
export * from './workspace.service';
export * from './comment.service';
export * from './activity.service';
export * from './invitation.service';
export * from './recurring-task.service';
export * from './task-template.service';
// Calendar services moved to domains/calendar/services/
export * from './analytics.service';
export * from './feedback.service';
export * from './dashboard.service';
export * from './data-import-export.service';

// WebSocket service exports (with renamed types to avoid conflicts)
export {
  setupWebSocketServer,
  sendUserNotification,
  sendTaskUpdate,
  sendProjectUpdate,
  sendWorkspaceUpdate,
  broadcastToAll,
  getActiveConnectionsCount,
  getConnectionsByRoom,
} from './websocket.service';

export type {
  WebSocketMetrics,
  NotificationData,
  TaskUpdateData as WebSocketTaskUpdateData,
  ProjectUpdateData as WebSocketProjectUpdateData,
  WorkspaceUpdateData as WebSocketWorkspaceUpdateData,
} from './websocket.service';

// System monitoring service exports
export type {
  SystemMetrics,
  SystemAlert,
  SystemThresholds,
  PerformanceReport,
} from './system-monitoring.service';

// Base service exports
export * from './base.service';

// Service instances for easy access
export { userService } from './user.service';
export { taskService } from './task.service';
export { projectService } from './project.service';
export { notificationService } from './notification.service';
export { emailService } from './email.service';
export { teamService } from './team.service';
export { workspaceService } from './workspace.service';
export { commentService } from './comment.service';
export { activityService } from './activity.service';
export { invitationService } from './invitation.service';
export { recurringTaskService } from './recurring-task.service';
export { taskTemplateService } from './task-template.service';
// Calendar services moved to domains/calendar/services/
export { analyticsService } from './analytics.service';
export { webSocketService } from './websocket.service';
export { presenceService } from './presence.service';
export { systemMonitoringService } from './system-monitoring.service';
export { feedbackService } from './feedback.service';
export { dashboardService } from './dashboard.service';
export { dataImportExportService } from './data-import-export.service';
