/**
 * Database Connection Interface
 * Defines the contract for database connection services
 */
export interface IDatabaseConnection {
  /**
   * Initialize the database connection
   */
  initialize(): Promise<void>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;

  /**
   * Check if the connection is healthy
   */
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }>;

  /**
   * Get the database instance
   */
  getDatabase(): any;

  /**
   * Get connection info
   */
  getConnectionInfo(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  }>;
}
