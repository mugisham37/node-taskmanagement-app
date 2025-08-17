import { context, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Logger } from 'winston';

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  prometheusEndpoint?: string;
  enableConsoleExporter: boolean;
  enableJaegerExporter: boolean;
  enablePrometheusExporter: boolean;
  sampleRate: number;
  enableHttpInstrumentation: boolean;
  enableExpressInstrumentation: boolean;
  enableDatabaseInstrumentation: boolean;
  enableRedisInstrumentation: boolean;
}

export interface SpanOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
  parentSpan?: Span;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

export class DistributedTracingService {
  private sdk?: NodeSDK;
  private tracer: any;
  private config: TracingConfig;
  private logger?: Logger;

  constructor(config: Partial<TracingConfig> = {}, logger?: Logger) {
    this.config = {
      serviceName: process.env.SERVICE_NAME || 'taskmanagement',
      serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      prometheusEndpoint: process.env.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
      enableConsoleExporter: process.env.NODE_ENV === 'development',
      enableJaegerExporter: true,
      enablePrometheusExporter: true,
      sampleRate: parseFloat(process.env.TRACE_SAMPLE_RATE || '1.0'),
      enableHttpInstrumentation: true,
      enableExpressInstrumentation: true,
      enableDatabaseInstrumentation: true,
      enableRedisInstrumentation: true,
      ...config,
    };

    this.logger = logger;
    this.initialize();
  }

  private initialize(): void {
    try {
      // Create resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      });

      // Create exporters
      const exporters: any[] = [];

      if (this.config.enableJaegerExporter && this.config.jaegerEndpoint) {
        exporters.push(
          new JaegerExporter({
            endpoint: this.config.jaegerEndpoint,
          })
        );
      }

      if (this.config.enablePrometheusExporter) {
        exporters.push(
          new PrometheusExporter({
            endpoint: '/metrics',
          })
        );
      }

      // Create span processors
      const spanProcessors = exporters.map(exporter => 
        new BatchSpanProcessor(exporter, {
          maxQueueSize: 1000,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
          maxExportBatchSize: 512,
        })
      );

      // Create instrumentations
      const instrumentations: any[] = [];

      if (this.config.enableHttpInstrumentation) {
        instrumentations.push(
          new HttpInstrumentation({
            requestHook: (span, request) => {
              span.setAttributes({
                'http.request.header.user-agent': request.getHeader?.('user-agent') || 'unknown',
                'http.request.header.x-correlation-id': request.getHeader?.('x-correlation-id') || 'unknown',
              });
            },
            responseHook: (span, response) => {
              span.setAttributes({
                'http.response.header.content-type': response.getHeader?.('content-type') || 'unknown',
              });
            },
          })
        );
      }

      if (this.config.enableExpressInstrumentation) {
        instrumentations.push(
          new ExpressInstrumentation({
            requestHook: (span, info) => {
              span.setAttributes({
                'express.route': info.route || 'unknown',
                'express.method': info.request.method,
              });
            },
          })
        );
      }

      if (this.config.enableDatabaseInstrumentation) {
        instrumentations.push(
          new PgInstrumentation({
            enhancedDatabaseReporting: true,
          })
        );
      }

      if (this.config.enableRedisInstrumentation) {
        instrumentations.push(
          new RedisInstrumentation({
            dbStatementSerializer: (cmdName, cmdArgs) => {
              return `${cmdName} ${cmdArgs.slice(0, 2).join(' ')}`;
            },
          })
        );
      }

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        spanProcessors,
        instrumentations,
      });

      this.sdk.start();

