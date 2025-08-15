/**
 * Monitoring service interfaces
 */

/**
 * Base monitoring service interface
 */
export interface MonitoringService {
  readonly name: string;
  isHealthy(): Promise<boolean>;
  getHealthStatus(): Promise<Record<string, any>>;
}

/**
 * Logging service interface
 */
export interface LoggingService extends MonitoringService {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
  child(context: LogContext): LoggingService;
  flush(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Log context interface
 */
export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  operation?: string;
  resource?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * Structured log interface
 */
export interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memory: number;
    cpu: number;
  };
}

/**
 * Metrics service interface
 */
export interface MetricsService extends MonitoringService {
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value?: number
  ): void;
  observeHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void;
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
  recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): Promise<void>;
  getMetrics(): Promise<string>;
  getMetricsAsJSON(): Promise<any>;
  clearMetrics(): void;
}

/**
 * Health check service interface
 */
export interface HealthCheckService extends MonitoringService {
  checkHealth(): Promise<SystemHealth>;
  checkReadiness(): Promise<boolean>;
  checkLiveness(): Promise<boolean>;
  registerHealthCheck(name: string, check: HealthCheck): void;
  unregisterHealthCheck(name: string): void;
  startPeriodicChecks(): void;
  stopPeriodicChecks(): void;
}

/**
 * Health check function type
 */
export type HealthCheck = () => Promise<HealthCheckResult>;

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * System health interface
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  checks: HealthCheckResult[];
  metadata?: Record<string, any>;
}

/**
 * Alerting service interface
 */
export interface AlertingService extends MonitoringService {
  sendAlert(alert: Alert): Promise<boolean>;
  sendBulkAlerts(alerts: Alert[]): Promise<number>;
  createAlertRule(rule: AlertRule): Promise<string>;
  updateAlertRule(ruleId: string, rule: Partial<AlertRule>): Promise<boolean>;
  deleteAlertRule(ruleId: string): Promise<boolean>;
  getActiveAlerts(): Promise<Alert[]>;
}

/**
 * Alert interface
 */
export interface Alert {
  id?: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  channels?: AlertChannel[];
}

/**
 * Alert rule interface
 */
export interface AlertRule {
  id?: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: AlertChannel[];
  metadata?: Record<string, any>;
}

/**
 * Alert channel type
 */
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sms';

/**
 * Tracing service interface
 */
export interface TracingService extends MonitoringService {
  startSpan(name: string, parentSpan?: Span): Span;
  finishSpan(span: Span): void;
  addSpanTag(span: Span, key: string, value: any): void;
  addSpanLog(span: Span, message: string, data?: Record<string, any>): void;
  getActiveSpan(): Span | null;
  injectHeaders(span: Span): Record<string, string>;
  extractSpan(headers: Record<string, string>): Span | null;
}

/**
 * Span interface
 */
export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  tags: Record<string, any>;
  logs: SpanLog[];
  finished: boolean;
}

/**
 * Span log interface
 */
export interface SpanLog {
  timestamp: Date;
  message: string;
  data?: Record<string, any>;
}

/**
 * Error tracking service interface
 */
export interface ErrorTrackingService extends MonitoringService {
  captureError(error: Error, context?: ErrorContext): Promise<string>;
  captureMessage(message: string, level: ErrorLevel, context?: ErrorContext): Promise<string>;
  setUser(user: ErrorUser): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, any>): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  flush(): Promise<boolean>;
}

/**
 * Error context interface
 */
export interface ErrorContext {
  user?: ErrorUser;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: ErrorLevel;
  fingerprint?: string[];
}

/**
 * Error user interface
 */
export interface ErrorUser {
  id: string;
  email?: string;
  username?: string;
  ip?: string;
}

/**
 * Error level type
 */
export type ErrorLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * Breadcrumb interface
 */
export interface Breadcrumb {
  message: string;
  category?: string;
  level?: ErrorLevel;
  timestamp?: Date;
  data?: Record<string, any>;
}

/**
 * Performance monitoring service interface
 */
export interface PerformanceMonitoringService extends MonitoringService {
  startTransaction(name: string, operation: string): Transaction;
  finishTransaction(transaction: Transaction): void;
  recordCustomMetric(name: string, value: number, unit?: string): void;
  recordUserTiming(name: string, duration: number): void;
  recordResourceTiming(resource: ResourceTiming): void;
  setUser(user: ErrorUser): void;
}

/**
 * Transaction interface
 */
export interface Transaction {
  id: string;
  name: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  status?: string;
  tags: Record<string, any>;
  measurements: Record<string, number>;
  finished: boolean;
}

/**
 * Resource timing interface
 */
export interface ResourceTiming {
  name: string;
  duration: number;
  size?: number;
  type?: string;
  startTime: Date;
}