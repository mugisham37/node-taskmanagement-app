/**
 * Performance monitoring utilities for tracking performance metrics
 * Platform-agnostic performance monitoring
 */

export interface PerformanceMetrics {
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  ip?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export interface SystemMetrics {
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  loadAverage?: number[];
}

// Performance thresholds
export const SLOW_OPERATION_THRESHOLD = 1000; // 1 second
export const VERY_SLOW_OPERATION_THRESHOLD = 5000; // 5 seconds
export const MEMORY_WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB

/**
 * Performance profiler for specific functions
 */
export const profileFunction = <T extends any[], R>(
  fn: (...args: T) => R | Promise<R>,
  name: string,
  logger?: { debug: (msg: string, data?: any) => void; error: (msg: string, data?: any) => void }
) => {
  return async (...args: T): Promise<R> => {
    const startTime = process.hrtime.bigint();
    const startCpuUsage = process.cpuUsage();

    try {
      const result = await Promise.resolve(fn(...args));
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const cpuUsage = process.cpuUsage(startCpuUsage);

      logger?.debug(`Function ${name} executed`, {
        duration: `${duration.toFixed(2)}ms`,
        cpuUser: `${cpuUsage.user}μs`,
        cpuSystem: `${cpuUsage.system}μs`,
      });

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      logger?.error(`Function ${name} failed`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
};

/**
 * Memory usage tracker
 */
export const trackMemoryUsage = (
  label: string,
  logger?: { debug: (msg: string, data?: any) => void }
): void => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    logger?.debug(`Memory usage - ${label}`, {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    });
  }
};

/**
 * Create a performance timer
 */
export const createTimer = (
  label: string,
  logger?: { debug: (msg: string, data?: any) => void }
) => {
  const startTime = typeof performance !== 'undefined' 
    ? performance.now() 
    : Date.now();

  return {
    end: () => {
      const endTime = typeof performance !== 'undefined' 
        ? performance.now() 
        : Date.now();
      const duration = endTime - startTime;
      
      logger?.debug(`Timer ${label}`, { duration: `${duration.toFixed(2)}ms` });
      return duration;
    },
  };
};

/**
 * PerformanceMonitor class for tracking operations
 */
export class PerformanceMonitor {
  private timers = new Map<string, number>();
  private metrics = new Map<string, number[]>();
  private logger?: { debug: (msg: string, data?: any) => void; error: (msg: string, data?: any) => void };

  constructor(logger?: { debug: (msg: string, data?: any) => void; error: (msg: string, data?: any) => void }) {
    this.logger = logger;
  }

  /**
   * Start a timer for an operation
   */
  startTimer(label: string) {
    const startTime = typeof performance !== 'undefined' 
      ? performance.now() 
      : Date.now();
    this.timers.set(label, startTime);

    return {
      end: () => {
        const endTime = typeof performance !== 'undefined' 
          ? performance.now() 
          : Date.now();
        const startTime = this.timers.get(label);
        if (startTime !== undefined) {
          const duration = endTime - startTime;
          this.recordMetric(label, duration);
          this.timers.delete(label);
          return duration;
        }
        return 0;
      }
    };
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values to prevent memory leaks
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length > 0) {
        result[name] = {
          count: values.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: values[values.length - 1]
        };
      }
    }
    
    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.timers.clear();
    this.metrics.clear();
  }

  /**
   * Profile a function
   */
  profile<T extends any[], R>(
    fn: (...args: T) => R | Promise<R>,
    name: string
  ) {
    return profileFunction(fn, name, this.logger);
  }
}

/**
 * Simple performance measurement utilities
 */
export const performanceUtils = {
  /**
   * Measure execution time of a function
   */
  measure: async <T>(
    fn: () => Promise<T> | T,
    label?: string
  ): Promise<{ result: T; duration: number }> => {
    const startTime = typeof performance !== 'undefined' 
      ? performance.now() 
      : Date.now();
    
    const result = await Promise.resolve(fn());
    
    const endTime = typeof performance !== 'undefined' 
      ? performance.now() 
      : Date.now();
    const duration = endTime - startTime;
    
    if (label) {
      console.debug(`${label}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  },

  /**
   * Debounce function calls
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | number;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout as NodeJS.Timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttle function calls
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Batch operations
   */
  batch: <T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> => {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return Promise.all(batches.map(processor)).then(results => 
      results.flat()
    );
  }
};

export default {
  PerformanceMonitor,
  profileFunction,
  trackMemoryUsage,
  createTimer,
  performanceUtils,
  SLOW_OPERATION_THRESHOLD,
  VERY_SLOW_OPERATION_THRESHOLD,
  MEMORY_WARNING_THRESHOLD
};