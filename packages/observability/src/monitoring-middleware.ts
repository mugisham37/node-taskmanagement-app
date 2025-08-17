import { NextFunction, Request, Response } from 'express';
import { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { ApplicationMonitoringService } from './application-monitoring';
import { BusinessMetricsService } from './business-metrics-service';
import { ILoggingService } from './logging-service';
import { PerformanceMonitoringService } from './performance-monitoring';

export interface MonitoringContext {
  correlationId: string;
  startTime: number;
  userId?: string;
  workspaceId?: string;
  userRole?: string;
  platform?: string;
}

export interface RequestMetadata {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
  userId?: string;
  workspaceId?: string;
}

// Express middleware
export class ExpressMonitoringMiddleware {
  private logger: Logger;

  constructor(
    private loggingService: ILoggingService,
    private applicationMonitoring: ApplicationMonitoringService,
    private performanceMonitoring: PerformanceMonitoringService,
    private businessMetrics: BusinessMetricsService
  ) {
    this.logger = this.loggingService.getLogger('ExpressMonitoring');
  }

  // Correlation ID middleware
  correlationId() {
    return (req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
      
      req.correlationId = correlationId;
      res.setHeader('x-correlation-id', correlationId);
      
      // Add to logging context
      this.loggingService.setCorrelationId(correlationId);
      
      next();
    };
  }

  // Request monitoring middleware
  requestMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const correlationId = req.correlationId || uuidv4();

      // Extract metadata
      const metadata: RequestMetadata = {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        contentLength: req.headers['content-length'] ? parseInt(req.headers['content-length']) : undefined,
        userId: req.user?.id,
        workspaceId: req.workspace?.id,
      };

      // Log request start
      this.logger.info('Request started', {
        correlationId,
        ...metadata,
      });

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode;
        const responseSize = res.get('content-length') ? parseInt(res.get('content-length')!) : 0;

        // Track performance metrics
        this.performanceMonitoring.trackHttpRequest(
          metadata.method,
          this.extractRoute(req),
          statusCode,
          duration,
          metadata.contentLength,
          responseSize,
          metadata.userAgent
        );

        // Track business metrics for API usage
        if (metadata.userId && metadata.workspaceId) {
          this.businessMetrics.trackApiEndpointUsage(
            this.extractRoute(req),
            metadata.method,
            metadata.workspaceId,
            req.user?.role || 'unknown'
          );
        }

        // Log request completion
        this.logger.info('Request completed', {
          correlationId,
          duration,
          statusCode,
          responseSize,
          ...metadata,
        });

        // Track errors
        if (statusCode >= 400) {
          const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
          const severity = statusCode >= 500 ? 'high' : 'medium';
          
          this.applicationMonitoring.trackError(
            new Error(`HTTP ${statusCode} error`),
            errorType,
            severity,
            'http_request',
            { ...metadata, statusCode, duration }
          );
        }

        originalEnd.call(res, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  // Error handling middleware
  errorHandling() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.correlationId || 'unknown';
      
      // Track error in monitoring
      this.applicationMonitoring.trackError(
        error,
        'unhandled_error',
        'critical',
        'express_middleware',
        {
          correlationId,
          method: req.method,
          url: req.url,
          userId: req.user?.id,
          workspaceId: req.workspace?.id,
        }
      );

      this.logger.error('Unhandled error in Express middleware', {
        correlationId,
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
      });

      // Send error response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      next(error);
    };
  }

  private extractRoute(req: Request): string {
    // Extract route pattern from request
    return req.route?.path || req.path || req.url;
  }
}

// Fastify plugin
export class FastifyMonitoringPlugin {
  private logger: Logger;

  constructor(
    private loggingService: ILoggingService,
    private applicationMonitoring: ApplicationMonitoringService,
    private performanceMonitoring: PerformanceMonitoringService,
    private businessMetrics: BusinessMetricsService
  ) {
    this.logger = this.loggingService.getLogger('FastifyMonitoring');
  }

  // Fastify plugin function
  plugin() {
    return async (fastify: any, options: any) => {
      // Add correlation ID hook
      fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        const correlationId = request.headers['x-correlation-id'] as string || uuidv4();
        
        request.correlationId = correlationId;
        reply.header('x-correlation-id', correlationId);
        
        // Add to logging context
        this.loggingService.setCorrelationId(correlationId);
      });

