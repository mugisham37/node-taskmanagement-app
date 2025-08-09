import { DatabaseConnection } from './connection';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  connections?: {
    total: number;
    active: number;
    idle: number;
  };
  error?: string;
  timestamp: Date;
}

export class DatabaseHealthChecker {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  public async checkHealth(): Promise<DatabaseHealthStatus> {
    const timestamp = new Date();

    try {
      // Basic connectivity check
      const healthResult = await this.connection.healthCheck();

      if (healthResult.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          error: 'Database connection failed',
          timestamp,
        };
      }

      // Get connection information
      const connectionInfo = await this.connection.getConnectionInfo();

      // Determine status based on latency and connection usage
      let status: 'healthy' | 'degraded' = 'healthy';

      if (healthResult.latency && healthResult.latency > 1000) {
        status = 'degraded'; // High latency
      }

      if (
        connectionInfo.activeConnections >
        connectionInfo.totalConnections * 0.8
      ) {
        status = 'degraded'; // High connection usage
      }

      return {
        status,
        latency: healthResult.latency,
        connections: {
          total: connectionInfo.totalConnections,
          active: connectionInfo.activeConnections,
          idle: connectionInfo.idleConnections,
        },
        timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error:
          error instanceof Error ? error.message : 'Unknown database error',
        timestamp,
      };
    }
  }

  public async performDeepHealthCheck(): Promise<DatabaseHealthStatus> {
    const basicHealth = await this.checkHealth();

    if (basicHealth.status === 'unhealthy') {
      return basicHealth;
    }

    try {
      // Perform more comprehensive checks
      const db = this.connection.db;

      // Check if we can perform basic operations on each table
      const tableChecks = await Promise.all([
        db.select().from(schema.users).limit(1),
        db.select().from(schema.workspaces).limit(1),
        db.select().from(schema.projects).limit(1),
        db.select().from(schema.tasks).limit(1),
      ]);

      return {
        ...basicHealth,
        status: 'healthy',
      };
    } catch (error) {
      return {
        ...basicHealth,
        status: 'degraded',
        error: `Deep health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Import schema for deep health checks
import * as schema from './schema';
