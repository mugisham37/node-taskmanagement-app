import { Logger } from '@taskmanagement/core';
import postgres from 'postgres';

export interface ConnectionPoolConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  
  // Pool configuration
  max?: number;              // Maximum connections
  min?: number;              // Minimum connections
  idle_timeout?: number;     // Idle timeout in seconds
  connect_timeout?: number;  // Connection timeout in seconds
  max_lifetime?: number;     // Maximum connection lifetime
  
  // Performance settings
  prepare?: boolean;         // Use prepared statements
  transform?: any;           // Column transformations
  debug?: boolean;           // Debug mode
  
  // SSL configuration
  ssl?: boolean | object;
  
  // Read replicas
  readReplicas?: string[];
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  averageQueryTime: number;
}

export class ConnectionPool {
  private writeConnection: postgres.Sql;
  private readConnections: postgres.Sql[] = [];
  private currentReadIndex = 0;
  private stats: ConnectionStats;
  private queryTimes: number[] = [];

  constructor(
    private config: ConnectionPoolConfig,
    private logger: Logger
  ) {
    this.initializeConnections();
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      averageQueryTime: 0,
    };
  }

  private initializeConnections(): void {
    // Primary write connection
    this.writeConnection = postgres({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      username: this.config.username,
      password: this.config.password,
      max: this.config.max || 20,
      idle_timeout: this.config.idle_timeout || 30,
      connect_timeout: this.config.connect_timeout || 30,
      max_lifetime: this.config.max_lifetime || 3600,
      prepare: this.config.prepare !== false,
      transform: {
        // Transform column names from snake_case to camelCase
        column: {
          to: postgres.toCamel,
          from: postgres.fromCamel,
        },
        // Transform values
        value: {
          date: (value: any) => value instanceof Date ? value : new Date(value),
        },
      },
      ssl: this.config.ssl,
      debug: this.config.debug,
      
      // Connection event handlers
      onnotice: (notice) => {
        this.logger.info('PostgreSQL notice', { notice });
      },
      
      onnotify: (channel, payload) => {
        this.logger.info('PostgreSQL notification', { channel, payload });
      },
      
      onclose: (connectionId) => {
        this.logger.info('Connection closed', { connectionId });
        this.updateConnectionStats();
      },
      
      onconnect: (connection) => {
        this.logger.info('New connection established', { 
          connectionId: connection.processID 
        });
        this.updateConnectionStats();
      },
    });

    // Read replica connections
    if (this.config.readReplicas && this.config.readReplicas.length > 0) {
      this.readConnections = this.config.readReplicas.map(replicaUrl => {
        const url = new URL(replicaUrl);
        return postgres({
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1),
          username: url.username,
          password: url.password,
          max: Math.ceil((this.config.max || 20) / this.config.readReplicas!.length),
          idle_timeout: this.config.idle_timeout || 30,
          connect_timeout: this.config.connect_timeout || 30,
          prepare: this.config.prepare !== false,
          transform: this.writeConnection.options.transform,
          ssl: this.config.ssl,
          debug: this.config.debug,
        });
      });
    }
  }

  async getWriteConnection(): Promise<postgres.Sql> {
    return this.writeConnection;
  }

  async getReadConnection(): Promise<postgres.Sql> {
    if (this.readConnections.length === 0) {
      return this.writeConnection;
    }

    // Round-robin load balancing
    const connection = this.readConnections[this.currentReadIndex];
    this.currentReadIndex = (this.currentReadIndex + 1) % this.readConnections.length;
    
    return connection;
  }

  async executeQuery<T>(
    query: postgres.PendingQuery<T[]>,
    options: { useReadReplica?: boolean } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      const connection = options.useReadReplica 
        ? await this.getReadConnection()
        : await this.getWriteConnection();
      
      const result = await connection.unsafe(query.strings.join('?'), query.args);
      
      const executionTime = Date.now() - startTime;
      this.recordQueryTime(executionTime);
      
      return result as T[];
    } catch (error) {
      this.logger.error('Query execution failed', {
        error: error.message,
        query: query.strings.join('?'),
      });
      throw error;
    }
  }

  private recordQueryTime(time: number): void {
    this.queryTimes.push(time);
    this.stats.totalQueries++;
    
    // Keep only last 1000 query times for average calculation
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    this.stats.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  private async updateConnectionStats(): Promise<void> {
    try {
      // Get connection stats from PostgreSQL
      const stats = await this.writeConnection`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_clients
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      if (stats.length > 0) {
        this.stats.totalConnections = parseInt(stats[0].total_connections);
        this.stats.activeConnections = parseInt(stats[0].active_connections);
        this.stats.idleConnections = parseInt(stats[0].idle_connections);
        this.stats.waitingClients = parseInt(stats[0].waiting_clients);
      }
    } catch (error) {
      this.logger.error('Failed to update connection stats', { error: error.message });
    }
  }

  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.writeConnection`SELECT 1`;
      
      // Check read replicas
      for (const readConnection of this.readConnections) {
        await readConnection`SELECT 1`;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.writeConnection.end();
      
      for (const readConnection of this.readConnections) {
        await readConnection.end();
      }
      
      this.logger.info('All database connections closed');
    } catch (error) {
      this.logger.error('Error closing connections', { error: error.message });
    }
  }

  // Connection pool monitoring
  async getPoolMetrics(): Promise<{
    connectionUtilization: number;
    averageWaitTime: number;
    peakConnections: number;
    connectionErrors: number;
  }> {
    const maxConnections = this.config.max || 20;
    const connectionUtilization = (this.stats.activeConnections / maxConnections) * 100;
    
    return {
      connectionUtilization,
      averageWaitTime: this.stats.averageQueryTime,
      peakConnections: this.stats.totalConnections,
      connectionErrors: 0, // Would need to track this separately
    };
  }
}