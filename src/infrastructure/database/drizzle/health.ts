import { db, pool } from './connection';
import { sql } from 'drizzle-orm';

export interface DatabaseHealthMetrics {
  isConnected: boolean;
  connectionCount: number;
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  queryCount: number;
  slowQueries: number;
  averageQueryTime: number;
  databaseSize: string;
  uptime: string;
  version: string;
  lastCheck: Date;
}

export interface ConnectionPoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxPoolSize: number;
}

export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private queryTimes: number[] = [];
  private queryCount = 0;
  private slowQueryThreshold = 1000; // 1 second

  private constructor() {}

  static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  async checkHealth(): Promise<DatabaseHealthMetrics> {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const connectivityTest = await db.execute(sql`SELECT 1 as test`);
      const isConnected = Array.isArray(connectivityTest) && connectivityTest.length > 0;

      // Get database statistics
      const [
        connectionStats,
        databaseStats,
        versionInfo,
        uptimeInfo
      ] = await Promise.all([
        this.getConnectionStats(),
        this.getDatabaseStats(),
        this.getVersionInfo(),
        this.getUptimeInfo()
      ]);

      const queryTime = Date.now() - startTime;
      this.recordQueryTime(queryTime);

      return {
        isConnected,
        connectionCount: connectionStats.totalCount,
        maxConnections: connectionStats.maxPoolSize,
        activeConnections: connectionStats.totalCount - connectionStats.idleCount,
        idleConnections: connectionStats.idleCount,
        waitingConnections: connectionStats.waitingCount,
        queryCount: this.queryCount,
        slowQueries: this.getSlowQueryCount(),
        averageQueryTime: this.getAverageQueryTime(),
        databaseSize: databaseStats.size,
        uptime: uptimeInfo.uptime,
        version: versionInfo.version,
        lastCheck: new Date()
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        isConnected: false,
        connectionCount: 0,
        maxConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingConnections: 0,
        queryCount: this.queryCount,
        slowQueries: this.getSlowQueryCount(),
        averageQueryTime: this.getAverageQueryTime(),
        databaseSize: 'Unknown',
        uptime: 'Unknown',
        version: 'Unknown',
        lastCheck: new Date()
      };
    }
  }

  private async getConnectionStats(): Promise<ConnectionPoolStats> {
    try {
      // Get pool statistics
      const totalCount = pool.totalCount;
      const idleCount = pool.idleCount;
      const waitingCount = pool.waitingCount;
      const maxPoolSize = pool.options.max || 20;

      return {
        totalCount,
        idleCount,
        waitingCount,
        maxPoolSize
      };
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      return {
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
        maxPoolSize: 20
      };
    }
  }

  private async getDatabaseStats(): Promise<{ size: string }> {
    try {
      const result = await db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      
      const rows = result.rows || result;
      return { size: (rows[0] as any)?.size || 'Unknown' };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return { size: 'Unknown' };
    }
  }

  private async getVersionInfo(): Promise<{ version: string }> {
    try {
      const result = await db.execute(sql`SELECT version() as version`);
      const rows = result.rows || result;
      return { version: (rows[0] as any)?.version || 'Unknown' };
    } catch (error) {
      console.error('Failed to get version info:', error);
      return { version: 'Unknown' };
    }
  }

  private async getUptimeInfo(): Promise<{ uptime: string }> {
    try {
      const result = await db.execute(sql`
        SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime
      `);
      const rows = result.rows || result;
      return { uptime: (rows[0] as any)?.uptime || 'Unknown' };
    } catch (error) {
      console.error('Failed to get uptime info:', error);
      return { uptime: 'Unknown' };
    }
  }

  recordQueryTime(time: number): void {
    this.queryCount++;
    this.queryTimes.push(time);
    
    // Keep only last 1000 query times to prevent memory issues
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
  }

  private getAverageQueryTime(): number {
    if (this.queryTimes.length === 0) return 0;
    const sum = this.queryTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.queryTimes.length);
  }

  private getSlowQueryCount(): number {
    return this.queryTimes.filter(time => time > this.slowQueryThreshold).length;
  }

  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }

  async getTableSizes(): Promise<Array<{ table: string; size: string; rows: number }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          tablename as table,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          COALESCE(pg_stat_get_tuples_returned(c.oid), 0) as rows
        FROM pg_tables pt
        LEFT JOIN pg_class c ON c.relname = pt.tablename
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);
      
      const rows = result.rows || result;
      return (rows as any[]).map(row => ({
        table: row.table,
        size: row.size,
        rows: parseInt(row.rows) || 0
      }));
    } catch (error) {
      console.error('Failed to get table sizes:', error);
      return [];
    }
  }

  async getSlowQueries(): Promise<Array<{ query: string; calls: number; mean_time: number }>> {
    try {
      // This requires pg_stat_statements extension
      const result = await db.execute(sql`
        SELECT 
          query,
          calls,
          mean_exec_time as mean_time
        FROM pg_stat_statements 
        WHERE mean_exec_time > ${this.slowQueryThreshold}
        ORDER BY mean_exec_time DESC 
        LIMIT 10
      `);
      
      const rows = result.rows || result;
      return (rows as any[]).map(row => ({
        query: row.query,
        calls: parseInt(row.calls) || 0,
        mean_time: parseFloat(row.mean_time) || 0
      }));
    } catch (error) {
      // pg_stat_statements might not be enabled
      console.warn('pg_stat_statements not available for slow query analysis');
      return [];
    }
  }

  async getIndexUsage(): Promise<Array<{ table: string; index: string; scans: number; usage: string }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          tablename as table,
          indexname as index,
          idx_scan as scans,
          CASE 
            WHEN idx_scan = 0 THEN 'Never used'
            WHEN idx_scan < 100 THEN 'Low usage'
            WHEN idx_scan < 1000 THEN 'Medium usage'
            ELSE 'High usage'
          END as usage
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);
      
      const rows = result.rows || result;
      return (rows as any[]).map(row => ({
        table: row.table,
        index: row.index,
        scans: parseInt(row.scans) || 0,
        usage: row.usage
      }));
    } catch (error) {
      console.error('Failed to get index usage:', error);
      return [];
    }
  }

  async resetStats(): Promise<void> {
    this.queryTimes = [];
    this.queryCount = 0;
  }
}

// Export singleton instance
export const dbHealthMonitor = DatabaseHealthMonitor.getInstance();

// Utility functions
export async function checkDatabaseHealth(): Promise<DatabaseHealthMetrics> {
  return dbHealthMonitor.checkHealth();
}

export async function getDatabaseMetrics(): Promise<{
  health: DatabaseHealthMetrics;
  tableSizes: Array<{ table: string; size: string; rows: number }>;
  slowQueries: Array<{ query: string; calls: number; mean_time: number }>;
  indexUsage: Array<{ table: string; index: string; scans: number; usage: string }>;
}> {
  const [health, tableSizes, slowQueries, indexUsage] = await Promise.all([
    dbHealthMonitor.checkHealth(),
    dbHealthMonitor.getTableSizes(),
    dbHealthMonitor.getSlowQueries(),
    dbHealthMonitor.getIndexUsage()
  ]);

  return {
    health,
    tableSizes,
    slowQueries,
    indexUsage
  };
}
