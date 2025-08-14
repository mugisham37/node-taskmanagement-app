import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { IDatabaseConnection } from './database-connection-interface';

export type DatabaseSchema = typeof schema;
export type Database = NodePgDatabase<DatabaseSchema>;

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
  ssl?: boolean;
}

export class DatabaseConnection implements IDatabaseConnection {
  private static instance: DatabaseConnection;
  private _db: Database | null = null;
  private _pool: Pool | null = null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      if (!config) {
        throw new Error(
          'Database configuration is required for first initialization'
        );
      }
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  public static get currentInstance(): DatabaseConnection | null {
    return DatabaseConnection.instance;
  }

  public async initialize(): Promise<void> {
    await this.connect();
  }

  public async connect(): Promise<void> {
    if (this._db && this._pool) {
      return; // Already connected
    }

    try {
      // Create connection pool
      this._pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.maxConnections || 20,
        idleTimeoutMillis: (this.config.idleTimeout || 20) * 1000,
        connectionTimeoutMillis: (this.config.connectionTimeout || 10) * 1000,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      });

      // Create Drizzle instance with pool
      this._db = drizzle(this._pool, { schema });

      // Test connection
      const client = await this._pool.connect();
      await client.query('SELECT 1');
      client.release();

      console.log('Database connection established successfully');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await this.close();
  }

  public async close(): Promise<void> {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
      this._db = null;
      console.log('Database connection closed');
    }
  }

  public get db() {
    return this.getDatabase();
  }

  public getDatabase() {
    if (!this._db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this._db;
  }

  public get pool() {
    if (!this._pool) {
      throw new Error('Database pool not available. Call connect() first.');
    }
    return this._pool;
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
  }> {
    try {
      const start = Date.now();
      const client = await this._pool!.connect();
      await client.query('SELECT 1');
      client.release();
      const latency = Date.now() - start;

      return { status: 'healthy', latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  public async getConnectionInfo(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  }> {
    try {
      const client = await this._pool!.connect();
      const result = await client.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      client.release();

      return {
        totalConnections: Number(result.rows[0].total_connections),
        activeConnections: Number(result.rows[0].active_connections),
        idleConnections: Number(result.rows[0].idle_connections),
      };
    } catch (error) {
      console.error('Failed to get connection info:', error);
      throw error;
    }
  }
}

// Factory function for easier usage
export function createDatabaseConnection(
  config: DatabaseConfig
): DatabaseConnection {
  return DatabaseConnection.getInstance(config);
}

// Export database instance getter
export function getDatabase() {
  const instance = DatabaseConnection.currentInstance;
  if (!instance) {
    throw new Error('Database connection not initialized. Call getInstance(config) first.');
  }
  return instance.db;
}

// Export db instance getter function (compatibility)
export function getDbInstance() {
  return getDatabase();
}
