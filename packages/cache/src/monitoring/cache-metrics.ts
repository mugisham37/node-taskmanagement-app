export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  lastUpdated: Date;
}

export interface CacheOperation {
  type: 'get' | 'set' | 'delete' | 'clear' | 'evict';
  key?: string;
  success: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

export class CacheMetricsCollector {
  private metrics: CacheMetrics;
  private operations: CacheOperation[] = [];
  private maxOperationHistory: number;

  constructor(maxOperationHistory: number = 1000) {
    this.maxOperationHistory = maxOperationHistory;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      missRate: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      keyCount: 0,
      lastUpdated: new Date()
    };
  }

  recordOperation(operation: CacheOperation): void {
    this.operations.push(operation);
    
    // Maintain operation history size
    if (this.operations.length > this.maxOperationHistory) {
      this.operations.shift();
    }

    this.updateMetrics(operation);
  }

  private updateMetrics(operation: CacheOperation): void {
    this.metrics.totalRequests++;
    this.metrics.lastUpdated = new Date();

    if (!operation.success) {
      this.metrics.errors++;
      return;
    }

    switch (operation.type) {
      case 'get':
        if (operation.success) {
          this.metrics.hits++;
        } else {
          this.metrics.misses++;
        }
        break;
      case 'set':
        this.metrics.sets++;
        break;
      case 'delete':
        this.metrics.deletes++;
        break;
      case 'evict':
        this.metrics.evictions++;
        break;
    }

    // Update calculated metrics
    this.updateCalculatedMetrics();
  }

  private updateCalculatedMetrics(): void {
    const totalGets = this.metrics.hits + this.metrics.misses;
    
    if (totalGets > 0) {
      this.metrics.hitRate = (this.metrics.hits / totalGets) * 100;
      this.metrics.missRate = (this.metrics.misses / totalGets) * 100;
    }

    // Calculate average response time from recent operations
    const recentOps = this.operations.slice(-100); // Last 100 operations
    if (recentOps.length > 0) {
      const totalTime = recentOps.reduce((sum, op) => sum + op.responseTime, 0);
      this.metrics.averageResponseTime = totalTime / recentOps.length;
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  getRecentOperations(count: number = 10): CacheOperation[] {
    return this.operations.slice(-count);
  }

  getOperationsByType(type: CacheOperation['type']): CacheOperation[] {
    return this.operations.filter(op => op.type === type);
  }

  getErrorOperations(): CacheOperation[] {
    return this.operations.filter(op => !op.success);
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.operations = [];
  }

  updateMemoryUsage(memoryUsage: number): void {
    this.metrics.memoryUsage = memoryUsage;
  }

  updateKeyCount(keyCount: number): void {
    this.metrics.keyCount = keyCount;
  }

  // Performance analysis methods
  getPerformanceReport(): {
    summary: CacheMetrics;
    trends: {
      hourlyHitRate: number[];
      hourlyResponseTime: number[];
      errorRate: number;
    };
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Analyze hit rate
    if (this.metrics.hitRate < 70) {
      recommendations.push('Consider increasing cache TTL or warming more data');
    }

    // Analyze response time
    if (this.metrics.averageResponseTime > 10) {
      recommendations.push('Cache response time is high, consider optimizing cache provider');
    }

    // Analyze error rate
    const errorRate = (this.metrics.errors / this.metrics.totalRequests) * 100;
    if (errorRate > 5) {
      recommendations.push('High error rate detected, check cache provider health');
    }

    // Analyze memory usage (if available)
    if (this.metrics.memoryUsage > 0.8) {
      recommendations.push('Memory usage is high, consider increasing cache size or reducing TTL');
    }

    return {
      summary: this.getMetrics(),
      trends: {
        hourlyHitRate: this.calculateHourlyHitRate(),
        hourlyResponseTime: this.calculateHourlyResponseTime(),
        errorRate
      },
      recommendations
    };
  }

  private calculateHourlyHitRate(): number[] {
    // Simplified implementation - in production, you'd track this over time
    return Array(24).fill(this.metrics.hitRate);
  }

  private calculateHourlyResponseTime(): number[] {
    // Simplified implementation - in production, you'd track this over time
    return Array(24).fill(this.metrics.averageResponseTime);
  }
}

export class CacheHealthMonitor {
  private metricsCollector: CacheMetricsCollector;
  private healthThresholds: {
    minHitRate: number;
    maxResponseTime: number;
    maxErrorRate: number;
    maxMemoryUsage: number;
  };

  constructor(
    metricsCollector: CacheMetricsCollector,
    healthThresholds = {
      minHitRate: 70,
      maxResponseTime: 10,
      maxErrorRate: 5,
      maxMemoryUsage: 0.8
    }
  ) {
    this.metricsCollector = metricsCollector;
    this.healthThresholds = healthThresholds;
  }

  checkHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: CacheMetrics;
  } {
    const metrics = this.metricsCollector.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check hit rate
    if (metrics.hitRate < this.healthThresholds.minHitRate) {
      issues.push(`Low hit rate: ${metrics.hitRate.toFixed(2)}%`);
      status = 'warning';
    }

    // Check response time
    if (metrics.averageResponseTime > this.healthThresholds.maxResponseTime) {
      issues.push(`High response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      status = 'warning';
    }

    // Check error rate
    const errorRate = (metrics.errors / metrics.totalRequests) * 100;
    if (errorRate > this.healthThresholds.maxErrorRate) {
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
      status = 'critical';
    }

    // Check memory usage
    if (metrics.memoryUsage > this.healthThresholds.maxMemoryUsage) {
      issues.push(`High memory usage: ${(metrics.memoryUsage * 100).toFixed(2)}%`);
      status = status === 'critical' ? 'critical' : 'warning';
    }

    return { status, issues, metrics };
  }

  startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      const health = this.checkHealth();
      
      if (health.status !== 'healthy') {
        console.warn(`Cache health check: ${health.status}`, {
          issues: health.issues,
          metrics: health.metrics
        });
      }
    }, intervalMs);
  }
}