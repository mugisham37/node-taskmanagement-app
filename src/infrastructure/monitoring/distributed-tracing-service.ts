import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { LoggingService, LogContext } from './logging-service';
import { MetricsService } from './metrics-service';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: TraceLog[];
  status: 'ok' | 'error' | 'timeout';
  error?: Error;
}

export interface TraceLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface SpanOptions {
  operationName: string;
  parentSpan?: TraceContext;
  tags?: Record<string, any>;
}

export class DistributedTracingService {
  private activeSpans: Map<string, TraceContext> = new Map();
  private completedSpans: TraceContext[] = [];
  private asyncStorage = new AsyncLocalStorage<TraceContext>();
  private maxCompletedSpans = 10000;

  constructor(
    private readonly loggingService: LoggingService,
    private readonly metricsService: MetricsService
  ) {}

  /**
   * Start a new trace span
   */
  startSpan(options: SpanOptions): TraceContext {
    const parentSpan = options.parentSpan || this.getCurrentSpan();
    const traceId = parentSpan?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: TraceContext = {
      traceId,
      spanId,
      parentSpanId: parentSpan?.spanId,
      operationName: options.operationName,
      startTime: Date.now(),
      tags: { ...options.tags },
      logs: [],
      status: 'ok',
    };

    this.activeSpans.set(spanId, span);
    this.metricsService.incrementCounter('traces_started_total', {
      operation: options.operationName,
    });

    this.loggingService.debug('Trace span started', {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      operationName: span.operationName,
    });

    return span;
  }

  /**
   * Finish a trace span
   */
  finishSpan(span: TraceContext, error?: Error): void {
    const endTime = Date.now();
    span.endTime = endTime;
    span.duration = endTime - span.startTime;

    if (error) {
      span.status = 'error';
      span.error = error;
      span.tags.error = true;
      span.tags.errorMessage = error.message;
      span.tags.errorType = error.constructor.name;
    }

    // Remove from active spans
    this.activeSpans.delete(span.spanId);

    // Add to completed spans
    this.completedSpans.push(span);
    if (this.completedSpans.length > this.maxCompletedSpans) {
      this.completedSpans.shift();
    }

    // Record metrics
    this.metricsService.observeHistogram(
      'trace_duration_seconds',
      span.duration / 1000,
      {
        operation: span.operationName,
        status: span.status,
      }
    );

    this.metricsService.incrementCounter('traces_finished_total', {
      operation: span.operationName,
      status: span.status,
    });

    this.loggingService.debug('Trace span finished', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration,
      status: span.status,
    });
  }

  /**
   * Add a tag to a span
   */
  addTag(span: TraceContext, key: string, value: any): void {
    span.tags[key] = value;
  }

  /**
   * Add a log entry to a span
   */
  addLog(
    span: TraceContext,
    level: TraceLog['level'],
    message: string,
    fields?: Record<string, any>
  ): void {
    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields,
    });
  }

  /**
   * Get the current active span
   */
  getCurrentSpan(): TraceContext | undefined {
    return this.asyncStorage.getStore();
  }

  /**
   * Run a function within a trace span context
   */
  async runWithSpan<T>(
    options: SpanOptions,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(options);

    try {
      const result = await this.asyncStorage.run(span, () => fn(span));
      this.finishSpan(span);
      return result;
    } catch (error) {
      this.finishSpan(span, error as Error);
      throw error;
    }
  }

  /**
   * Run a synchronous function within a trace span context
   */
  runWithSpanSync<T>(options: SpanOptions, fn: (span: TraceContext) => T): T {
    const span = this.startSpan(options);

    try {
      const result = this.asyncStorage.run(span, () => fn(span));
      this.finishSpan(span);
      return result;
    } catch (error) {
      this.finishSpan(span, error as Error);
      throw error;
    }
  }

  /**
   * Create a child span from the current span
   */
  createChildSpan(
    operationName: string,
    tags?: Record<string, any>
  ): TraceContext {
    const parentSpan = this.getCurrentSpan();
    return this.startSpan({
      operationName,
      parentSpan,
      tags,
    });
  }

  /**
   * Extract trace context from HTTP headers
   */
  extractTraceContext(
    headers: Record<string, string>
  ): TraceContext | undefined {
    const traceId = headers['x-trace-id'] || headers['traceid'];
    const spanId = headers['x-span-id'] || headers['spanid'];
    const parentSpanId = headers['x-parent-span-id'] || headers['parentspanid'];

    if (!traceId || !spanId) {
      return undefined;
    }

    return {
      traceId,
      spanId,
      parentSpanId,
      operationName: 'http-request',
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };
  }

  /**
   * Inject trace context into HTTP headers
   */
  injectTraceContext(span: TraceContext): Record<string, string> {
    return {
      'x-trace-id': span.traceId,
      'x-span-id': span.spanId,
      ...(span.parentSpanId && { 'x-parent-span-id': span.parentSpanId }),
    };
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceContext[] {
    return this.completedSpans.filter(span => span.traceId === traceId);
  }

  /**
   * Get all active spans
   */
  getActiveSpans(): TraceContext[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get completed spans
   */
  getCompletedSpans(limit: number = 100): TraceContext[] {
    return this.completedSpans
      .slice(-limit)
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  }

  /**
   * Get spans by operation name
   */
  getSpansByOperation(
    operationName: string,
    limit: number = 100
  ): TraceContext[] {
    return this.completedSpans
      .filter(span => span.operationName === operationName)
      .slice(-limit)
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  }

  /**
   * Get trace statistics
   */
  getTraceStatistics(): {
    activeSpans: number;
    completedSpans: number;
    averageDuration: number;
    errorRate: number;
    operationStats: Record<
      string,
      { count: number; avgDuration: number; errorRate: number }
    >;
  } {
    const operationStats: Record<
      string,
      { count: number; totalDuration: number; errors: number }
    > = {};

    // Calculate operation statistics
    this.completedSpans.forEach(span => {
      if (!operationStats[span.operationName]) {
        operationStats[span.operationName] = {
          count: 0,
          totalDuration: 0,
          errors: 0,
        };
      }

      const stats = operationStats[span.operationName];
      stats.count++;
      stats.totalDuration += span.duration || 0;
      if (span.status === 'error') {
        stats.errors++;
      }
    });

    // Convert to final format
    const finalOperationStats: Record<
      string,
      { count: number; avgDuration: number; errorRate: number }
    > = {};
    Object.entries(operationStats).forEach(([operation, stats]) => {
      finalOperationStats[operation] = {
        count: stats.count,
        avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0,
      };
    });

    const totalSpans = this.completedSpans.length;
    const totalDuration = this.completedSpans.reduce(
      (sum, span) => sum + (span.duration || 0),
      0
    );
    const totalErrors = this.completedSpans.filter(
      span => span.status === 'error'
    ).length;

    return {
      activeSpans: this.activeSpans.size,
      completedSpans: totalSpans,
      averageDuration: totalSpans > 0 ? totalDuration / totalSpans : 0,
      errorRate: totalSpans > 0 ? (totalErrors / totalSpans) * 100 : 0,
      operationStats: finalOperationStats,
    };
  }

  /**
   * Clear completed spans (for memory management)
   */
  clearCompletedSpans(): void {
    this.completedSpans = [];
    this.loggingService.info('Cleared completed trace spans');
  }

  /**
   * Generate a unique trace ID
   */
  private generateTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Generate a unique span ID
   */
  private generateSpanId(): string {
    return randomUUID().replace(/-/g, '').substring(0, 16);
  }
}
