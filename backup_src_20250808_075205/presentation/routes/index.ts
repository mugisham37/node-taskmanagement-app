import { Router } from 'express';
import activityRoutes from './activity.routes';
import analyticsRoutes from './analytics.routes';
import authRoutes from './auth.routes';
import calendarRoutes from './calendar.routes';
import commentRoutes from './comment.routes';
import dashboardRoutes from './dashboard.routes';
import exportImportRoutes from './export-import.routes';
import feedbackRoutes from './feedback.routes';
import healthRoutes from './health.routes';
import metricsRoutes from './metrics.routes';
import monitoringRoutes from './monitoring.routes';
import invitationRoutes from './invitation.routes';
import notificationRoutes from './notification.routes';
import performanceRoutes from './performance.routes';
import projectRoutes from './project.routes';
import recurringTaskRoutes from './recurring-task.routes';
import taskTemplateRoutes from './task-template.routes';
import taskRoutes from './task.routes';
import teamRoutes from './team.routes';
import userRoutes from './user.routes';
import workspaceRoutes from './workspace.routes';

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
