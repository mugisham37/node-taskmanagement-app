import {
  ApplicationMonitoringService,
  BusinessMetricsService,
  DistributedTracingService,
  injectMonitoringServices,
  PerformanceMonitoringService,
  StructuredLogger
} from '@taskmanagement/observability';

export interface WebMonitoringConfig {
  enabled: boolean;
  environment: string;
  version: string;
  apiEndpoint: string;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserTracking: boolean;
  enableWebVitals: boolean;
  sampleRate: number;
}

export class WebMonitoringService {
  private static instance: WebMonitoringService | null = null;
  
  private structuredLogger: StructuredLogger;
  private businessMetrics: BusinessMetricsService;
  private performanceMonitoring: PerformanceMonitoringService;
  private applicationMonitoring: ApplicationMonitoringService;
  private distributedTracing: DistributedTracingService;
  private config: WebMonitoringConfig;

  private constructor(config: Partial<WebMonitoringConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_MONITORING === 'true',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      apiEndpoint: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableUserTracking: true,
      enableWebVitals: true,
      sampleRate: parseFloat(process.env.NEXT_PUBLIC_MONITORING_SAMPLE_RATE || '1.0'),
      ...config,
    };

    this.initializeServices();
  }

  public static getInstance(config?: Partial<WebMonitoringConfig>): WebMonitoringService {
    if (!WebMonitoringService.instance) {
      WebMonitoringService.instance = new WebMonitoringService(config);
    }
    return WebMonitoringService.instance;
  }

  private initializeServices(): void {
    if (!this.config.enabled) {
      console.log('Monitoring disabled');
      return;
    }

    // Initialize structured logger for browser
    this.structuredLogger = new StructuredLogger({
      service: 'taskmanagement-web',
      version: this.config.version,
      environment: this.config.environment,
      level: this.config.environment === 'development' ? 'debug' : 'info',
      enableConsole: true,
      enableFile: false, // No file logging in browser
    });

    // Initialize distributed tracing
    this.distributedTracing = new DistributedTracingService({
      serviceName: 'taskmanagement-web',
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
        prefix: 'taskmanagement_web',
        alertThresholds: {
          httpResponseTime: 2000, // Higher threshold for web requests
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
        enabled: this.config.enableUserTracking,
        prefix: 'taskmanagement_web_business',
      }
    );

    // Initialize application monitoring
    this.applicationMonitoring = new ApplicationMonitoringService(
      { getLogger: () => this.structuredLogger.getLogger() } as any,
      this.businessMetrics,
      this.performanceMonitoring,
      {
        enabled: this.config.enableErrorTracking,
        applicationName: 'taskmanagement-web',
        version: this.config.version,
        environment: this.config.environment,
        healthCheckInterval: 60000, // Less frequent for web
        errorThreshold: 0.05,
        dependencies: ['api', 'websocket'],
      }
    );

    // Inject services for decorators
    injectMonitoringServices({
      applicationMonitoring: this.applicationMonitoring,
      performanceMonitoring: this.performanceMonitoring,
      businessMetrics: this.businessMetrics,
      logger: this.structuredLogger.getLogger(),
    });

    // Setup browser-specific monitoring
    this.setupBrowserMonitoring();

    console.log('Web monitoring initialized', {
      environment: this.config.environment,
      version: this.config.version,
      sampleRate: this.config.sampleRate,
    });
  }

  private setupBrowserMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Track page views
    this.trackPageView();

    // Track Web Vitals
    if (this.config.enableWebVitals) {
      this.setupWebVitals();
    }

    // Track unhandled errors
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }

    // Track performance
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking();
    }

    // Track user interactions
    if (this.config.enableUserTracking) {
      this.setupUserTracking();
    }
  }

  private trackPageView(): void {
    const url = window.location.pathname + window.location.search;
    
    this.structuredLogger.logUserAction(
      'anonymous', // Will be updated when user logs in
      'page_view',
      url,
      undefined,
      {
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }
    );

    // Track in business metrics
    this.businessMetrics.trackFeatureUsage(
      'page_view',
      'unknown', // Will be updated when workspace is known
      'anonymous',
      'web'
    );
  }

  private setupWebVitals(): void {
    // Dynamic import to avoid SSR issues
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => this.reportWebVital(metric));
      getFID((metric) => this.reportWebVital(metric));
      getFCP((metric) => this.reportWebVital(metric));
      getLCP((metric) => this.reportWebVital(metric));
      getTTFB((metric) => this.reportWebVital(metric));
    }).catch(error => {
      console.warn('Failed to load web-vitals', error);
    });
  }

  private reportWebVital(metric: any): void {
    this.structuredLogger.logPerformanceMetric(
      `web_vital_${metric.name.toLowerCase()}`,
      metric.value,
      'web_vitals',
      {
        id: metric.id,
        rating: metric.rating,
        navigationType: metric.navigationType,
      }
    );

    // Track performance alert if needed
    const thresholds: Record<string, number> = {
      CLS: 0.1,
      FID: 100,
      FCP: 1800,
      LCP: 2500,
      TTFB: 800,
    };

    if (metric.value > thresholds[metric.name]) {
      this.applicationMonitoring.trackError(
        new Error(`Poor ${metric.name} performance: ${metric.value}`),
        'performance_issue',
        'medium',
        'web_vitals',
        {
          metric: metric.name,
          value: metric.value,
          threshold: thresholds[metric.name],
          rating: metric.rating,
        }
      );
    }
  }

  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.applicationMonitoring.trackError(
        event.error || new Error(event.message),
        'javascript_error',
        'high',
        'global_handler',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          url: window.location.href,
        }
      );
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.applicationMonitoring.trackError(
        new Error(event.reason?.message || 'Unhandled promise rejection'),
        'promise_rejection',
        'high',
        'global_handler',
        {
          reason: event.reason,
          url: window.location.href,
        }
      );
    });
  }

  private setupPerformanceTracking(): void {
    // Track navigation timing
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          
          if (navigation) {
            this.performanceMonitoring.trackHttpRequest(
              'GET',
              window.location.pathname,
              200, // Assume success for page load
              navigation.loadEventEnd - navigation.fetchStart,
              undefined,
              undefined,
              navigator.userAgent
            );

            // Track specific timing metrics
            const timings = {
              dns: navigation.domainLookupEnd - navigation.domainLookupStart,
              tcp: navigation.connectEnd - navigation.connectStart,
              request: navigation.responseStart - navigation.requestStart,
              response: navigation.responseEnd - navigation.responseStart,
              dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              load: navigation.loadEventEnd - navigation.loadEventStart,
            };

            Object.entries(timings).forEach(([name, duration]) => {
              this.structuredLogger.logPerformanceMetric(
                `navigation_${name}`,
                duration,
                'navigation_timing',
                { url: window.location.href }
              );
            });
          }
        }, 0);
      });
    }
  }

  private setupUserTracking(): void {
    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Track button clicks
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const button = target.tagName === 'BUTTON' ? target : target.closest('button')!;
        const action = button.getAttribute('data-action') || 'button_click';
        const label = button.textContent?.trim() || button.getAttribute('aria-label') || 'unknown';
        
        this.trackUserInteraction('click', action, {
          element: 'button',
          label,
          className: button.className,
        });
      }

      // Track link clicks
      if (target.tagName === 'A' || target.closest('a')) {
        const link = target.tagName === 'A' ? target : target.closest('a')!;
        const href = link.getAttribute('href');
        
        this.trackUserInteraction('click', 'link_click', {
          element: 'link',
          href,
          text: link.textContent?.trim(),
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      const formName = form.getAttribute('name') || form.id || 'unknown';
      
      this.trackUserInteraction('submit', 'form_submit', {
        element: 'form',
        formName,
        action: form.action,
      });
    });
  }

  // Public methods for manual tracking

  public trackUserInteraction(type: string, action: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) return;

    this.structuredLogger.logUserAction(
      this.getCurrentUserId(),
      action,
      type,
      this.getCurrentWorkspaceId(),
      metadata
    );

    // Track in business metrics
    const workspaceId = this.getCurrentWorkspaceId();
    const userRole = this.getCurrentUserRole();
    
    if (workspaceId && userRole) {
      this.businessMetrics.trackFeatureUsage(
        action,
        workspaceId,
        userRole,
        'web'
      );
    }
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
      duration / 1000, // Convert to seconds
      requestSize,
      responseSize,
      navigator.userAgent
    );

    // Track API usage in business metrics
    const workspaceId = this.getCurrentWorkspaceId();
    const userRole = this.getCurrentUserRole();
    
    if (workspaceId && userRole) {
      this.businessMetrics.trackApiEndpointUsage(
        endpoint,
        method,
        workspaceId,
        userRole
      );
    }
  }

  public trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.applicationMonitoring.trackError(
      error,
      'manual_error',
      'medium',
      'user_action',
      {
        url: window.location.href,
        userId: this.getCurrentUserId(),
        workspaceId: this.getCurrentWorkspaceId(),
        ...context,
      }
    );
  }

  public trackBusinessEvent(
    eventType: string,
    workspaceId: string,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled) return;

    this.structuredLogger.logBusinessEvent(
      eventType,
      workspaceId,
      userId || this.getCurrentUserId(),
      metadata
    );

    // Track specific business events
    switch (eventType) {
      case 'task_created':
        this.businessMetrics.trackTaskCreated(
          workspaceId,
          metadata?.projectId || 'unknown',
          metadata?.priority || 'medium',
          this.getCurrentUserRole() || 'unknown'
        );
        break;
      
      case 'task_completed':
        this.businessMetrics.trackTaskCompleted(
          workspaceId,
          metadata?.projectId || 'unknown',
          metadata?.priority || 'medium',
          metadata?.completionMethod || 'manual',
          metadata?.completionTimeHours
        );
        break;
      
      case 'project_created':
        this.businessMetrics.trackProjectCreated(
          workspaceId,
          metadata?.templateUsed || false,
          this.getCurrentUserRole() || 'unknown'
        );
        break;
    }
  }

  public setUserContext(userId: string, workspaceId?: string, userRole?: string): void {
    this.structuredLogger.setContext({
      userId,
      workspaceId,
      userRole,
    });

    // Track login event
    if (workspaceId) {
      this.businessMetrics.trackUserLogin('web', true, workspaceId);
    }
  }

  public clearUserContext(): void {
    this.structuredLogger.setContext({
      userId: undefined,
      workspaceId: undefined,
      userRole: undefined,
    });
  }

  // Helper methods
  private getCurrentUserId(): string {
    return this.structuredLogger.getContext()?.userId || 'anonymous';
  }

  private getCurrentWorkspaceId(): string | undefined {
    return this.structuredLogger.getContext()?.workspaceId;
  }

  private getCurrentUserRole(): string | undefined {
    return this.structuredLogger.getContext()?.userRole;
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

  public getConfig(): WebMonitoringConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const webMonitoring = WebMonitoringService.getInstance();

// Export React hooks for easy integration
export function useMonitoring() {
  return {
    trackUserInteraction: webMonitoring.trackUserInteraction.bind(webMonitoring),
    trackApiCall: webMonitoring.trackApiCall.bind(webMonitoring),
    trackError: webMonitoring.trackError.bind(webMonitoring),
    trackBusinessEvent: webMonitoring.trackBusinessEvent.bind(webMonitoring),
    setUserContext: webMonitoring.setUserContext.bind(webMonitoring),
    clearUserContext: webMonitoring.clearUserContext.bind(webMonitoring),
  };
}

export default WebMonitoringService;