import 'reflect-metadata';
import { Logger } from 'winston';
import { ApplicationMonitoringService } from './application-monitoring';
import { BusinessMetricsService } from './business-metrics-service';
import { PerformanceMonitoringService } from './performance-monitoring';

// Metadata keys
const MONITOR_METADATA_KEY = Symbol('monitor');
const TRACK_PERFORMANCE_METADATA_KEY = Symbol('trackPerformance');
const TRACK_BUSINESS_METADATA_KEY = Symbol('trackBusiness');
const TRACK_ERRORS_METADATA_KEY = Symbol('trackErrors');

// Decorator options interfaces
export interface MonitorOptions {
  name?: string;
  component?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  trackPerformance?: boolean;
  trackErrors?: boolean;
  trackBusiness?: boolean;
}

export interface PerformanceTrackingOptions {
  operation?: string;
  table?: string;
  cacheType?: string;
  alertThreshold?: number;
}

export interface BusinessTrackingOptions {
  eventType: string;
  extractWorkspaceId?: (args: any[], result?: any) => string;
  extractUserId?: (args: any[], result?: any) => string;
  extractUserRole?: (args: any[], result?: any) => string;
  extractMetadata?: (args: any[], result?: any) => Record<string, any>;
}

export interface ErrorTrackingOptions {
  errorType?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  includeArgs?: boolean;
  includeResult?: boolean;
}

// Global monitoring services (to be injected)
let monitoringServices: {
  applicationMonitoring?: ApplicationMonitoringService;
  performanceMonitoring?: PerformanceMonitoringService;
  businessMetrics?: BusinessMetricsService;
  logger?: Logger;
} = {};

// Service injection function
export function injectMonitoringServices(services: {
  applicationMonitoring: ApplicationMonitoringService;
  performanceMonitoring: PerformanceMonitoringService;
  businessMetrics: BusinessMetricsService;
  logger: Logger;
}): void {
  monitoringServices = services;
}

// Main monitoring decorator
export function Monitor(options: MonitorOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = `${className}.${propertyKey}`;
    
    const config = {
      name: options.name || methodName,
      component: options.component || className,
      logLevel: options.logLevel || 'debug',
      trackPerformance: options.trackPerformance ?? true,
      trackErrors: options.trackErrors ?? true,
      trackBusiness: options.trackBusiness ?? false,
      ...options,
    };

    // Store metadata
    Reflect.defineMetadata(MONITOR_METADATA_KEY, config, target, propertyKey);

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const correlationId = monitoringServices.logger?.defaultMeta?.correlationId || 'unknown';
      
      // Log method entry
      monitoringServices.logger?.[config.logLevel](`${config.name} started`, {
        correlationId,
        component: config.component,
        method: methodName,
        args: config.trackBusiness ? args : undefined,
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = (Date.now() - startTime) / 1000;

        // Track performance if enabled
        if (config.trackPerformance && monitoringServices.performanceMonitoring) {
          const perfOptions = Reflect.getMetadata(TRACK_PERFORMANCE_METADATA_KEY, target, propertyKey);
          if (perfOptions) {
            trackMethodPerformance(methodName, duration, perfOptions, args, result);
          }
        }

        // Track business metrics if enabled
        if (config.trackBusiness && monitoringServices.businessMetrics) {
          const businessOptions = Reflect.getMetadata(TRACK_BUSINESS_METADATA_KEY, target, propertyKey);
          if (businessOptions) {
            trackBusinessMetrics(businessOptions, args, result);
          }
        }

        // Log method completion
        monitoringServices.logger?.[config.logLevel](`${config.name} completed`, {
          correlationId,
          component: config.component,
          method: methodName,
          duration,
          success: true,
        });

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;

        // Track errors if enabled
        if (config.trackErrors && monitoringServices.applicationMonitoring) {
          const errorOptions = Reflect.getMetadata(TRACK_ERRORS_METADATA_KEY, target, propertyKey) || {};
          trackMethodError(error as Error, methodName, config.component, errorOptions, args);
        }

        // Log method error
        monitoringServices.logger?.error(`${config.name} failed`, {
          correlationId,
          component: config.component,
          method: methodName,
          duration,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });

        throw error;
      }
    };

    return descriptor;
  };
}

