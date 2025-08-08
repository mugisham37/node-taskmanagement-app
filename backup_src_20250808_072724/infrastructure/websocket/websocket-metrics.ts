import { logger } from '@/infrastructure/logging/logger';

export interface WebSocketMetricsData {
  connections: {
    total: number;
    active: number;
    established: number;
    closed: number;
    errors: number;
  };
  messages: {
    sent: number;
    received: number;
    errors: number;
    broadcasts: number;
    directMessages: number;
  };
  performance: {
    averageConnectionTime: number;
    averageMessageLatency: number;
    throughput: number;
  };
  resources: {
    memoryUsage: number;
    connectionPoolSize: number;
  };
  timestamps: {
    startTime: number;
    lastUpdate: number;
  };
}

export class WebSocketMetrics {
  private metrics: WebSocketMetricsData;
  private connectionTimes: number[] = [];
  private messageLatencies: number[] = [];
  private throughputSamples: number[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();

    // Start periodic metrics collection
    this.startMetricsCollection();

    logger.info('WebSocket metrics initialized');
  }

  /**
   * Initialize metrics data structure
   */
  private initializeMetrics(): WebSocketMetricsData {
    return {
      connections: {
        total: 0,
        active: 0,
        established: 0,
        closed: 0,
        errors: 0,
      },
      messages: {
        sent: 0,
        received: 0,
        errors: 0,
        broadcasts: 0,
        directMessages: 0,
      },
      performance: {
        averageConnectionTime: 0,
        averageMessageLatency: 0,
        throughput: 0,
      },
      resources: {
        memoryUsage: 0,
        connectionPoolSize: 0,
      },
      timestamps: {
        startTime: this.startTime,
        lastUpdate: Date.now(),
      },
    };
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updatePerformanceMetrics();
      this.updateResourceMetrics();
      this.metrics.timestamps.lastUpdate = Date.now();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Record connection established
   */
  recordConnectionEstablished(connectionTime: number): void {
    this.metrics.connections.established++;
    this.metrics.connections.active++;
    this.metrics.connections.total++;

    this.connectionTimes.push(connectionTime);

    // Keep only last 1000 connection times
    if (this.connectionTimes.length > 1000) {
      this.connectionTimes.shift();
    }

    logger.debug('Connection established recorded', {
      connectionTime,
      totalConnections: this.metrics.connections.total,
      activeConnections: this.metrics.connections.active,
    });
  }

  /**
   * Record connection closed
   */
  recordConnectionClosed(): void {
    this.metrics.connections.closed++;
    this.metrics.connections.active = Math.max(
      0,
      this.metrics.connections.active - 1
    );

    logger.debug('Connection closed recorded', {
      closedConnections: this.metrics.connections.closed,
      activeConnections: this.metrics.connections.active,
    });
  }

  /**
   * Record connection error
   */
  recordConnectionError(): void {
    this.metrics.connections.errors++;
    this.metrics.connections.active = Math.max(
      0,
      this.metrics.connections.active - 1
    );

    logger.debug('Connection error recorded', {
      connectionErrors: this.metrics.connections.errors,
      activeConnections: this.metrics.connections.active,
    });
  }

  /**
   * Record message sent
   */
  recordMessageSent(latency?: number): void {
    this.metrics.messages.sent++;

    if (latency !== undefined) {
      this.messageLatencies.push(latency);

      // Keep only last 1000 latencies
      if (this.messageLatencies.length > 1000) {
        this.messageLatencies.shift();
      }
    }

    logger.debug('Message sent recorded', {
      messagesSent: this.metrics.messages.sent,
      latency,
    });
  }

  /**
   * Record message received
   */
  recordMessageReceived(): void {
    this.metrics.messages.received++;

    logger.debug('Message received recorded', {
      messagesReceived: this.metrics.messages.received,
    });
  }

  /**
   * Record message error
   */
  recordMessageError(): void {
    this.metrics.messages.errors++;

    logger.debug('Message error recorded', {
      messageErrors: this.metrics.messages.errors,
    });
  }

  /**
   * Record broadcast message
   */
  recordBroadcast(recipientCount: number): void {
    this.metrics.messages.broadcasts++;
    this.metrics.messages.sent += recipientCount;

    logger.debug('Broadcast recorded', {
      broadcasts: this.metrics.messages.broadcasts,
      recipientCount,
    });
  }

  /**
   * Record direct message
   */
  recordDirectMessage(): void {
    this.metrics.messages.directMessages++;
    this.metrics.messages.sent++;

    logger.debug('Direct message recorded', {
      directMessages: this.metrics.messages.directMessages,
    });
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Calculate average connection time
    if (this.connectionTimes.length > 0) {
      const sum = this.connectionTimes.reduce((a, b) => a + b, 0);
      this.metrics.performance.averageConnectionTime =
        sum / this.connectionTimes.length;
    }

    // Calculate average message latency
    if (this.messageLatencies.length > 0) {
      const sum = this.messageLatencies.reduce((a, b) => a + b, 0);
      this.metrics.performance.averageMessageLatency =
        sum / this.messageLatencies.length;
    }

    // Calculate throughput (messages per second)
    const currentThroughput = this.calculateThroughput();
    this.throughputSamples.push(currentThroughput);

    // Keep only last 60 samples (30 minutes of data)
    if (this.throughputSamples.length > 60) {
      this.throughputSamples.shift();
    }

    if (this.throughputSamples.length > 0) {
      const sum = this.throughputSamples.reduce((a, b) => a + b, 0);
      this.metrics.performance.throughput = sum / this.throughputSamples.length;
    }
  }

  /**
   * Calculate current throughput
   */
  private calculateThroughput(): number {
    const now = Date.now();
    const timeWindow = 30000; // 30 seconds
    const windowStart = now - timeWindow;

    // This is a simplified calculation
    // In a real implementation, you'd track message timestamps
    const recentMessages =
      this.metrics.messages.sent + this.metrics.messages.received;
    return (recentMessages / timeWindow) * 1000; // messages per second
  }

  /**
   * Update resource metrics
   */
  private updateResourceMetrics(): void {
    const memoryUsage = process.memoryUsage();
    this.metrics.resources.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.resources.connectionPoolSize = this.metrics.connections.active;
  }

  /**
   * Get current metrics
   */
  getMetrics(): WebSocketMetricsData {
    return {
      ...this.metrics,
      timestamps: {
        ...this.metrics.timestamps,
        lastUpdate: Date.now(),
      },
    };
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    uptime: number;
    connectionsPerMinute: number;
    messagesPerMinute: number;
    errorRate: number;
    averageLatency: number;
  } {
    const now = Date.now();
    const uptimeMs = now - this.startTime;
    const uptimeMinutes = uptimeMs / 60000;

    const connectionsPerMinute =
      uptimeMinutes > 0 ? this.metrics.connections.total / uptimeMinutes : 0;

    const totalMessages =
      this.metrics.messages.sent + this.metrics.messages.received;
    const messagesPerMinute =
      uptimeMinutes > 0 ? totalMessages / uptimeMinutes : 0;

    const totalOperations = this.metrics.connections.total + totalMessages;
    const totalErrors =
      this.metrics.connections.errors + this.metrics.messages.errors;
    const errorRate =
      totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    return {
      uptime: uptimeMs,
      connectionsPerMinute,
      messagesPerMinute,
      errorRate,
      averageLatency: this.metrics.performance.averageMessageLatency,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.connectionTimes = [];
    this.messageLatencies = [];
    this.throughputSamples = [];
    this.startTime = Date.now();

    logger.info('WebSocket metrics reset');
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    prometheus: string;
    json: WebSocketMetricsData;
  } {
    const prometheusMetrics = this.generatePrometheusMetrics();

    return {
      prometheus: prometheusMetrics,
      json: this.getMetrics(),
    };
  }

  /**
   * Generate Prometheus-format metrics
   */
  private generatePrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const timestamp = Date.now();

    return `
# HELP websocket_connections_total Total number of WebSocket connections
# TYPE websocket_connections_total counter
websocket_connections_total ${metrics.connections.total} ${timestamp}

# HELP websocket_connections_active Current number of active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active ${metrics.connections.active} ${timestamp}

# HELP websocket_connections_established_total Total number of established connections
# TYPE websocket_connections_established_total counter
websocket_connections_established_total ${metrics.connections.established} ${timestamp}

# HELP websocket_connections_closed_total Total number of closed connections
# TYPE websocket_connections_closed_total counter
websocket_connections_closed_total ${metrics.connections.closed} ${timestamp}

# HELP websocket_connections_errors_total Total number of connection errors
# TYPE websocket_connections_errors_total counter
websocket_connections_errors_total ${metrics.connections.errors} ${timestamp}

# HELP websocket_messages_sent_total Total number of messages sent
# TYPE websocket_messages_sent_total counter
websocket_messages_sent_total ${metrics.messages.sent} ${timestamp}

# HELP websocket_messages_received_total Total number of messages received
# TYPE websocket_messages_received_total counter
websocket_messages_received_total ${metrics.messages.received} ${timestamp}

# HELP websocket_messages_errors_total Total number of message errors
# TYPE websocket_messages_errors_total counter
websocket_messages_errors_total ${metrics.messages.errors} ${timestamp}

# HELP websocket_broadcasts_total Total number of broadcast messages
# TYPE websocket_broadcasts_total counter
websocket_broadcasts_total ${metrics.messages.broadcasts} ${timestamp}

# HELP websocket_direct_messages_total Total number of direct messages
# TYPE websocket_direct_messages_total counter
websocket_direct_messages_total ${metrics.messages.directMessages} ${timestamp}

# HELP websocket_connection_time_avg Average connection establishment time in milliseconds
# TYPE websocket_connection_time_avg gauge
websocket_connection_time_avg ${metrics.performance.averageConnectionTime} ${timestamp}

# HELP websocket_message_latency_avg Average message latency in milliseconds
# TYPE websocket_message_latency_avg gauge
websocket_message_latency_avg ${metrics.performance.averageMessageLatency} ${timestamp}

# HELP websocket_throughput Messages per second
# TYPE websocket_throughput gauge
websocket_throughput ${metrics.performance.throughput} ${timestamp}

# HELP websocket_memory_usage_mb Memory usage in megabytes
# TYPE websocket_memory_usage_mb gauge
websocket_memory_usage_mb ${metrics.resources.memoryUsage} ${timestamp}
`.trim();
  }
}
