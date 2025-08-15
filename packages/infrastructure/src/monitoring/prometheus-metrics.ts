import {
    Counter,
    Gauge,
    Histogram,
    Summary,
    collectDefaultMetrics,
    register,
} from 'prom-client';
import { MetricsService } from './interfaces';

export interface PrometheusMetricsConfig {
  enableDefaultMetrics: boolean;
  defaultMetricsInterval: number;
  prefix: string;
  labels: Record<string, string>;
}

export class PrometheusMetricsService implements MetricsService {
  readonly name = 'prometheus-metrics';
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private gauges = new Map<string, Gauge>();
  private summaries = new Map<string, Summary>();

  constructor(private readonly config: PrometheusMetricsConfig) {
    this.initialize();
  }

  private initialize(): void {
    // Clear existing metrics
    register.clear();

    // Enable default metrics if configured
    if (this.config.enableDefaultMetrics) {
      collectDefaultMetrics({
        prefix: this.config.prefix,
        labels: this.config.labels,
      });
    }

    // Create application-specific metrics
    this.createApplicationMetrics();
  }

  private createApplicationMetrics(): void {
    // HTTP request metrics
    this.createCounter('http_requests_total', 'Total number of HTTP requests', [
      'method',
      'route',
      'status_code',
    ]);
    this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'route'],
      [0.1, 0.5, 1, 2, 5, 10]
    );

    // Database metrics
    this.createCounter(
      'database_operations_total',
      'Total number of database operations',
      ['operation', 'table', 'status']
    );
    this.createHistogram(
      'database_operation_duration_seconds',
      'Database operation duration in seconds',
      ['operation', 'table'],
      [0.01, 0.05, 0.1, 0.5, 1, 2]
    );

    // Cache metrics
    this.createCounter(
      'cache_operations_total',
      'Total number of cache operations',
      ['operation', 'status']
    );
    this.createHistogram(
      'cache_operation_duration_seconds',
      'Cache operation duration in seconds',
      ['operation'],
      [0.001, 0.005, 0.01, 0.05, 0.1]
    );

    // Error metrics
    this.createCounter('errors_total', 'Total number of errors', [
      'type',
      'severity',
    ]);

    // Performance metrics
    this.createHistogram(
      'operation_duration_seconds',
      'Operation duration in seconds',
      ['operation'],
      [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    );
    this.createGauge('memory_usage_bytes', 'Memory usage in bytes', ['type']);
  }

  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1
  ): void {
    const counter = this.getOrCreateCounter(name);
    if (counter) {
      counter.inc({ ...this.config.labels, ...labels }, value);
    }
  }

  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const histogram = this.getOrCreateHistogram(name);
    if (histogram) {
      histogram.observe({ ...this.config.labels, ...labels }, value);
    }
  }

  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const gauge = this.getOrCreateGauge(name);
    if (gauge) {
      gauge.set({ ...this.config.labels, ...labels }, value);
    }
  }

  async recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): Promise<void> {
    // Try to determine metric type based on name patterns
    if (name.includes('_total') || name.includes('_count')) {
      this.incrementCounter(name, labels, value);
    } else if (
      name.includes('_duration') ||
      name.includes('_time') ||
      name.includes('_latency')
    ) {
      this.observeHistogram(name, value, labels);
    } else {
      this.setGauge(name, value, labels);
    }
  }

  async getMetrics(): Promise<string> {
    // Update memory usage before returning metrics
    this.updateMemoryUsage();
    return await register.metrics();
  }

  async getMetricsAsJSON(): Promise<any> {
    return await register.getMetricsAsJSON();
  }

  clearMetrics(): void {
    register.clear();
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.summaries.clear();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.getMetrics();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const isHealthy = await this.isHealthy();
    return {
      healthy: isHealthy,
      metricsCount: {
        counters: this.counters.size,
        histograms: this.histograms.size,
        gauges: this.gauges.size,
        summaries: this.summaries.size,
      },
    };
  }

  private createCounter(name: string, help: string, labels: string[] = []): Counter {
    const fullName = `${this.config.prefix}${name}`;

    if (this.counters.has(fullName)) {
      return this.counters.get(fullName)!;
    }

    const counter = new Counter({
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    });

    this.counters.set(fullName, counter);
    return counter;
  }

  private createHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets?: number[]
  ): Histogram {
    const fullName = `${this.config.prefix}${name}`;

    if (this.histograms.has(fullName)) {
      return this.histograms.get(fullName)!;
    }

    const config: any = {
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    };

    if (buckets !== undefined) {
      config.buckets = buckets;
    }

    const histogram = new Histogram(config);
    this.histograms.set(fullName, histogram);
    return histogram;
  }

  private createGauge(name: string, help: string, labels: string[] = []): Gauge {
    const fullName = `${this.config.prefix}${name}`;

    if (this.gauges.has(fullName)) {
      return this.gauges.get(fullName)!;
    }

    const gauge = new Gauge({
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    });

    this.gauges.set(fullName, gauge);
    return gauge;
  }

  private getOrCreateCounter(name: string): Counter | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.counters.get(fullName) || this.createCounter(name, `Counter for ${name}`);
  }

  private getOrCreateHistogram(name: string): Histogram | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.histograms.get(fullName) || this.createHistogram(name, `Histogram for ${name}`);
  }

  private getOrCreateGauge(name: string): Gauge | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.gauges.get(fullName) || this.createGauge(name, `Gauge for ${name}`);
  }

  private updateMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.setGauge('memory_usage_bytes', memUsage.heapUsed, {
      type: 'heap_used',
    });
    this.setGauge('memory_usage_bytes', memUsage.heapTotal, {
      type: 'heap_total',
    });
    this.setGauge('memory_usage_bytes', memUsage.external, {
      type: 'external',
    });
    this.setGauge('memory_usage_bytes', memUsage.rss, { type: 'rss' });
  }
}