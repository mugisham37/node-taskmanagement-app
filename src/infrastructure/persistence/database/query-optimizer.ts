import { PrismaClient } from '@prisma/client';
import { logger } from '../logging/logger';

/**
 * Database Query Optimizer
 * Provides query optimization, indexing analysis, and performance monitoring
 */

export interface QueryPlan {
  query: string;
  executionTime: number;
  planNodes: any[];
  cost: number;
  rows: number;
  buffers?: any;
}

export interface IndexHint {
  table: string;
  index: string;
  type: 'use' | 'force' | 'ignore';
}

export interface QueryOptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  estimatedImprovement: number;
  recommendations: string[];
}

export class QueryOptimizer {
  constructor(private prisma: PrismaClient) {}

  /**
   * Analyze query execution plan
   */
  async analyzeQueryPlan(query: string): Promise<QueryPlan> {
    const startTime = Date.now();

    try {
      // Get query execution plan
      const explainResult = (await this.prisma.$queryRawUnsafe(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      )) as any[];

      const executionTime = Date.now() - startTime;
      const plan = explainResult[0]['QUERY PLAN'][0];

      return {
        query,
        executionTime,
        planNodes: plan.Plan ? [plan.Plan] : [],
        cost: plan.Plan?.['Total Cost'] || 0,
        rows: plan.Plan?.['Actual Rows'] || 0,
        buffers: plan.Plan?.['Buffers'],
      };
    } catch (error) {
      logger.error('Query plan analysis failed', { query, error });
      throw error;
    }
  }

  /**
   * Optimize common query patterns
   */
  async optimizeQuery(query: string): Promise<QueryOptimizationResult> {
    const recommendations: string[] = [];
    let optimizedQuery = query;
    let estimatedImprovement = 0;

    // Analyze for common optimization opportunities
    if (query.includes('SELECT *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns');
      estimatedImprovement += 15;
    }

    if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
      recommendations.push('Consider adding LIMIT to ORDER BY queries');
      estimatedImprovement += 10;
    }

    if (query.includes("LIKE '%")) {
      recommendations.push('Leading wildcard LIKE patterns cannot use indexes');
      estimatedImprovement += 25;
    }

    // Check for missing WHERE clauses on large tables
    const largeTables = ['tasks', 'activities', 'audit_logs', 'notifications'];
    largeTables.forEach(table => {
      if (query.includes(`FROM ${table}`) && !query.includes('WHERE')) {
        recommendations.push(
          `Add WHERE clause to ${table} queries for better performance`
        );
        estimatedImprovement += 30;
      }
    });

