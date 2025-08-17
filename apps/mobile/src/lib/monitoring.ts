import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
    ApplicationMonitoringService,
    BusinessMetricsService,
    DistributedTracingService,
    injectMonitoringServices,
    PerformanceMonitoringService,
    StructuredLogger
} from '@taskmanagement/observability';
import { AppState, AppStateStatus, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export interface MobileMonitoringConfig {
  enabled: boolean;
  environment: string;
  version: string;
  apiEndpoint: string;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserTracking: boolean;
  enableOfflineTracking: boolean;
  enableCrashReporting: boolean;
  enableBatteryTracking: boolean;
  enableNetworkTracking: boolean;
  sampleRate: number;
  offlineStorageKey: string;
}

export interface MobileContext {
  deviceId: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  deviceModel: string;
  isTablet: boolean;
  networkType?: string;
  batteryLevel?: number;
  isLowPowerMode?: boolean;
}

export class MobileMonitoringService {
  private static instance: MobileMonitoringService | null = null;
  
  private structuredLogger: StructuredLogger;
  private businessMetrics: BusinessMetricsService;
  private performanceMonitoring: PerformanceMonitoringService;
  private applicationMonitoring: ApplicationMonitoringService;
  private distributedTracing: DistributedTracingService;
  private config: MobileMonitoringConfig;
  private mobileContext: MobileContext | null = null;
  private offlineEvents: any[] = [];
  private appStateChangeTime: number = Date.now();
  private sessionStartTime: number = Date.now();

  private constructor(config: Partial<MobileMonitoringConfig> = {}) {
    this.config = {
      enabled: __DEV__ ? false : true, // Disabled in development by default
      environment: __DEV__ ? 'development' : 'production',
      version: '1.0.0', // Would come from app.json or build config
      apiEndpoint: 'http://localhost:3001', // Would come from config
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableUserTracking: true,
      enableOfflineTracking: true,
      enableCrashReporting: true,
      enableBatteryTracking: true,
      enableNetworkTracking: true,
      sampleRate: 1.0,
      offlineStorageKey: '@taskmanagement_offline_events',
      ...config,
    };

    this.initializeServices();
  }

  public static getInstance(config?: Partial<MobileMonitoringConfig>): MobileMonitoringService {
    if (!MobileMonitoringService.instance) {
      MobileMonitoringService.instance = new MobileMonitoringService(config);
    }
    return MobileMonitoringService.instance;
  }

  private async initializeServices(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Mobile monitoring disabled');
      return;
    }

    try {
      // Initialize mobile context
      await this.initializeMobileContext();

      // Initialize structured logger for mobile
      this.structuredLogger = new StructuredLogger({
        service: 'taskmanagement-mobile',
        version: this.config.version,
        environment: this.config.environment,
        level: this.config.environment === 'development' ? 'debug' : 'info',
        enableConsole: true,
        enableFile: false, // No file logging on mobile
      });

      // Initialize distributed tracing
      this.distributedTracing = new DistributedTracingService({
        serviceName: 'taskmanagement-mobile',
        serviceVersion: this.config.version,
        environment: this.config.environment,
        enableJaegerExporter: false, // Mobile doesn't export directly to Jaeger
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
          prefix: 'taskmanagement_mobile',
          alertThresholds: {
            httpResponseTime: 5000, // Higher threshold for mobile
            databaseQueryTime: 2000,
            memoryUsage: 0.95, // Mobile has limited memory
            cpuUsage: 0.90,
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
          prefix: 'taskmanagement_mobile_business',
        }
      );

      // Initialize application monitoring
      this.applicationMonitoring = new ApplicationMonitoringService(
        { getLogger: () => this.structuredLogger.getLogger() } as any,
        this.businessMetrics,
        this.performanceMonitoring,
        {
          enabled: this.config.enableErrorTracking,
          applicationName: 'taskmanagement-mobile',
          version: this.config.version,
          environment: this.config.environment,
          healthCheckInterval: 120000, // Less frequent for mobile
          errorThreshold: 0.05,
          dependencies: ['api', 'offline-storage'],
        }
      );

      // Inject services for decorators
      injectMonitoringServices({
        applicationMonitoring: this.applicationMonitoring,
        performanceMonitoring: this.performanceMonitoring,
        businessMetrics: this.businessMetrics,
        logger: this.structuredLogger.getLogger(),
      });

      // Setup mobile-specific monitoring
      await this.setupMobileMonitoring();

      // Load and sync offline events
      if (this.config.enableOfflineTracking) {
        await this.loadOfflineEvents();
        this.setupOfflineSync();
      }

      console.log('Mobile monitoring initialized', {
        environment: this.config.environment,
        version: this.config.version,
        deviceId: this.mobileContext?.deviceId,
        platform: this.mobileContext?.platform,
      });
    } catch (error) {
      console.error('Failed to initialize mobile monitoring:', error);
    }
  }

  private async initializeMobileContext(): Promise<void> {
    try {
      const [
        deviceId,
        systemVersion,
        version,
        buildNumber,
        model,
        isTablet,
      ] = await Promise.all([
        DeviceInfo.getUniqueId(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getVersion(),
        DeviceInfo.getBuildNumber(),
        DeviceInfo.getModel(),
        DeviceInfo.isTablet(),
      ]);

      this.mobileContext = {
        deviceId,
        platform: Platform.OS,
        osVersion: systemVersion,
        appVersion: version,
        buildNumber,
        deviceModel: model,
        isTablet,
      };

      // Get network info
      const netInfo = await NetInfo.fetch();
      this.mobileContext.networkType = netInfo.type;

      // Get battery info (if available)
      try {
        if (Platform.OS === 'ios') {
          // Battery info would be available through native modules
          // For now, we'll skip this on iOS due to App Store restrictions
        } else {
          const batteryLevel = await DeviceInfo.getBatteryLevel();
          this.mobileContext.batteryLevel = batteryLevel;
          
          const isLowPowerMode = await DeviceInfo.isPowerSaveMode();
          this.mobileContext.isLowPowerMode = isLowPowerMode;
        }
      } catch (error) {
        // Battery info not available
      }
    } catch (error) {
      console.error('Failed to initialize mobile context:', error);
    }
  }

  private async setupMobileMonitoring(): Promise<void> {
    // Track app lifecycle events
    this.setupAppStateTracking();

    // Track network changes
    if (this.config.enableNetworkTracking) {
      this.setupNetworkTracking();
    }

    // Track performance
    if (this.config.enablePerformanceTracking) {
      this.setupMobilePerformanceTracking();
    }

    // Track errors and crashes
    if (this.config.enableErrorTracking || this.config.enableCrashReporting) {
      this.setupMobileErrorTracking();
    }

    // Track user interactions
    if (this.config.enableUserTracking) {
      this.setupMobileUserTracking();
    }

    // Track battery changes
    if (this.config.enableBatteryTracking && Platform.OS === 'android') {
      this.setupBatteryTracking();
    }
  }

  private setupAppStateTracking(): void {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const now = Date.now();
      const duration = now - this.appStateChangeTime;

      this.structuredLogger.logUserAction(
        this.getCurrentUserId(),
        'app_state_change',
        nextAppState,
        this.getCurrentWorkspaceId(),
        {
          previousDuration: duration,
          deviceContext: this.mobileContext,
          timestamp: new Date().toISOString(),
        }
      );

      // Track session duration when app goes to background
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        const sessionDuration = (now - this.sessionStartTime) / 1000;
        
        if (sessionDuration > 10) { // Only track sessions longer than 10 seconds
          const workspaceId = this.getCurrentWorkspaceId();
          const userRole = this.getCurrentUserRole();
          
          if (workspaceId && userRole) {
            this.businessMetrics.trackUserSession(sessionDuration, workspaceId, userRole);
          }
        }
      }

      // Reset session start time when app becomes active
      if (nextAppState === 'active') {
        this.sessionStartTime = now;
      }

      this.appStateChangeTime = now;
    });
  }

  private setupNetworkTracking(): void {
    NetInfo.addEventListener(state => {
      this.structuredLogger.logSystemEvent(
        'network_change',
        'network',
        'low',
        {
          type: state.type,
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          details: state.details,
          deviceContext: this.mobileContext,
        }
      );

      // Update mobile context
      if (this.mobileContext) {
        this.mobileContext.networkType = state.type;
      }

      // Sync offline events when network becomes available
      if (state.isConnected && this.config.enableOfflineTracking) {
        this.syncOfflineEvents();
      }
    });
  }

  private setupMobilePerformanceTracking(): void {
    // Track memory warnings (iOS)
    if (Platform.OS === 'ios') {
      // Memory warnings would be tracked through native modules
    }

    // Track JavaScript thread performance
    const trackJSPerformance = () => {
      const start = Date.now();
      
      setTimeout(() => {
        const lag = Date.now() - start;
        
        if (lag > 100) { // More than 100ms lag
          this.structuredLogger.logPerformanceMetric(
            'js_thread_lag',
            lag,
            'mobile_performance',
            {
              deviceContext: this.mobileContext,
            }
          );

          // Alert on severe lag
          if (lag > 1000) {
            this.applicationMonitoring.trackError(
              new Error(`Severe JS thread lag: ${lag}ms`),
              'performance_issue',
              'medium',
              'js_thread',
              {
                lag,
                deviceContext: this.mobileContext,
              }
            );
          }
        }
      }, 0);
    };

    // Check JS performance every 30 seconds
    setInterval(trackJSPerformance, 30000);
  }

  private setupMobileErrorTracking(): void {
    // Global error handler
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.applicationMonitoring.trackError(
        error,
        isFatal ? 'fatal_error' : 'javascript_error',
        isFatal ? 'critical' : 'high',
        'global_handler',
        {
          isFatal,
          deviceContext: this.mobileContext,
          userId: this.getCurrentUserId(),
          workspaceId: this.getCurrentWorkspaceId(),
        }
      );

      // Store offline if no network
      if (this.config.enableOfflineTracking) {
        this.storeOfflineEvent({
          type: 'error',
          error: {
            message: error.message,
            stack: error.stack,
            isFatal,
          },
          deviceContext: this.mobileContext,
          timestamp: new Date().toISOString(),
        });
      }

      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    // Promise rejection handler
    const originalRejectionHandler = require('promise/setimmediate/rejection-tracking').enable;
    
    require('promise/setimmediate/rejection-tracking').enable({
      allRejections: true,
      onUnhandled: (id: string, error: Error) => {
        this.applicationMonitoring.trackError(
          error,
          'unhandled_promise_rejection',
          'high',
          'promise_handler',
          {
            rejectionId: id,
            deviceContext: this.mobileContext,
            userId: this.getCurrentUserId(),
            workspaceId: this.getCurrentWorkspaceId(),
          }
        );
      },
    });
  }

  private setupMobileUserTracking(): void {
    // This would be integrated with React Navigation or other navigation libraries
    // For now, we'll provide methods to be called manually
  }

  private setupBatteryTracking(): void {
    // Track battery level changes (Android only)
    if (Platform.OS === 'android') {
      const checkBattery = async () => {
        try {
          const batteryLevel = await DeviceInfo.getBatteryLevel();
          const isLowPowerMode = await DeviceInfo.isPowerSaveMode();

          if (this.mobileContext) {
            const previousBatteryLevel = this.mobileContext.batteryLevel;
            this.mobileContext.batteryLevel = batteryLevel;
            this.mobileContext.isLowPowerMode = isLowPowerMode;

            // Track significant battery changes
            if (previousBatteryLevel && Math.abs(batteryLevel - previousBatteryLevel) > 0.1) {
              this.structuredLogger.logSystemEvent(
                'battery_change',
                'battery',
                batteryLevel < 0.2 ? 'medium' : 'low',
                {
                  batteryLevel,
                  previousBatteryLevel,
                  isLowPowerMode,
                  deviceContext: this.mobileContext,
                }
              );
            }
          }
        } catch (error) {
          // Battery info not available
        }
      };

      // Check battery every 5 minutes
      setInterval(checkBattery, 300000);
    }
  }

  private async loadOfflineEvents(): Promise<void> {
    try {
      const storedEvents = await AsyncStorage.getItem(this.config.offlineStorageKey);
      if (storedEvents) {
        this.offlineEvents = JSON.parse(storedEvents);
      }
    } catch (error) {
      console.error('Failed to load offline events:', error);
    }
  }

  private async storeOfflineEvent(event: any): Promise<void> {
    try {
      this.offlineEvents.push(event);
      
      // Limit offline events to prevent storage overflow
      if (this.offlineEvents.length > 1000) {
        this.offlineEvents = this.offlineEvents.slice(-500); // Keep last 500 events
      }

      await AsyncStorage.setItem(
        this.config.offlineStorageKey,
        JSON.stringify(this.offlineEvents)
      );
    } catch (error) {
      console.error('Failed to store offline event:', error);
    }
  }

  private setupOfflineSync(): void {
    // Sync offline events when network becomes available
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.syncOfflineEvents();
      }
    });
  }

  private async syncOfflineEvents(): Promise<void> {
    if (this.offlineEvents.length === 0) return;

    try {
      // In a real implementation, this would send events to the server
      console.log(`Syncing ${this.offlineEvents.length} offline events`);

      // Clear offline events after successful sync
      this.offlineEvents = [];
      await AsyncStorage.removeItem(this.config.offlineStorageKey);
    } catch (error) {
      console.error('Failed to sync offline events:', error);
    }
  }

  // Public methods for mobile-specific tracking

  public trackScreenView(screenName: string, params?: Record<string, any>): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) return;

    this.structuredLogger.logUserAction(
      this.getCurrentUserId(),
      'screen_view',
      screenName,
      this.getCurrentWorkspaceId(),
      {
        params,
        deviceContext: this.mobileContext,
        timestamp: new Date().toISOString(),
      }
    );

    // Track in business metrics
    const workspaceId = this.getCurrentWorkspaceId();
    const userRole = this.getCurrentUserRole();
    
    if (workspaceId && userRole) {
      this.businessMetrics.trackFeatureUsage(
        `screen_${screenName}`,
        workspaceId,
        userRole,
        'mobile'
      );
    }

    // Store offline if no network
    if (this.config.enableOfflineTracking) {
      this.storeOfflineEvent({
        type: 'screen_view',
        screenName,
        params,
        deviceContext: this.mobileContext,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public trackUserInteraction(action: string, element: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) return;

    this.structuredLogger.logUserAction(
      this.getCurrentUserId(),
      action,
      element,
      this.getCurrentWorkspaceId(),
      {
        ...metadata,
        deviceContext: this.mobileContext,
        timestamp: new Date().toISOString(),
      }
    );

    // Track in business metrics
    const workspaceId = this.getCurrentWorkspaceId();
    const userRole = this.getCurrentUserRole();
    
    if (workspaceId && userRole) {
      this.businessMetrics.trackFeatureUsage(
        action,
        workspaceId,
        userRole,
        'mobile'
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
      duration / 1000,
      requestSize,
      responseSize,
      `${this.mobileContext?.platform}/${this.mobileContext?.osVersion}`
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
        deviceContext: this.mobileContext,
        userId: this.getCurrentUserId(),
        workspaceId: this.getCurrentWorkspaceId(),
        ...context,
      }
    );

    // Store offline if no network
    if (this.config.enableOfflineTracking) {
      this.storeOfflineEvent({
        type: 'error',
        error: {
          message: error.message,
          stack: error.stack,
        },
        context,
        deviceContext: this.mobileContext,
        timestamp: new Date().toISOString(),
      });
    }
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
      {
        ...metadata,
        deviceContext: this.mobileContext,
      }
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
      this.businessMetrics.trackUserLogin('mobile', true, workspaceId);
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

  // Getters
  public getMobileContext(): MobileContext | null {
    return this.mobileContext;
  }

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

  public getConfig(): MobileMonitoringConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const mobileMonitoring = MobileMonitoringService.getInstance();

// Export React Native hooks
export function useMobileMonitoring() {
  return {
    trackScreenView: mobileMonitoring.trackScreenView.bind(mobileMonitoring),
    trackUserInteraction: mobileMonitoring.trackUserInteraction.bind(mobileMonitoring),
    trackApiCall: mobileMonitoring.trackApiCall.bind(mobileMonitoring),
    trackError: mobileMonitoring.trackError.bind(mobileMonitoring),
    trackBusinessEvent: mobileMonitoring.trackBusinessEvent.bind(mobileMonitoring),
    setUserContext: mobileMonitoring.setUserContext.bind(mobileMonitoring),
    clearUserContext: mobileMonitoring.clearUserContext.bind(mobileMonitoring),
    getMobileContext: mobileMonitoring.getMobileContext.bind(mobileMonitoring),
  };
}

export default MobileMonitoringService;