      // Get tracer
      this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);

      this.logger?.info('Distributed tracing initialized', {
        serviceName: this.config.serviceName,
        serviceVersion: this.config.serviceVersion,
        environment: this.config.environment,
        exporters: exporters.length,
        instrumentations: instrumentations.length,
      });
    } catch (error) {
      this.logger?.error('Failed to initialize distributed tracing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  // Span management
  startSpan(options: SpanOptions): Span {
    const span = this.tracer.startSpan(options.name, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes || {},
    }, options.parentSpan ? trace.setSpan(context.active(), options.parentSpan) : undefined);

    // Add common attributes
    span.setAttributes({
      'service.name': this.config.serviceName,
      'service.version': this.config.serviceVersion,
      'deployment.environment': this.config.environment,
    });

    return span;
  }

  finishSpan(span: Span, success: boolean = true, error?: Error): void {
    if (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } else {
      span.setStatus({
        code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });
    }

    span.end();
  }

  // Context management
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  getTraceContext(): TraceContext | null {
    const span = this.getCurrentSpan();
    if (!span) return null;

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: undefined, // Would need to track this separately
    };
  }

  runWithSpan<T>(span: Span, fn: () => T): T {
    return trace.setSpan(context.active(), span).with(fn);
  }

  // High-level tracing methods
  async traceAsyncOperation<T>(
    name: string,
    operation: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.startSpan({
      name,
      attributes,
    });

    try {
      const result = await this.runWithSpan(span, () => operation(span));
      this.finishSpan(span, true);
      return result;
    } catch (error) {
      this.finishSpan(span, false, error as Error);
      throw error;
    }
  }

  traceSyncOperation<T>(
    name: string,
    operation: (span: Span) => T,
    attributes?: Record<string, string | number | boolean>
  ): T {
    const span = this.startSpan({
      name,
      attributes,
    });

    try {
      const result = this.runWithSpan(span, () => operation(span));
      this.finishSpan(span, true);
      return result;
    } catch (error) {
      this.finishSpan(span, false, error as Error);
      throw error;
    }
  }

  // Database operation tracing
  async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    query: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `db.${operation}`,
      async (span) => {
        span.setAttributes({
          'db.operation': operation,
          'db.table': table,
          'db.statement': query.substring(0, 200), // Truncate for security
          'db.system': 'postgresql',
        });

        return fn();
      }
    );
  }

  // HTTP request tracing
  async traceHttpRequest<T>(
    method: string,
    url: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `http.${method.toLowerCase()}`,
      async (span) => {
        span.setAttributes({
          'http.method': method,
          'http.url': url,
          'http.scheme': new URL(url).protocol.slice(0, -1),
          'http.host': new URL(url).host,
        });

        return fn();
      }
    );
  }

  // Cache operation tracing
  async traceCacheOperation<T>(
    operation: string,
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `cache.${operation}`,
      async (span) => {
        span.setAttributes({
          'cache.operation': operation,
          'cache.key': key,
          'cache.system': 'redis',
        });

        return fn();
      }
    );
  }

  // Business operation tracing
  async traceBusinessOperation<T>(
    operation: string,
    workspaceId: string,
    userId?: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `business.${operation}`,
      async (span) => {
        span.setAttributes({
          'business.operation': operation,
          'business.workspace_id': workspaceId,
          'business.user_id': userId || 'unknown',
        });

        return fn();
      }
    );
  }

  // Trace correlation
  injectTraceHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const span = this.getCurrentSpan();
    if (!span) return headers;

    const spanContext = span.spanContext();
    return {
      ...headers,
      'x-trace-id': spanContext.traceId,
      'x-span-id': spanContext.spanId,
    };
  }

  extractTraceFromHeaders(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];

    if (!traceId || !spanId) return null;

    return {
      traceId,
      spanId,
      parentSpanId,
    };
  }

  // Metrics and monitoring
  getTracingMetrics(): Record<string, any> {
    // This would return tracing-specific metrics
    return {
      activeSpans: 0, // Would track active spans
      totalSpans: 0, // Would track total spans created
      exportedSpans: 0, // Would track exported spans
      droppedSpans: 0, // Would track dropped spans
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    try {
      await this.sdk?.shutdown();
      this.logger?.info('Distributed tracing shutdown completed');
    } catch (error) {
      this.logger?.error('Error during tracing shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default DistributedTracingService;