// Performance tracking decorator
export function TrackPerformance(options: PerformanceTrackingOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(TRACK_PERFORMANCE_METADATA_KEY, options, target, propertyKey);
    return descriptor;
  };
}

// Business metrics tracking decorator
export function TrackBusiness(options: BusinessTrackingOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(TRACK_BUSINESS_METADATA_KEY, options, target, propertyKey);
    return descriptor;
  };
}

// Error tracking decorator
export function TrackErrors(options: ErrorTrackingOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(TRACK_ERRORS_METADATA_KEY, options, target, propertyKey);
    return descriptor;
  };
}

// Specific decorators for common use cases

// Database operation decorator
export function TrackDatabaseOperation(operation: string, table?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const performanceOptions: PerformanceTrackingOptions = {
      operation,
      table: table || 'unknown',
    };

    const errorOptions: ErrorTrackingOptions = {
      errorType: 'database_error',
      severity: 'high',
      component: 'database',
    };

    Reflect.defineMetadata(TRACK_PERFORMANCE_METADATA_KEY, performanceOptions, target, propertyKey);
    Reflect.defineMetadata(TRACK_ERRORS_METADATA_KEY, errorOptions, target, propertyKey);

    return Monitor({
      component: 'database',
      trackPerformance: true,
      trackErrors: true,
    })(target, propertyKey, descriptor);
  };
}

// Cache operation decorator
export function TrackCacheOperation(cacheType: string = 'default') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const performanceOptions: PerformanceTrackingOptions = {
      cacheType,
    };

    const errorOptions: ErrorTrackingOptions = {
      errorType: 'cache_error',
      severity: 'medium',
      component: 'cache',
    };

    Reflect.defineMetadata(TRACK_PERFORMANCE_METADATA_KEY, performanceOptions, target, propertyKey);
    Reflect.defineMetadata(TRACK_ERRORS_METADATA_KEY, errorOptions, target, propertyKey);

    return Monitor({
      component: 'cache',
      trackPerformance: true,
      trackErrors: true,
    })(target, propertyKey, descriptor);
  };
}

// Business event decorator
export function TrackBusinessEvent(
  eventType: string,
  extractors: {
    workspaceId?: (args: any[], result?: any) => string;
    userId?: (args: any[], result?: any) => string;
    userRole?: (args: any[], result?: any) => string;
    metadata?: (args: any[], result?: any) => Record<string, any>;
  } = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const businessOptions: BusinessTrackingOptions = {
      eventType,
      extractWorkspaceId: extractors.workspaceId,
      extractUserId: extractors.userId,
      extractUserRole: extractors.userRole,
      extractMetadata: extractors.metadata,
    };

    Reflect.defineMetadata(TRACK_BUSINESS_METADATA_KEY, businessOptions, target, propertyKey);

    return Monitor({
      trackBusiness: true,
      trackPerformance: true,
      trackErrors: true,
    })(target, propertyKey, descriptor);
  };
}

// API endpoint decorator
export function TrackApiEndpoint(route?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const businessOptions: BusinessTrackingOptions = {
      eventType: 'api_endpoint_usage',
      extractWorkspaceId: (args) => args[0]?.workspace?.id,
      extractUserId: (args) => args[0]?.user?.id,
      extractUserRole: (args) => args[0]?.user?.role,
      extractMetadata: (args) => ({
        route: route || propertyKey,
        method: args[0]?.method,
      }),
    };

    const errorOptions: ErrorTrackingOptions = {
      errorType: 'api_error',
      severity: 'medium',
      component: 'api',
      includeArgs: false,
    };

    Reflect.defineMetadata(TRACK_BUSINESS_METADATA_KEY, businessOptions, target, propertyKey);
    Reflect.defineMetadata(TRACK_ERRORS_METADATA_KEY, errorOptions, target, propertyKey);

    return Monitor({
      component: 'api',
      trackPerformance: true,
      trackBusiness: true,
      trackErrors: true,
    })(target, propertyKey, descriptor);
  };
}

// Helper functions for tracking

