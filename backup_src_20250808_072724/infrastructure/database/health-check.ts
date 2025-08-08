import { prisma, checkDatabaseHealth } from './prisma-client';
import { logger } from '@/infrastructure/logging/logger';

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  latency?: number;
  connectionCount?: number;
  version?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Comprehensive database health check
 */
export async function performDatabaseHealthCheck(): Promise<DatabaseHealthStatus> {
  const timestamp = new Date();

  try {
    // Basic connectivity check
    const healthResult = await checkDatabaseHealth();

    if (!healthResult.isHealthy) {
      return {
        isHealthy: false,
        error: healthResult.error,
        timestamp,
      };
    }

    // Get database version
    const versionResult = await prisma.$queryRaw<
      [{ version: string }]
    >`SELECT version()`;
    const version = versionResult[0]?.version;

    // Get connection count (PostgreSQL specific)
    const connectionResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `;
    const connectionCount = Number(connectionResult[0]?.count || 0);

    return {
      isHealthy: true,
      latency: healthResult.latency,
      connectionCount,
      version: version?.split(' ')[0], // Extract just the version number
      timestamp,
    };
  } catch (error) {
    logger.error('Database health check failed:', error);

    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    };
  }
}

/**
 * Monitor database performance metrics
 */
export async function getDatabaseMetrics(): Promise<{
  activeConnections: number;
  totalConnections: number;
  slowQueries: number;
  cacheHitRatio: number;
  databaseSize: string;
}> {
  try {
    // Active connections
    const activeConnectionsResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `;
    const activeConnections = Number(activeConnectionsResult[0]?.count || 0);

    // Total connections
    const totalConnectionsResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count 
      FROM pg_stat_activity
    `;
    const totalConnections = Number(totalConnectionsResult[0]?.count || 0);

    // Slow queries (queries taking more than 1 second)
    const slowQueriesResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active' 
      AND query_start < now() - interval '1 second'
    `;
    const slowQueries = Number(slowQueriesResult[0]?.count || 0);

    // Cache hit ratio
    const cacheHitResult = await prisma.$queryRaw<[{ ratio: number }]>`
      SELECT 
        round(
          (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 
          2
        ) as ratio
      FROM pg_statio_user_tables
    `;
    const cacheHitRatio = cacheHitResult[0]?.ratio || 0;

    // Database size
    const databaseSizeResult = await prisma.$queryRaw<[{ size: string }]>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    const databaseSize = databaseSizeResult[0]?.size || '0 bytes';

    return {
      activeConnections,
      totalConnections,
      slowQueries,
      cacheHitRatio,
      databaseSize,
    };
  } catch (error) {
    logger.error('Failed to get database metrics:', error);

    return {
      activeConnections: 0,
      totalConnections: 0,
      slowQueries: 0,
      cacheHitRatio: 0,
      databaseSize: '0 bytes',
    };
  }
}

/**
 * Check if database needs maintenance
 */
export async function checkMaintenanceNeeds(): Promise<{
  needsVacuum: boolean;
  needsReindex: boolean;
  largestTables: Array<{ table: string; size: string; rows: number }>;
}> {
  try {
    // Check if vacuum is needed (dead tuple ratio > 10%)
    const vacuumCheckResult = await prisma.$queryRaw<
      Array<{
        schemaname: string;
        tablename: string;
        n_dead_tup: bigint;
        n_live_tup: bigint;
      }>
    >`
      SELECT schemaname, tablename, n_dead_tup, n_live_tup
      FROM pg_stat_user_tables
      WHERE n_live_tup > 0
      AND (n_dead_tup::float / n_live_tup::float) > 0.1
    `;
    const needsVacuum = vacuumCheckResult.length > 0;

    // Check if reindex is needed (index bloat)
    const reindexCheckResult = await prisma.$queryRaw<
      Array<{ indexname: string }>
    >`
      SELECT indexname
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      AND schemaname = 'public'
    `;
    const needsReindex = reindexCheckResult.length > 0;

    // Get largest tables
    const largestTablesResult = await prisma.$queryRaw<
      Array<{
        table: string;
        size: string;
        rows: bigint;
      }>
    >`
      SELECT 
        tablename as table,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_live_tup as rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `;

    const largestTables = largestTablesResult.map(row => ({
      table: row.table,
      size: row.size,
      rows: Number(row.rows),
    }));

    return {
      needsVacuum,
      needsReindex,
      largestTables,
    };
  } catch (error) {
    logger.error('Failed to check maintenance needs:', error);

    return {
      needsVacuum: false,
      needsReindex: false,
      largestTables: [],
    };
  }
}
