import { Router } from 'express';
import { EnhancedTaskController } from '../controllers/enhanced-task.controller';
import { validate } from '../middleware/zod-validation.middleware';
import { UnifiedAuthenticationMiddleware } from '../middleware/unified-authentication.middleware';
import { EnhancedRateLimiterMiddleware } from '../middleware/enhanced-rate-limiter.middleware';
import { ComprehensiveLoggingMiddleware } from '../middleware/comprehensive-logging.middleware';
import { ComprehensiveSecurityMiddleware } from '../middleware/comprehensive-security.middleware';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskParamsSchema,
  assignTaskSchema,
  updateTaskStatusSchema,
} from '../../infrastructure/database/schemas/task.schemas';
import { ILogger } from '../../shared/interfaces/logger.interface';

export class EnhancedTaskRoutes {
  private readonly router: Router;
  private readonly controller: EnhancedTaskController;
  private readonly auth: UnifiedAuthenticationMiddleware;
  private readonly rateLimiter: EnhancedRateLimiterMiddleware;
  private readonly logging: ComprehensiveLoggingMiddleware;
  private readonly security: ComprehensiveSecurityMiddleware;

  constructor(logger: ILogger) {
    this.router = Router();
    this.controller = new EnhancedTaskController(logger);

    // Initialize middleware
    this.auth = new UnifiedAuthenticationMiddleware(
      logger,
      process.env.JWT_SECRET || 'your-jwt-secret',
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
    );

    this.rateLimiter = new EnhancedRateLimiterMiddleware(logger, {
      perUser: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
      },
      perEndpoint: {
        'POST:/api/v1/tasks': {
          windowMs: 60 * 1000,
          maxRequests: 10,
        },
        'PUT:/api/v1/tasks/:id': {
          windowMs: 60 * 1000,
          maxRequests: 20,
        },
      },
    });

    this.logging = new ComprehensiveLoggingMiddleware(logger);
    this.security = new ComprehensiveSecurityMiddleware(logger, {
      cors: {
        origins: ['http://localhost:3000', 'https://app.taskmanagement.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        headers: ['Content-Type', 'Authorization'],
        credentials: true,
      },
    });

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Apply global middleware
    this.router.use(this.security.cors());
    this.router.use(this.security.securityHeaders());
    this.router.use(this.security.apiSecurityHeaders());
    this.router.use(this.logging.logRequests());
    this.router.use(this.logging.logSecurityEvents());
    this.router.use(this.logging.logUserActivity());
    this.router.use(this.security.requestSizeLimit());
    this.router.use(this.security.sqlInjectionProtection());
    this.router.use(this.security.xssProtection());
    this.router.use(this.security.pathTraversalProtection());

    // Task statistics (public endpoint for dashboard)
    this.router.get(
      '/stats',
      this.auth.optionalAuthenticate(),
      this.rateLimiter.perUserRateLimit(),
      this.controller.getTaskStats
    );

    // CRUD operations with full middleware stack
    this.router.get(
      '/',
      this.auth.authenticate({ required: true }),
      this.rateLimiter.perUserRateLimit(),
      validate({ query: taskQuerySchema }),
      this.controller.bindCrudRoutes().getAll
    );

    this.router.post(
      '/',
      this.auth.authenticate({ required: true, workspaceRequired: true }),
      this.rateLimiter.perEndpointRateLimit(),
      this.rateLimiter.burstProtection(),
      validate({
        body: createTaskSchema,
        params: taskParamsSchema,
      }),
      this.controller.bindCrudRoutes().create
    );

    this.router.get(
      '/:id',
      this.auth.authenticate({ required: true }),
      this.rateLimiter.perUserRateLimit(),
      validate({ params: taskParamsSchema }),
      this.controller.bindCrudRoutes().getById
    );

    this.router.put(
      '/:id',
      this.auth.authenticate({ required: true }),
      this.auth.requireResourceOwnership('id', 'task'),
      this.rateLimiter.perEndpointRateLimit(),
      validate({
        body: updateTaskSchema,
        params: taskParamsSchema,
      }),
      this.controller.bindCrudRoutes().update
    );

    this.router.delete(
      '/:id',
      this.auth.authenticate({ required: true }),
      this.auth.requireResourceOwnership('id', 'task'),
      this.rateLimiter.perUserRateLimit(),
      validate({ params: taskParamsSchema }),
      this.controller.bindCrudRoutes().delete
    );

    // Task-specific operations
    this.router.patch(
      '/:id/assign',
      this.auth.authenticate({
        required: true,
        permissions: ['task:assign'],
      }),
      this.rateLimiter.perUserRateLimit(),
      validate({
        body: assignTaskSchema,
        params: taskParamsSchema,
      }),
      this.controller.assignTask
    );

    this.router.patch(
      '/:id/status',
      this.auth.authenticate({ required: true }),
      this.auth.requireResourceOwnership('id', 'task'),
      this.rateLimiter.perUserRateLimit(),
      validate({
        body: updateTaskStatusSchema,
        params: taskParamsSchema,
      }),
      this.controller.updateTaskStatus
    );

    // Bulk operations (admin/manager only)
    this.router.patch(
      '/bulk',
      this.auth.authenticate({
        required: true,
        roles: ['ADMIN', 'MANAGER'],
      }),
      this.rateLimiter.perUserRateLimit(),
      // TODO: Add bulk update validation schema
      this.controller.bulkUpdateTasks
    );

    // Task comments
    this.router.get(
      '/:id/comments',
      this.auth.authenticate({ required: true }),
      this.rateLimiter.perUserRateLimit(),
      validate({ params: taskParamsSchema }),
      this.controller.getTaskComments
    );

    this.router.post(
      '/:id/comments',
      this.auth.authenticate({ required: true }),
      this.rateLimiter.perUserRateLimit(),
      validate({ params: taskParamsSchema }),
      // TODO: Add comment validation schema
      this.controller.addTaskComment
    );

    // Task attachments
    this.router.get(
      '/:id/attachments',
      this.auth.authenticate({ required: true }),
      this.rateLimiter.perUserRateLimit(),
      validate({ params: taskParamsSchema }),
      this.controller.getTaskAttachments
    );

    // Task activity log
    this.router.get(
      '/:id/activity',
      this.auth.authenticate({ required: true }),
      this.rateLimiter.perUserRateLimit(),
      validate({ params: taskParamsSchema }),
      this.controller.getTaskActivity
    );

    // Admin-only routes
    this.router.get(
      '/admin/all',
      this.auth.requireAdmin(),
      this.rateLimiter.perUserRateLimit(),
      // Get all tasks across all workspaces (admin only)
      this.controller.bindCrudRoutes().getAll
    );

    // Manager routes
    this.router.get(
      '/workspace/:workspaceId/tasks',
      this.auth.requireManager(),
      this.auth.requireWorkspaceMember('workspaceId'),
      this.rateLimiter.perUserRateLimit(),
      // Get all tasks in a workspace (manager only)
      this.controller.bindCrudRoutes().getAll
    );

    // Apply error handling middleware
    this.router.use(this.logging.logErrors());
  }

  public getRouter(): Router {
    return this.router;
  }
}

// Factory function to create routes with dependencies
export const createEnhancedTaskRoutes = (logger: ILogger): Router => {
  const taskRoutes = new EnhancedTaskRoutes(logger);
  return taskRoutes.getRouter();
};