      // Add request monitoring hook
      fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        request.startTime = Date.now();
      });

      // Add response monitoring hook
      fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
        const duration = (Date.now() - (request.startTime || Date.now())) / 1000;
        const statusCode = reply.statusCode;

        // Extract metadata
        const metadata: RequestMetadata = {
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent'] as string,
          ip: request.ip,
          contentLength: request.headers['content-length'] ? parseInt(request.headers['content-length'] as string) : undefined,
          userId: (request as any).user?.id,
          workspaceId: (request as any).workspace?.id,
        };

        // Track performance metrics
        this.performanceMonitoring.trackHttpRequest(
          metadata.method,
          this.extractRoute(request),
          statusCode,
          duration,
          metadata.contentLength,
          reply.getHeader('content-length') ? parseInt(reply.getHeader('content-length') as string) : undefined,
          metadata.userAgent
        );

        // Track business metrics
        if (metadata.userId && metadata.workspaceId) {
          this.businessMetrics.trackApiEndpointUsage(
            this.extractRoute(request),
            metadata.method,
            metadata.workspaceId,
            (request as any).user?.role || 'unknown'
          );
        }

        // Log request
        this.logger.info('Request completed', {
          correlationId: request.correlationId,
          duration,
          statusCode,
          ...metadata,
        });

        // Track errors
        if (statusCode >= 400) {
          const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
          const severity = statusCode >= 500 ? 'high' : 'medium';
          
          this.applicationMonitoring.trackError(
            new Error(`HTTP ${statusCode} error`),
            errorType,
            severity,
            'http_request',
            { ...metadata, statusCode, duration }
          );
        }
      });

      // Add error handler
      fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
        const correlationId = request.correlationId || 'unknown';
        
        // Track error
        this.applicationMonitoring.trackError(
          error,
          'unhandled_error',
          'critical',
          'fastify_handler',
          {
            correlationId,
            method: request.method,
            url: request.url,
            userId: (request as any).user?.id,
            workspaceId: (request as any).workspace?.id,
          }
        );

        this.logger.error('Unhandled error in Fastify handler', {
          correlationId,
          error: error.message,
          stack: error.stack,
          method: request.method,
          url: request.url,
        });

        // Send error response
        reply.status(500).send({
          error: 'Internal Server Error',
          correlationId,
          timestamp: new Date().toISOString(),
        });
      });
    };
  }

  private extractRoute(request: FastifyRequest): string {
    // Extract route pattern from request
    return (request as any).routerPath || request.url;
  }
}

// WebSocket monitoring
export class WebSocketMonitoringService {
  private logger: Logger;
  private connections: Map<string, MonitoringContext> = new Map();

  constructor(
    private loggingService: ILoggingService,
    private applicationMonitoring: ApplicationMonitoringService,
    private businessMetrics: BusinessMetricsService
  ) {
    this.logger = this.loggingService.getLogger('WebSocketMonitoring');
  }

  trackConnection(
    connectionId: string,
    userId?: string,
    workspaceId?: string,
    userRole?: string
  ): void {
    const context: MonitoringContext = {
      correlationId: uuidv4(),
      startTime: Date.now(),
      userId,
      workspaceId,
      userRole,
      platform: 'websocket',
    };

    this.connections.set(connectionId, context);
    
    // Update connection count
    this.applicationMonitoring.setWebSocketConnections(this.connections.size);

    this.logger.info('WebSocket connection established', {
      connectionId,
      correlationId: context.correlationId,
      userId,
      workspaceId,
      userRole,
    });
  }

  trackDisconnection(connectionId: string, reason?: string): void {
    const context = this.connections.get(connectionId);
    
    if (context) {
      const duration = (Date.now() - context.startTime) / 1000;
      
      // Track session duration if user info available
      if (context.userId && context.workspaceId && context.userRole) {
        this.businessMetrics.trackUserSession(duration, context.workspaceId, context.userRole);
      }

      this.connections.delete(connectionId);
      
      // Update connection count
      this.applicationMonitoring.setWebSocketConnections(this.connections.size);

      this.logger.info('WebSocket connection closed', {
        connectionId,
        correlationId: context.correlationId,
        duration,
        reason,
        userId: context.userId,
        workspaceId: context.workspaceId,
      });
    }
  }