function trackMethodPerformance(
  methodName: string,
  duration: number,
  options: PerformanceTrackingOptions,
  args: any[],
  result: any
): void {
  if (!monitoringServices.performanceMonitoring) return;

  if (options.operation && options.table) {
    // Database operation
    monitoringServices.performanceMonitoring.trackDatabaseQuery(
      options.operation,
      options.table,
      duration,
      true
    );
  } else if (options.cacheType) {
    // Cache operation
    const operation = methodName.toLowerCase().includes('get') ? 'get' :
                     methodName.toLowerCase().includes('set') ? 'set' :
                     methodName.toLowerCase().includes('delete') ? 'delete' : 'unknown';
    
    monitoringServices.performanceMonitoring.trackCacheOperation(
      operation,
      options.cacheType,
      duration
    );
  }

  // Check alert threshold
  if (options.alertThreshold && duration > options.alertThreshold / 1000) {
    monitoringServices.logger?.warn('Method performance threshold exceeded', {
      methodName,
      duration,
      threshold: options.alertThreshold,
      args: args.length,
    });
  }
}

function trackBusinessMetrics(
  options: BusinessTrackingOptions,
  args: any[],
  result: any
): void {
  if (!monitoringServices.businessMetrics) return;

  try {
    const workspaceId = options.extractWorkspaceId?.(args, result);
    const userId = options.extractUserId?.(args, result);
    const userRole = options.extractUserRole?.(args, result);
    const metadata = options.extractMetadata?.(args, result) || {};

    switch (options.eventType) {
      case 'task_created':
        if (workspaceId) {
          monitoringServices.businessMetrics.trackTaskCreated(
            workspaceId,
            metadata.projectId || 'unknown',
            metadata.priority || 'medium',
            userRole || 'unknown'
          );
        }
        break;

      case 'task_completed':
        if (workspaceId) {
          monitoringServices.businessMetrics.trackTaskCompleted(
            workspaceId,
            metadata.projectId || 'unknown',
            metadata.priority || 'medium',
            metadata.completionMethod || 'manual',
            metadata.completionTimeHours
          );
        }
        break;

      case 'project_created':
        if (workspaceId) {
          monitoringServices.businessMetrics.trackProjectCreated(
            workspaceId,
            metadata.templateUsed || false,
            userRole || 'unknown'
          );
        }
        break;

      case 'user_login':
        monitoringServices.businessMetrics.trackUserLogin(
          metadata.method || 'password',
          metadata.success !== false,
          workspaceId
        );
        break;

      case 'feature_usage':
        if (workspaceId && userRole) {
          monitoringServices.businessMetrics.trackFeatureUsage(
            metadata.featureName || 'unknown',
            workspaceId,
            userRole,
            metadata.platform || 'web'
          );
        }
        break;

      case 'api_endpoint_usage':
        if (workspaceId && userRole) {
          monitoringServices.businessMetrics.trackApiEndpointUsage(
            metadata.route || 'unknown',
            metadata.method || 'GET',
            workspaceId,
            userRole
          );
        }
        break;

      default:
        // Generic feature usage tracking
        if (workspaceId && userRole) {
          monitoringServices.businessMetrics.trackFeatureUsage(
            options.eventType,
            workspaceId,
            userRole,
            metadata.platform || 'unknown'
          );
        }
    }
  } catch (error) {
    monitoringServices.logger?.error('Failed to track business metrics', {
      eventType: options.eventType,
      error: (error as Error).message,
    });
  }
}

function trackMethodError(
  error: Error,
  methodName: string,
  component: string,
  options: ErrorTrackingOptions,
  args: any[]
): void {
  if (!monitoringServices.applicationMonitoring) return;

  const context: Record<string, any> = {
    methodName,
  };

  if (options.includeArgs) {
    context.args = args;
  }

  monitoringServices.applicationMonitoring.trackError(
    error,
    options.errorType || 'method_error',
    options.severity || 'medium',
    options.component || component,
    context
  );
}

// Class decorator for automatic monitoring
export function MonitorClass(options: MonitorOptions = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const className = constructor.name;
    
    // Get all method names
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype)
      .filter(name => name !== 'constructor' && typeof prototype[name] === 'function');

    // Apply monitoring to all methods
    methodNames.forEach(methodName => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (descriptor && descriptor.value) {
        const monitoredDescriptor = Monitor({
          component: className,
          ...options,
        })(prototype, methodName, descriptor);
        
        Object.defineProperty(prototype, methodName, monitoredDescriptor);
      }
    });

    return constructor;
  };
}

export {
    BusinessTrackingOptions,
    ErrorTrackingOptions, MonitorOptions,
    PerformanceTrackingOptions
};
