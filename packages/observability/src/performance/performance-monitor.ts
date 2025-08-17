import { EventEmitter } from 'events';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

export interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  startTime: number;
  responseEnd: number;
}

export interface NavigationTiming {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToFirstByte: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private observer: PerformanceObserver | null = null;
  private isMonitoring = false;
  private reportingEndpoint: string | null = null;

  constructor(options: { reportingEndpoint?: string } = {}) {
    super();
    this.reportingEndpoint = options.reportingEndpoint || null;
    
    if (typeof window !== 'undefined') {
      this.initializeBrowserMonitoring();
    }
  }

  private initializeBrowserMonitoring(): void {
    // Initialize Performance Observer for various entry types
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // Observe different types of performance entries
      try {
        this.observer.observe({ entryTypes: ['navigation', 'resource', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (error) {
        console.warn('Some performance entry types not supported:', error);
        // Fallback to supported types
        this.observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
      }
    }

    // Web Vitals monitoring
    this.initializeWebVitals();

    // Custom performance marks
    this.initializeCustomMarks();
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.processNavigationEntry(entry as PerformanceNavigationTiming);
        break;
      case 'resource':
        this.processResourceEntry(entry as PerformanceResourceTiming);
        break;
      case 'paint':
        this.processPaintEntry(entry);
        break;
      case 'largest-contentful-paint':
        this.processLCPEntry(entry);
        break;
      case 'first-input':
        this.processFIDEntry(entry);
        break;
      case 'layout-shift':
        this.processCLSEntry(entry);
        break;
    }
  }

  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    const navigationTiming: NavigationTiming = {
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      firstPaint: 0, // Will be set by paint entries
      firstContentfulPaint: 0, // Will be set by paint entries
      largestContentfulPaint: 0, // Will be set by LCP entries
      firstInputDelay: 0, // Will be set by FID entries
      cumulativeLayoutShift: 0, // Will be calculated from CLS entries
      timeToFirstByte: entry.responseStart - entry.requestStart,
    };

    this.recordMetric('navigation.domContentLoaded', navigationTiming.domContentLoaded, 'ms');
    this.recordMetric('navigation.loadComplete', navigationTiming.loadComplete, 'ms');
    this.recordMetric('navigation.timeToFirstByte', navigationTiming.timeToFirstByte, 'ms');

    this.emit('navigation', navigationTiming);
  }

  private processResourceEntry(entry: PerformanceResourceTiming): void {
    const resourceTiming: ResourceTiming = {
      name: entry.name,
      duration: entry.duration,
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      decodedBodySize: entry.decodedBodySize || 0,
      startTime: entry.startTime,
      responseEnd: entry.responseEnd,
    };

    // Categorize resources
    const resourceType = this.getResourceType(entry.name);
    this.recordMetric(`resource.${resourceType}.duration`, resourceTiming.duration, 'ms', {
      resource: entry.name,
    });

    if (resourceTiming.transferSize > 0) {
      this.recordMetric(`resource.${resourceType}.size`, resourceTiming.transferSize, 'bytes', {
        resource: entry.name,
      });
    }

    this.emit('resource', resourceTiming);
  }

  private processPaintEntry(entry: PerformanceEntry): void {
    this.recordMetric(`paint.${entry.name}`, entry.startTime, 'ms');
    this.emit('paint', { name: entry.name, time: entry.startTime });
  }

  private processLCPEntry(entry: any): void {
    this.recordMetric('webvitals.lcp', entry.startTime, 'ms');
    this.emit('lcp', { value: entry.startTime, element: entry.element });
  }

  private processFIDEntry(entry: any): void {
    this.recordMetric('webvitals.fid', entry.processingStart - entry.startTime, 'ms');
    this.emit('fid', { value: entry.processingStart - entry.startTime });
  }

  private processCLSEntry(entry: any): void {
    if (!entry.hadRecentInput) {
      this.recordMetric('webvitals.cls', entry.value, 'score');
      this.emit('cls', { value: entry.value });
    }
  }

  private initializeWebVitals(): void {
    // This would integrate with web-vitals library
    if (typeof window !== 'undefined' && 'web-vitals' in window) {
      // Import and use web-vitals library
      this.loadWebVitalsLibrary();
    }
  }

  private async loadWebVitalsLibrary(): Promise<void> {
    try {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

      getCLS((metric: WebVitalsMetric) => this.handleWebVital(metric));
      getFID((metric: WebVitalsMetric) => this.handleWebVital(metric));
      getFCP((metric: WebVitalsMetric) => this.handleWebVital(metric));
      getLCP((metric: WebVitalsMetric) => this.handleWebVital(metric));
      getTTFB((metric: WebVitalsMetric) => this.handleWebVital(metric));
    } catch (error) {
      console.warn('Web Vitals library not available:', error);
    }
  }

  private handleWebVital(metric: WebVitalsMetric): void {
    this.recordMetric(`webvitals.${metric.name.toLowerCase()}`, metric.value, 'ms', {
      rating: metric.rating,
      id: metric.id,
    });

    this.emit('webvital', metric);
    
    // Report to analytics
    if (this.reportingEndpoint) {
      this.reportMetric(metric);
    }
  }

  private initializeCustomMarks(): void {
    // Add custom performance marks for application-specific events
    this.mark('app-init');
    
    // Listen for route changes (if using React Router)
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        this.mark('route-change');
      });
    }
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(js|mjs)$/)) return 'script';
    if (url.match(/\.css$/)) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  public recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);
    this.emit('metric', metric);

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  public mark(name: string): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
      this.recordMetric(`mark.${name}`, performance.now(), 'ms');
    }
  }

  public measure(name: string, startMark: string, endMark?: string): number {
    if (typeof performance !== 'undefined' && performance.measure) {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      if (entries.length > 0) {
        const duration = entries[entries.length - 1].duration;
        this.recordMetric(`measure.${name}`, duration, 'ms');
        return duration;
      }
    }
    return 0;
  }

  public getMetrics(filter?: { name?: string; since?: Date }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filter?.name) {
      filtered = filtered.filter(m => m.name.includes(filter.name!));
    }

    if (filter?.since) {
      filtered = filtered.filter(m => m.timestamp >= filter.since!);
    }

    return filtered;
  }

  public getAverageMetric(name: string, since?: Date): number {
    const metrics = this.getMetrics({ name, since });
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  public getPercentile(name: string, percentile: number, since?: Date): number {
    const metrics = this.getMetrics({ name, since });
    if (metrics.length === 0) return 0;

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private async reportMetric(metric: WebVitalsMetric): Promise<void> {
    if (!this.reportingEndpoint) return;

    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          id: metric.id,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.warn('Failed to report performance metric:', error);
    }
  }

  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.mark('monitoring-start');
    this.emit('monitoring-started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.mark('monitoring-stop');
    
    if (this.observer) {
      this.observer.disconnect();
    }

    this.emit('monitoring-stopped');
  }

  public generateReport(): {
    summary: Record<string, number>;
    webVitals: Record<string, number>;
    resources: ResourceTiming[];
    recommendations: string[];
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const summary = {
      totalMetrics: this.metrics.length,
      avgLCP: this.getAverageMetric('webvitals.lcp', oneHourAgo),
      avgFID: this.getAverageMetric('webvitals.fid', oneHourAgo),
      avgCLS: this.getAverageMetric('webvitals.cls', oneHourAgo),
      avgTTFB: this.getAverageMetric('webvitals.ttfb', oneHourAgo),
    };

    const webVitals = {
      lcp: this.getPercentile('webvitals.lcp', 75, oneHourAgo),
      fid: this.getPercentile('webvitals.fid', 75, oneHourAgo),
      cls: this.getPercentile('webvitals.cls', 75, oneHourAgo),
      fcp: this.getPercentile('webvitals.fcp', 75, oneHourAgo),
      ttfb: this.getPercentile('webvitals.ttfb', 75, oneHourAgo),
    };

    const resources: ResourceTiming[] = []; // Would be populated from stored resource timings

    const recommendations = this.generateRecommendations(webVitals);

    return {
      summary,
      webVitals,
      resources,
      recommendations,
    };
  }

  private generateRecommendations(webVitals: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (webVitals.lcp > 2500) {
      recommendations.push('Optimize Largest Contentful Paint: Consider image optimization, preloading critical resources, or improving server response times.');
    }

    if (webVitals.fid > 100) {
      recommendations.push('Improve First Input Delay: Reduce JavaScript execution time, break up long tasks, or use web workers.');
    }

    if (webVitals.cls > 0.1) {
      recommendations.push('Reduce Cumulative Layout Shift: Set dimensions for images and embeds, avoid inserting content above existing content.');
    }

    if (webVitals.ttfb > 600) {
      recommendations.push('Optimize Time to First Byte: Improve server response times, use CDN, or optimize database queries.');
    }

    return recommendations;
  }
}