  trackMessage(
    connectionId: string,
    messageType: string,
    direction: 'inbound' | 'outbound',
    size?: number
  ): void {
    const context = this.connections.get(connectionId);
    
    if (context) {
      // Track message in application monitoring
      this.applicationMonitoring.trackWebSocketMessage(messageType, direction);

      // Track feature usage if it's a user action
      if (direction === 'inbound' && context.userId && context.workspaceId && context.userRole) {
        this.businessMetrics.trackFeatureUsage(
          `websocket_${messageType}`,
          context.workspaceId,
          context.userRole,
          context.platform || 'websocket'
        );
      }

      this.logger.debug('WebSocket message tracked', {
        connectionId,
        correlationId: context.correlationId,
        messageType,
        direction,
        size,
        userId: context.userId,
        workspaceId: context.workspaceId,
      });
    }
  }

  trackError(connectionId: string, error: Error, context?: Record<string, any>): void {
    const connContext = this.connections.get(connectionId);
    
    this.applicationMonitoring.trackError(
      error,
      'websocket_error',
      'medium',
      'websocket',
      {
        connectionId,
        correlationId: connContext?.correlationId,
        userId: connContext?.userId,
        workspaceId: connContext?.workspaceId,
        ...context,
      }
    );

    this.logger.error('WebSocket error tracked', {
      connectionId,
      correlationId: connContext?.correlationId,
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getConnectionsByWorkspace(workspaceId: string): number {
    return Array.from(this.connections.values())
      .filter(context => context.workspaceId === workspaceId)
      .length;
  }
}

// Database monitoring middleware
export class DatabaseMonitoringMiddleware {
  private logger: Logger;

  constructor(
    private loggingService: ILoggingService,
    private performanceMonitoring: PerformanceMonitoringService,
    private applicationMonitoring: ApplicationMonitoringService
  ) {
    this.logger = this.loggingService.getLogger('DatabaseMonitoring');
  }

  // Drizzle ORM middleware
  drizzleMiddleware() {
    return {
      onQuery: (query: string, params: any[]) => {
        const startTime = Date.now();
        const correlationId = this.loggingService.getCorrelationId();

        return {
          onResult: (result: any) => {
            const duration = (Date.now() - startTime) / 1000;
            const operation = this.extractOperation(query);
            const table = this.extractTable(query);

            this.performanceMonitoring.trackDatabaseQuery(
              operation,
              table,
              duration,
              true
            );

            this.logger.debug('Database query completed', {
              correlationId,
              operation,
              table,
              duration,
              rowCount: result?.rowCount || 0,
            });
          },
          onError: (error: Error) => {
            const duration = (Date.now() - startTime) / 1000;
            const operation = this.extractOperation(query);
            const table = this.extractTable(query);

            this.performanceMonitoring.trackDatabaseQuery(
              operation,
              table,
              duration,
              false,
              error.name
            );

            this.applicationMonitoring.trackError(
              error,
              'database_error',
              'high',
              'database',
              {
                correlationId,
                operation,
                table,
                query: query.substring(0, 200), // Truncate for logging
                duration,
              }
            );

            this.logger.error('Database query failed', {
              correlationId,
              operation,
              table,
              duration,
              error: error.message,
              query: query.substring(0, 200),
            });
          },
        };
      },
    };
  }

  private extractOperation(query: string): string {
    const normalizedQuery = query.trim().toLowerCase();
    
    if (normalizedQuery.startsWith('select')) return 'select';
    if (normalizedQuery.startsWith('insert')) return 'insert';
    if (normalizedQuery.startsWith('update')) return 'update';
    if (normalizedQuery.startsWith('delete')) return 'delete';
    if (normalizedQuery.startsWith('create')) return 'create';
    if (normalizedQuery.startsWith('alter')) return 'alter';
    if (normalizedQuery.startsWith('drop')) return 'drop';
    
    return 'unknown';
  }

  private extractTable(query: string): string {
    // Simple table extraction - could be improved with proper SQL parsing
    const match = query.match(/(?:from|into|update|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    return match ? match[1] : 'unknown';
  }
}

export {
  DatabaseMonitoringMiddleware, ExpressMonitoringMiddleware,
  FastifyMonitoringPlugin,
  WebSocketMonitoringService
};
