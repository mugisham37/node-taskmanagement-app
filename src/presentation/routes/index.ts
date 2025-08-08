import { Router } from 'express';
import activityRoutes from '../../domains/analytics/routes/activity.routes';
import analyticsRoutes from '../../domains/analytics/routes/analytics.routes';
import authRoutes from '../../domains/authentication/routes/auth.routes';
import calendarRoutes from '../../domains/calendar/routes/calendar.routes';
import commentRoutes from '../../domains/collaboration/routes/comment.routes';
import dashboardRoutes from '../../domains/analytics/routes/dashboard.routes';
import exportImportRoutes from './export-import.routes';
import feedbackRoutes from './feedback.routes';
import healthRoutes from '../../domains/system-monitoring/routes/health.routes';
import metricsRoutes from '../../domains/system-monitoring/routes/metrics.routes';
import monitoringRoutes from '../../domains/system-monitoring/routes/monitoring.routes';
import invitationRoutes from '../../domains/task-management/routes/invitation.routes';
import notificationRoutes from '../../domains/notification/routes/notification.routes';
import performanceRoutes from '../../domains/system-monitoring/routes/performance.routes';
import projectRoutes from '../../domains/task-management/routes/project.routes';
import recurringTaskRoutes from '../../domains/task-management/routes/recurring-task.routes';
import taskTemplateRoutes from '../../domains/task-management/routes/task-template.routes';
import taskRoutes from '../../domains/task-management/routes/task.routes';
import teamRoutes from '../../domains/task-management/routes/team.routes';
import userRoutes from '../../domains/authentication/routes/user.routes';
import workspaceRoutes from '../../domains/task-management/routes/workspace.routes';

const router = Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount all routes with their respective paths
router.use(`${API_VERSION}/activities`, activityRoutes);
router.use(`${API_VERSION}/analytics`, analyticsRoutes);
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/calendar`, calendarRoutes);
router.use(`${API_VERSION}/comments`, commentRoutes);
router.use(`${API_VERSION}/dashboard`, dashboardRoutes);
router.use(`${API_VERSION}/export-import`, exportImportRoutes);
router.use(`${API_VERSION}/feedback`, feedbackRoutes);
router.use('/health', healthRoutes);
router.use('/metrics', metricsRoutes);
router.use('/monitoring', monitoringRoutes);
router.use(`${API_VERSION}/invitations`, invitationRoutes);
router.use(`${API_VERSION}/notifications`, notificationRoutes);
router.use(`${API_VERSION}/performance`, performanceRoutes);
router.use(`${API_VERSION}/projects`, projectRoutes);
router.use(`${API_VERSION}/recurring-tasks`, recurringTaskRoutes);
router.use(`${API_VERSION}/task-templates`, taskTemplateRoutes);
router.use(`${API_VERSION}/tasks`, taskRoutes);
router.use(`${API_VERSION}/teams`, teamRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/workspaces`, workspaceRoutes);

// API documentation route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Task Management API',
    version: '1.0.0',
    endpoints: {
      activities: `${API_VERSION}/activities`,
      analytics: `${API_VERSION}/analytics`,
      auth: `${API_VERSION}/auth`,
      calendar: `${API_VERSION}/calendar`,
      comments: `${API_VERSION}/comments`,
      dashboard: `${API_VERSION}/dashboard`,
      exportImport: `${API_VERSION}/export-import`,
      feedback: `${API_VERSION}/feedback`,
      health: '/health',
      metrics: '/metrics',
      monitoring: '/monitoring',
      invitations: `${API_VERSION}/invitations`,
      notifications: `${API_VERSION}/notifications`,
      performance: `${API_VERSION}/performance`,
      projects: `${API_VERSION}/projects`,
      recurringTasks: `${API_VERSION}/recurring-tasks`,
      taskTemplates: `${API_VERSION}/task-templates`,
      tasks: `${API_VERSION}/tasks`,
      teams: `${API_VERSION}/teams`,
      users: `${API_VERSION}/users`,
      workspaces: `${API_VERSION}/workspaces`,
    },
    documentation: '/api-docs',
    timestamp: new Date().toISOString(),
  });
});

export default router;
