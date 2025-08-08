// Task Controller
export {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getTaskStats,
  getTaskOverview,
  updateTaskStatus,
  updateTaskPriority,
  addTaskAttachment,
  removeTaskAttachment,
  bulkUpdateTaskStatus,
  bulkAssignTasks,
  bulkMoveTasks,
  bulkDeleteTasks,
  getTaskAnalytics as getTaskAnalyticsFromTask,
} from './task.controller';

// Task Template Controller
export * from './task-template.controller';

// Activity Controller
export * from './activity.controller';

// Project Controller
export * from './project.controller';

// Team Controller
export * from './team.controller';

// Notification Controller
export * from './notification.controller';

// Analytics Controller
export {
  getTaskAnalytics,
  getProjectAnalytics,
  getUserProductivityAnalytics,
  getDashboardAnalytics,
} from './analytics.controller';

// Calendar Controller - moved to domains/calendar/controllers/

// Comment Controller
export * from './comment.controller';

// Dashboard Controller
export * from './dashboard.controller';

// Export Import Controller
export * from './export-import.controller';

// Feedback Controller
export * from './feedback.controller';

// Monitoring Controller
export * from './monitoring.controller';

// Invitation Controller
export * from './invitation.controller';

// Recurring Task Controller
export * from './recurring-task.controller';

// Workspace Controller
export * from './workspace.controller';

// Auth Controller
export * from './auth.controller';

// User Controller
export * from './user.controller';