    return {
      originalQuery: query,
      optimizedQuery,
      estimatedImprovement,
      recommendations,
    };
  }

  /**
   * Analyze table statistics and suggest indexes
   */
  async analyzeTableIndexes(tableName: string): Promise<{
    existingIndexes: any[];
    suggestedIndexes: string[];
    tableStats: any;
  }> {
    try {
      // Get existing indexes
      const existingIndexes = (await this.prisma.$queryRawUnsafe(
        `
        SELECT 
          indexname,
          indexdef,
          schemaname,
          tablename
        FROM pg_indexes 
        WHERE tablename = $1
      `,
        tableName
      )) as any[];

      // Get table statistics
      const tableStats = (await this.prisma.$queryRawUnsafe(
        `
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          most_common_vals,
          most_common_freqs
        FROM pg_stats 
        WHERE tablename = $1
      `,
        tableName
      )) as any[];

      // Analyze query patterns to suggest indexes
      const suggestedIndexes = await this.suggestIndexesForTable(tableName);

      return {
        existingIndexes,
        suggestedIndexes,
        tableStats,
      };
    } catch (error) {
      logger.error('Table index analysis failed', { tableName, error });
      throw error;
    }
  }

  /**
   * Suggest indexes based on common query patterns
   */
  private async suggestIndexesForTable(tableName: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Common index patterns based on table
    switch (tableName) {
      case 'tasks':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_workspace_status_priority ON tasks(workspace_id, status, priority)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignee_due_date ON tasks(assignee_id, due_date) WHERE assignee_id IS NOT NULL',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status) WHERE project_id IS NOT NULL',
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_title_gin ON tasks USING gin(to_tsvector('english', title))"
        );
        break;

      case 'activities':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_workspace_created ON activities(user_id, workspace_id, created_at)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_type_created ON activities(type, created_at)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_task_created ON activities(task_id, created_at) WHERE task_id IS NOT NULL'
        );
        break;

      case 'notifications':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_workspace_type ON notifications(workspace_id, type) WHERE workspace_id IS NOT NULL'
        );
        break;

      case 'audit_logs':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_created ON audit_logs(resource, resource_id, created_at)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at) WHERE user_id IS NOT NULL'
        );
        break;
    }

    return suggestions;
  }

  /**
   * Monitor slow queries
   */
  async getSlowQueries(minDuration: number = 1000): Promise<any[]> {
    try {
      const slowQueries = (await this.prisma.$queryRawUnsafe(
        `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          min_time,
          max_time,
          stddev_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > $1
        ORDER BY mean_time DESC
        LIMIT 20
      `,
        minDuration
      )) as any[];

      return slowQueries;
    } catch (error) {
      logger.warn('pg_stat_statements not available for slow query monitoring');
      return [];
    }
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics(): Promise<{
    connectionStats: any;
    tableStats: any[];
    indexUsage: any[];
    cacheHitRatio: number;
  }> {
    try {
      // Connection statistics
      const connectionStats = (await this.prisma.$queryRawUnsafe(`
        SELECT 
          state,
          count(*) as count
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state
      `)) as any[];

      // Table statistics
      const tableStats = (await this.prisma.$queryRawUnsafe(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `)) as any[];

      // Index usage statistics
      const indexUsage = (await this.prisma.$queryRawUnsafe(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
        ORDER BY idx_scan DESC
      `)) as any[];

      // Cache hit ratio
      const cacheStats = (await this.prisma.$queryRawUnsafe(`
        SELECT 
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
        FROM pg_statio_user_tables
      `)) as any[];

      const cacheHitRatio = cacheStats[0]?.cache_hit_ratio || 0;

      return {
        connectionStats,
        tableStats,
        indexUsage,
        cacheHitRatio,
      };
    } catch (error) {
      logger.error('Failed to get database metrics', { error });
      throw error;
    }
  }

  /**
   * Optimize connection pool settings
   */
  async optimizeConnectionPool(): Promise<{
    currentSettings: any;
    recommendations: string[];
  }> {
    try {
      const currentSettings = (await this.prisma.$queryRawUnsafe(`
        SELECT 
          name,
          setting,
          unit,
          context,
          short_desc
        FROM pg_settings 
        WHERE name IN (
          'max_connections',
          'shared_buffers',
          'effective_cache_size',
          'work_mem',
          'maintenance_work_mem',
          'checkpoint_completion_target',
          'wal_buffers',
          'default_statistics_target'
        )
      `)) as any[];

      const recommendations = [
        'Consider setting shared_buffers to 25% of total RAM',
        'Set effective_cache_size to 75% of total RAM',
        'Adjust work_mem based on concurrent connections and available RAM',
        'Set maintenance_work_mem to 256MB or higher for large databases',
        'Enable pg_stat_statements for query performance monitoring',
      ];

      return {
        currentSettings,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to analyze connection pool settings', { error });
      throw error;
    }
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(tableName: string): Promise<void> {
    const { suggestedIndexes } = await this.analyzeTableIndexes(tableName);

    for (const indexQuery of suggestedIndexes) {
      try {
        logger.info(`Creating index: ${indexQuery}`);
        await this.prisma.$executeRawUnsafe(indexQuery);
        logger.info(`Successfully created index for ${tableName}`);
      } catch (error) {
        logger.error(`Failed to create index: ${indexQuery}`, { error });
      }
    }
  }

  /**
   * Vacuum and analyze tables for optimal performance
   */
  async optimizeTableMaintenance(tableName?: string): Promise<void> {
    try {
      if (tableName) {
        await this.prisma.$executeRawUnsafe(`VACUUM ANALYZE ${tableName}`);
        logger.info(`Optimized table: ${tableName}`);
      } else {
        await this.prisma.$executeRawUnsafe('VACUUM ANALYZE');
        logger.info('Optimized all tables');
      }
    } catch (error) {
      logger.error('Table optimization failed', { tableName, error });
      throw error;
    }
  }
}

export const queryOptimizer = new QueryOptimizer(new PrismaClient());
