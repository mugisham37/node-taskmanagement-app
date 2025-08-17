import {
  ApplicationMonitoringService,
  BusinessMetricsService,
  DistributedTracingService,
  HealthCheckRegistry,
  injectMonitoringServices,
  PerformanceMonitoringService,
  StructuredLogger
} from '@taskmanagement/observability';

export interface AdminMonitoringConfig {
  enabled: boolean;
  environment: string;
  version: string;
  apiEndpoint: string;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableAdminTracking: boolean;
  enableSystemMonitoring: boolean;
  sampleRate: number;
}

export class AdminMonitoringService {
  private static instance: AdminMonitoringService | null = null;
  
  private structuredLogger: StructuredLogger;
  private businessMetrics: BusinessMetricsService;
  private performanceMonitoring: PerformanceMonitoringService;
  private applicationMonitoring: ApplicationMonitoringService;
  private distributedTracing: DistributedTracingService;
  private healthCheckRegistry: HealthCheckRegistry;
  private config: AdminMonitoringConfig;

  private constructor(config: Partial<AdminMonitoringConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_MONITORING === 'true',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      apiEndpoint: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableAdminTracking: true,
      enableSystemMonitoring: true,
      sampleRate: parseFloat(process.env.NEXT_PUBLIC_MONITORING_SAMPLE_RATE || '1.0'),
      ...config,
    };

