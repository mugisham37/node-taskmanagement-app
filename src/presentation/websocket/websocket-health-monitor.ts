import { WebSocketConnection } from './websocket-connection';
import { WebSocketConnectionManager } from './websocket-connection-manager';
import { logger } from '@/infrastructure/logging/logger';

export interface HealthStatus {
  healthy: boolean;
  timestamp: string;
  connections: {
    total: number;
    active: number;
    stale: number;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface WebSocketServerConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxConnections: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export class WebSocketHealthMonitor {
  private connectionManager: WebSocketConnectionManager;
  private config: WebSocketServerConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private connectionPings: Map<string, number> = new Map();
  private healthMetrics = {
    responseTimes: [] as number[],
    errorCount: 0,
    totalRequests: 0,
    throughputSamples: [] as number[],
  };

  constructor(
    connectionManager: WebSocketConnectionManager,
    config: WebSocketServerConfig
  ) {
    this.connectionManager = connectionManager;
    this.config = config;

    this.startMonitoring();
    logger.info('WebSocket health monitor initialized');
  }

  /**
   * Start health monitoring
   */
  private startMonitoring(): void {
    // Start ping interval
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.heartbeatInterval);

    // Start metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, 10000); // Collect metrics every 10 seconds
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('WebSocket health monitor stopped');
  }

  /**
   * Monitor a specific connection
   */
  monitorConnection(connection: WebSocketConnection): void {
    const connectionId = connection.getId();
    this.connectionPings.set(connectionId, Date.now());

    logger.debug('Started monitoring WebSocket connection', {
      connectionId,
      userId: connection.getUser().id,
    });
  }

  /**
   * Stop monitoring a specific connection
   */
  stopMonitoring(connectionId: string): void {
    this.connectionPings.delete(connectionId);

    logger.debug('Stopped monitoring WebSocket connection', {
      connectionId,
    });
  }

  /**
   * Record pong response
   */
  recordPong(connectionId: string): void {
    const pingTime = this.connectionPings.get(connectionId);
    if (pingTime) {
      const responseTime = Date.now() - pingTime;
      this.healthMetrics.responseTimes.push(responseTime);

      // Keep only last 100 response times
      if (this.healthMetrics.responseTimes.length > 100) {
        this.healthMetrics.responseTimes.shift();
      }

      logger.debug('Recorded pong response', {
        connectionId,
        responseTime,
      });
    }
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const connections = this.connectionManager.getAllConnections();
    let healthyConnections = 0;
    let staleConnections = 0;

    for (const connection of connections) {
      if (connection.isConnectionAlive()) {
        // Send ping
        connection.ping();
        this.connectionPings.set(connection.getId(), Date.now());
        healthyConnections++;
      } else {
        staleConnections++;
      }
    }

    logger.debug('Health check completed', {
      total: connections.length,
      healthy: healthyConnections,
      stale: staleConnections,
    });
  }

  /**
   * Collect performance metrics
   */
  private collectMetrics(): void {
    const connections = this.connectionManager.getAllConnections();

    // Calculate throughput (messages per second)
    const currentThroughput = this.calculateThroughput();
    this.healthMetrics.throughputSamples.push(currentThroughput);

    // Keep only last 60 samples (10 minutes of data)
    if (this.healthMetrics.throughputSamples.length > 60) {
      this.healthMetrics.throughputSamples.shift();
    }

    logger.debug('Metrics collected', {
      connections: connections.length,
      throughput: currentThroughput,
      errorRate: this.getErrorRate(),
    });
  }

  /**
   * Calculate current throughput
   */
  private calculateThroughput(): number {
    // This would typically track actual message counts
    // For now, we'll estimate based on connection activity
    const activeConnections = this.connectionManager.getActiveConnectionCount();
    return activeConnections * 0.1; // Rough estimate
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const connections = this.connectionManager.getAllConnections();
    const connectionInfo = this.connectionManager.getConnectionInfo();

    const staleConnections = connections.filter(
      conn => !conn.isConnectionAlive()
    ).length;
    const activeConnections = connections.length - staleConnections;

    const averageResponseTime = this.getAverageResponseTime();
    const errorRate = this.getErrorRate();
    const throughput = this.getAverageThroughput();

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const healthy = this.determineHealthStatus(
      activeConnections,
      staleConnections,
      errorRate,
      averageResponseTime
    );

    return {
      healthy,
      timestamp: new Date().toISOString(),
      connections: {
        total: connectionInfo.totalConnections,
        active: activeConnections,
        stale: staleConnections,
      },
      performance: {
        averageResponseTime,
        errorRate,
        throughput,
      },
      resources: {
        memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000, // ms
      },
    };
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    if (this.healthMetrics.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.healthMetrics.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.healthMetrics.responseTimes.length;
  }

  /**
   * Get error rate
   */
  private getErrorRate(): number {
    if (this.healthMetrics.totalRequests === 0) {
      return 0;
    }

    return (
      (this.healthMetrics.errorCount / this.healthMetrics.totalRequests) * 100
    );
  }

  /**
   * Get average throughput
   */
  private getAverageThroughput(): number {
    if (this.healthMetrics.throughputSamples.length === 0) {
      return 0;
    }

    const sum = this.healthMetrics.throughputSamples.reduce((a, b) => a + b, 0);
    return sum / this.healthMetrics.throughputSamples.length;
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(
    activeConnections: number,
    staleConnections: number,
    errorRate: number,
    averageResponseTime: number
  ): boolean {
    // Health criteria
    const maxErrorRate = 5; // 5%
    const maxResponseTime = 5000; // 5 seconds
    const maxStaleRatio = 0.1; // 10% stale connections

    // Check error rate
    if (errorRate > maxErrorRate) {
      logger.warn('Health check failed: high error rate', { errorRate });
      return false;
    }

    // Check response time
    if (averageResponseTime > maxResponseTime) {
      logger.warn('Health check failed: high response time', {
        averageResponseTime,
      });
      return false;
    }

    // Check stale connection ratio
    const totalConnections = activeConnections + staleConnections;
    if (totalConnections > 0) {
      const staleRatio = staleConnections / totalConnections;
      if (staleRatio > maxStaleRatio) {
        logger.warn('Health check failed: too many stale connections', {
          staleConnections,
          totalConnections,
          staleRatio,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Record error for metrics
   */
  recordError(): void {
    this.healthMetrics.errorCount++;
    this.healthMetrics.totalRequests++;
  }

  /**
   * Record successful request for metrics
   */
  recordSuccess(): void {
    this.healthMetrics.totalRequests++;
  }

  /**
   * Get detailed connection health
   */
  getConnectionHealth(): Array<{
    connectionId: string;
    userId: string;
    isAlive: boolean;
    lastPing: number;
    responseTime?: number;
  }> {
    const connections = this.connectionManager.getAllConnections();

    return connections.map(connection => {
      const connectionId = connection.getId();
      const lastPing = this.connectionPings.get(connectionId) || 0;
      const responseTime = lastPing > 0 ? Date.now() - lastPing : undefined;

      return {
        connectionId,
        userId: connection.getUser().id,
        isAlive: connection.isConnectionAlive(),
        lastPing,
        responseTime,
      };
    });
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.healthMetrics = {
      responseTimes: [],
      errorCount: 0,
      totalRequests: 0,
      throughputSamples: [],
    };

    logger.info('Health metrics reset');
  }
}
