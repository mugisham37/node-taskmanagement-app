// Core service exports (non-task-management services only)
export * from './data-import-export.service';
export * from './feedback.service';
// Note: Most services have been moved to their respective domain directories
// - Task management services: src/domains/task-management/services/
// - Authentication services: src/domains/authentication/services/
// - Calendar services: src/domains/calendar/services/
// - Analytics services: src/domains/analytics/services/
// - Notification services: src/domains/notification/services/
// - etc.

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

// Service instances for remaining application-level services
export { webSocketService } from './websocket.service';
export { feedbackService } from './feedback.service';
export { dataImportExportService } from './data-import-export.service';

// Note: Domain-specific service instances should be imported directly from their domain directories:
// - Task management: import { taskService } from '../domains/task-management/services/task.service';
// - Projects: import { projectService } from '../domains/task-management/services/project.service';
// - Authentication: import { userService } from '../domains/authentication/services/user.service';
// - etc.