    this.initializeServices();
  }

  public static getInstance(config?: Partial<AdminMonitoringConfig>): AdminMonitoringService {
    if (!AdminMonitoringService.instance) {
      AdminMonitoringService.instance = new AdminMonitoringService(config);
    }
    return AdminMonitoringService.instance;
  }

  private initializeServices(): void {
    if (!this.config.enabled) {
      console.log('Admin monitoring disabled');
      return;
    }

    // Initialize structured logger for admin dashboard
    this.structuredLogger = new StructuredLogger({
      service: 'taskmanagement-admin',
      version: this.config.version,
      environment: this.config.environment,
      level: this.config.environment === 'development' ? 'debug' : 'info',
      enableConsole: true,
      enableFile: false, // No file logging in browser
    });

    // Initialize distributed tracing
    this.distributedTracing = new DistributedTracingService({
      serviceName: 'taskmanagement-admin',
      serviceVersion: this.config.version,
      environment: this.config.environment,
      enableJaegerExporter: false, // Browser doesn't export directly to Jaeger
      enableConsoleExporter: this.config.environment === 'development',
      sampleRate: this.config.sampleRate,
      enableHttpInstrumentation: true,
      enableExpressInstrumentation: false,
      enableDatabaseInstrumentation: false,
      enableRedisInstrumentation: false,
    }, this.structuredLogger.getLogger());

    // Initialize performance monitoring
    this.performanceMonitoring = new PerformanceMonitoringService(
      { getLogger: () => this.structuredLogger.getLogger() } as any,
      {
        enabled: this.config.enablePerformanceTracking,
        prefix: 'taskmanagement_admin',
        alertThresholds: {
          httpResponseTime: 2000,
          databaseQueryTime: 1000,
          memoryUsage: 0.90,
          cpuUsage: 0.85,
          errorRate: 0.05,
        },
        samplingRate: this.config.sampleRate,
      }
    );

    // Initialize business metrics
    this.businessMetrics = new BusinessMetricsService(
      { getLogger: () => this.structuredLogger.getLogger() } as any,
      {
        enabled: this.config.enableAdminTracking,
        prefix: 'taskmanagement_admin_business',
      }
    );

    // Initialize application monitoring
    this.applicationMonitoring = new ApplicationMonitoringService(
      { getLogger: () => this.structuredLogger.getLogger() } as any,
      this.businessMetrics,
      this.performanceMonitoring,
      {
        enabled: this.config.enableErrorTracking,
        applicationName: 'taskmanagement-admin',
        version: this.config.version,
        environment: this.config.environment,
        healthCheckInterval: 60000,
        errorThreshold: 0.05,
        dependencies: ['api', 'monitoring-stack'],
      }
    );

    // Initialize health check registry for system monitoring
    this.healthCheckRegistry = new HealthCheckRegistry(
      {
        version: this.config.version,
        environment: this.config.environment,
        defaultTimeout: 5000,
      },
      this.structuredLogger.getLogger()
    );

    // Inject services for decorators
    injectMonitoringServices({
      applicationMonitoring: this.applicationMonitoring,
      performanceMonitoring: this.performanceMonitoring,
      businessMetrics: this.businessMetrics,
      logger: this.structuredLogger.getLogger(),
    });

    // Setup admin-specific monitoring
    this.setupAdminMonitoring();

    console.log('Admin monitoring initialized', {
      environment: this.config.environment,
      version: this.config.version,
      sampleRate: this.config.sampleRate,
    });
  }

  private setupAdminMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Track admin page views
    this.trackAdminPageView();

    // Track admin actions
    if (this.config.enableAdminTracking) {
      this.setupAdminActionTracking();
    }

    // Track system monitoring interactions
    if (this.config.enableSystemMonitoring) {
      this.setupSystemMonitoringTracking();
    }

    // Track performance for admin dashboard
    if (this.config.enablePerformanceTracking) {
      this.setupAdminPerformanceTracking();
    }

    // Track errors specific to admin operations
    if (this.config.enableErrorTracking) {
      this.setupAdminErrorTracking();
    }
  }

  private trackAdminPageView(): void {
    const url = window.location.pathname + window.location.search;
    
    this.structuredLogger.logUserAction(
      this.getCurrentAdminId(),
      'admin_page_view',
      url,
      'admin',
      {
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        adminRole: this.getCurrentAdminRole(),
      }
    );

    // Track admin feature usage
    this.businessMetrics.trackFeatureUsage(
      'admin_page_view',
      'admin',
      this.getCurrentAdminRole() || 'admin',
      'admin_dashboard'
    );
  }

  private setupAdminActionTracking(): void {
    // Track admin-specific actions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Track admin action buttons
      if (target.hasAttribute('data-admin-action')) {
        const action = target.getAttribute('data-admin-action')!;
        const resource = target.getAttribute('data-resource') || 'unknown';
        
        this.trackAdminAction(action, resource, {
          element: target.tagName.toLowerCase(),
          className: target.className,
          text: target.textContent?.trim(),
        });
      }

      // Track user management actions
      if (target.closest('[data-user-management]')) {
        const action = target.getAttribute('data-action') || 'user_interaction';
        const userId = target.getAttribute('data-user-id');
        
        this.trackUserManagementAction(action, userId, {
          adminId: this.getCurrentAdminId(),
          timestamp: new Date().toISOString(),
        });
      }

      // Track system configuration changes
      if (target.closest('[data-system-config]')) {
        const configType = target.getAttribute('data-config-type') || 'unknown';
        const action = target.getAttribute('data-action') || 'config_change';
        
        this.trackSystemConfigAction(action, configType, {
          adminId: this.getCurrentAdminId(),
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private setupSystemMonitoringTracking(): void {
    // Track interactions with monitoring dashboards
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      if (target.closest('[data-monitoring-widget]')) {
        const widgetType = target.getAttribute('data-widget-type') || 'unknown';
        const action = target.getAttribute('data-action') || 'widget_interaction';
        
        this.trackMonitoringInteraction(action, widgetType, {
          adminId: this.getCurrentAdminId(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Track alert acknowledgments
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      if (target.hasAttribute('data-alert-action')) {
        const action = target.getAttribute('data-alert-action')!;
        const alertId = target.getAttribute('data-alert-id');
        const severity = target.getAttribute('data-alert-severity');
        
        this.trackAlertAction(action, alertId, {
          severity,
          adminId: this.getCurrentAdminId(),
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private setupAdminPerformanceTracking(): void {
    // Track dashboard load times
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          
          if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.fetchStart;
            
            this.structuredLogger.logPerformanceMetric(
              'admin_dashboard_load',
              loadTime,
              'admin_performance',
              {
                url: window.location.href,
                adminId: this.getCurrentAdminId(),
              }
            );

            // Alert if admin dashboard is slow
            if (loadTime > 3000) { // 3 seconds threshold for admin dashboard
              this.applicationMonitoring.trackError(
                new Error(`Slow admin dashboard load: ${loadTime}ms`),
                'performance_issue',
                'medium',
                'admin_dashboard',
                {
                  loadTime,
                  url: window.location.href,
                  adminId: this.getCurrentAdminId(),
                }
              );
            }
          }
        }, 0);
      });
    }
  }

  private setupAdminErrorTracking(): void {
    // Enhanced error tracking for admin operations
    window.addEventListener('error', (event) => {
      this.applicationMonitoring.trackError(
        event.error || new Error(event.message),
        'admin_javascript_error',
        'high', // Admin errors are higher priority
        'admin_global_handler',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          url: window.location.href,
          adminId: this.getCurrentAdminId(),
          adminRole: this.getCurrentAdminRole(),
        }
      );
    });

    // Track admin-specific promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.applicationMonitoring.trackError(
        new Error(event.reason?.message || 'Unhandled promise rejection in admin'),
        'admin_promise_rejection',
        'high',
        'admin_global_handler',
        {
          reason: event.reason,
          url: window.location.href,
          adminId: this.getCurrentAdminId(),
          adminRole: this.getCurrentAdminRole(),
        }
      );
    });
  }

  // Public methods for admin-specific tracking

  public trackAdminAction(action: string, resource: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) return;

    this.structuredLogger.logUserAction(
      this.getCurrentAdminId(),
      action,
      resource,
      'admin',
      {
        adminRole: this.getCurrentAdminRole(),
        ...metadata,
      }
    );

    // Track in business metrics
    this.businessMetrics.trackFeatureUsage(
      `admin_${action}`,
      'admin',
      this.getCurrentAdminRole() || 'admin',
      'admin_dashboard'
    );

    // Log security-sensitive actions
    if (this.isSecuritySensitiveAction(action)) {
      this.structuredLogger.logSecurityEvent(
        `admin_${action}`,
        this.getCurrentAdminId(),
        this.getClientIP(),
        navigator.userAgent,
        {
          resource,
          adminRole: this.getCurrentAdminRole(),
          ...metadata,
        }
      );
    }
  }

  public trackUserManagementAction(action: string, targetUserId?: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.structuredLogger.logSecurityEvent(
      `user_management_${action}`,
      this.getCurrentAdminId(),
      this.getClientIP(),
      navigator.userAgent,
      {
        targetUserId,
        adminRole: this.getCurrentAdminRole(),
        ...metadata,
      }
    );

    // Track user management metrics
    this.businessMetrics.trackFeatureUsage(
      `user_management_${action}`,
      'admin',
      this.getCurrentAdminRole() || 'admin',
      'admin_dashboard'
    );
  }

  public trackSystemConfigAction(action: string, configType: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.structuredLogger.logSecurityEvent(
      `system_config_${action}`,
      this.getCurrentAdminId(),
      this.getClientIP(),
      navigator.userAgent,
      {
        configType,
        adminRole: this.getCurrentAdminRole(),
        ...metadata,
      }
    );

    // Track system configuration changes
    this.businessMetrics.trackFeatureUsage(
      `system_config_${action}`,
      'admin',
      this.getCurrentAdminRole() || 'admin',
      'admin_dashboard'
    );
  }

  public trackMonitoringInteraction(action: string, widgetType: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.structuredLogger.logUserAction(
      this.getCurrentAdminId(),
      `monitoring_${action}`,
      widgetType,
      'admin',
      {
        adminRole: this.getCurrentAdminRole(),
        ...metadata,
      }
    );

    // Track monitoring usage
    this.businessMetrics.trackFeatureUsage(
      `monitoring_${action}`,
      'admin',
      this.getCurrentAdminRole() || 'admin',
      'admin_dashboard'
    );
  }

  public trackAlertAction(action: string, alertId?: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.structuredLogger.logUserAction(
      this.getCurrentAdminId(),
      `alert_${action}`,
      'alert_management',
      'admin',
      {
        alertId,
        adminRole: this.getCurrentAdminRole(),
        ...metadata,
      }
    );

    // Track alert management
    this.businessMetrics.trackFeatureUsage(
      `alert_${action}`,
      'admin',
      this.getCurrentAdminRole() || 'admin',
      'admin_dashboard'
    );
  }

  public trackApiCall(
    method: string,
    endpoint: string,
    duration: number,
    statusCode: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    if (!this.config.enabled) return;

    this.performanceMonitoring.trackHttpRequest(
      method,
      endpoint,
      statusCode,
      duration / 1000,
      requestSize,
      responseSize,
      navigator.userAgent
    );

    // Track admin API usage
    this.businessMetrics.trackApiEndpointUsage(
      endpoint,
      method,
      'admin',
      this.getCurrentAdminRole() || 'admin'
    );
  }

  public trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.applicationMonitoring.trackError(
      error,
      'admin_manual_error',
      'high', // Admin errors are high priority
      'admin_action',
      {
        url: window.location.href,
        adminId: this.getCurrentAdminId(),
        adminRole: this.getCurrentAdminRole(),
        ...context,
      }
    );
  }

  public setAdminContext(adminId: string, adminRole?: string): void {
    this.structuredLogger.setContext({
      userId: adminId,
      workspaceId: 'admin',
      userRole: adminRole || 'admin',
    });

    // Track admin login
    this.businessMetrics.trackUserLogin('admin_dashboard', true, 'admin');
  }

  public clearAdminContext(): void {
    this.structuredLogger.setContext({
      userId: undefined,
      workspaceId: undefined,
      userRole: undefined,
    });
  }

  // Helper methods
  private getCurrentAdminId(): string {
    return this.structuredLogger.getContext()?.userId || 'anonymous_admin';
  }

  private getCurrentAdminRole(): string | undefined {
    return this.structuredLogger.getContext()?.userRole;
  }

  private getClientIP(): string {
    // In a real implementation, this would get the client IP
    // For browser context, this is limited
    return 'unknown';
  }

  private isSecuritySensitiveAction(action: string): boolean {
    const sensitiveActions = [
      'user_create',
      'user_delete',
      'user_role_change',
      'system_config_change',
      'security_setting_change',
      'permission_grant',
      'permission_revoke',
      'admin_create',
      'admin_delete',
    ];
    
    return sensitiveActions.includes(action);
  }

  // Getters for services
  public getLogger(): StructuredLogger {
    return this.structuredLogger;
  }

  public getBusinessMetrics(): BusinessMetricsService {
    return this.businessMetrics;
  }

  public getPerformanceMonitoring(): PerformanceMonitoringService {
    return this.performanceMonitoring;
  }

  public getApplicationMonitoring(): ApplicationMonitoringService {
    return this.applicationMonitoring;
  }

  public getDistributedTracing(): DistributedTracingService {
    return this.distributedTracing;
  }

  public getHealthCheckRegistry(): HealthCheckRegistry {
    return this.healthCheckRegistry;
  }

  public getConfig(): AdminMonitoringConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const adminMonitoring = AdminMonitoringService.getInstance();

// Export React hooks for admin dashboard
export function useAdminMonitoring() {
  return {
    trackAdminAction: adminMonitoring.trackAdminAction.bind(adminMonitoring),
    trackUserManagementAction: adminMonitoring.trackUserManagementAction.bind(adminMonitoring),
    trackSystemConfigAction: adminMonitoring.trackSystemConfigAction.bind(adminMonitoring),
    trackMonitoringInteraction: adminMonitoring.trackMonitoringInteraction.bind(adminMonitoring),
    trackAlertAction: adminMonitoring.trackAlertAction.bind(adminMonitoring),
    trackApiCall: adminMonitoring.trackApiCall.bind(adminMonitoring),
    trackError: adminMonitoring.trackError.bind(adminMonitoring),
    setAdminContext: adminMonitoring.setAdminContext.bind(adminMonitoring),
    clearAdminContext: adminMonitoring.clearAdminContext.bind(adminMonitoring),
  };
}

export default AdminMonitoringService;