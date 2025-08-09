/**
 * Enhanced Drizzle Query Optimizer
 * Comprehensive query optimization and performance monitoring for Drizzle ORM
 */

import { PgDatabase } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { db } from './connection';
import { logger } from '../monitoring/logging-service';

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

export interface QueryMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  rowsReturned: number;
  timestamp: Date;
  parameters?: any[];
}

export class DrizzleQueryOptimizer {
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private slowQueryThreshold: number = 1000; // 1 second

  constructor(private database: PgDatabase<any> = db) {}

  /**
   * Analyze query execution plan
   */
  async analyzeQueryPlan(
    query: string,
    parameters: any[] = []
  ): Promise<QueryPlan> {
    const startTime = Date.now();

    try {
      // Get query execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const explainResult = await this.database.execute(
        sql.raw(explainQuery, parameters)
      );

      const executionTime = Date.now() - startTime;
      const plan = (explainResult as any)[0]['QUERY PLAN'][0];

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

    // Check for N+1 query patterns
    if (query.includes('IN (') && query.match(/IN \([^)]+\)/g)?.length > 1) {
      recommendations.push(
        'Consider using JOINs instead of multiple IN clauses'
      );
      estimatedImprovement += 20;
    }

    // Check for inefficient JOINs
    if (query.includes('LEFT JOIN') && !query.includes('WHERE')) {
      recommendations.push(
        'LEFT JOINs without WHERE clauses may be inefficient'
      );
      estimatedImprovement += 15;
    }

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
      const existingIndexes = await this.database.execute(
        sql`
        SELECT 
          indexname,
          indexdef,
          schemaname,
          tablename
        FROM pg_indexes 
        WHERE tablename = ${tableName}
      `
      );

      // Get table statistics
      const tableStats = await this.database.execute(
        sql`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation,
          most_common_vals,
          most_common_freqs
        FROM pg_stats 
        WHERE tablename = ${tableName}
      `
      );

      // Analyze query patterns to suggest indexes
      const suggestedIndexes = await this.suggestIndexesForTable(tableName);

      return {
        existingIndexes: existingIndexes as any[],
        suggestedIndexes,
        tableStats: tableStats as any,
      };
    } catch (error) {
      logger.error('Table index analysis failed', { tableName, error });
      throw error;
    }
  }

  /**
   * Monitor query performance and collect metrics
   */
  async monitorQuery<T>(
    queryId: string,
    queryExecutor: () => Promise<T>,
    query?: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryExecutor();
      const executionTime = Date.now() - startTime;

      const metrics: QueryMetrics = {
        queryId,
        query: query || 'Unknown',
        executionTime,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        timestamp: new Date(),
      };

      this.recordQueryMetrics(queryId, metrics);

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryId,
          executionTime,
          query: query?.substring(0, 200),
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('Query execution failed', {
        queryId,
        executionTime,
        query: query?.substring(0, 200),
        error,
      });

      throw error;
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(queryId?: string): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    queryBreakdown: Record<string, number>;
  } {
    let allMetrics: QueryMetrics[] = [];

    if (queryId) {
      allMetrics = this.queryMetrics.get(queryId) || [];
    } else {
      for (const metrics of this.queryMetrics.values()) {
        allMetrics.push(...metrics);
      }
    }

    const totalQueries = allMetrics.length;
    const averageExecutionTime =
      totalQueries > 0
        ? allMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
        : 0;
    const slowQueries = allMetrics.filter(
      m => m.executionTime > this.slowQueryThreshold
    ).length;

    const queryBreakdown: Record<string, number> = {};
    for (const [id, metrics] of this.queryMetrics.entries()) {
      queryBreakdown[id] = metrics.length;
    }

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      queryBreakdown,
    };
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

      case 'users':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified ON users(email) WHERE email_verified = true',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_workspace_active ON users(active_workspace_id) WHERE active_workspace_id IS NOT NULL',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login_at) WHERE last_login_at IS NOT NULL'
        );
        break;

      case 'projects':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_workspace_status ON projects(workspace_id, status)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_owner_created ON projects(owner_id, created_at)'
        );
        break;

      case 'workspaces':
        suggestions.push(
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_owner_created ON workspaces(owner_id, created_at)',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_slug ON workspaces(slug) WHERE slug IS NOT NULL'
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
   * Record query metrics for analysis
   */
  private recordQueryMetrics(queryId: string, metrics: QueryMetrics): void {
    if (!this.queryMetrics.has(queryId)) {
      this.queryMetrics.set(queryId, []);
    }

    const queryMetricsList = this.queryMetrics.get(queryId)!;
    queryMetricsList.push(metrics);

    // Keep only last 100 metrics per query to prevent memory leaks
    if (queryMetricsList.length > 100) {
      queryMetricsList.shift();
    }
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics(): Promise<{
    connectionStats: any[];
    tableStats: any[];
    indexUsage: any[];
    cacheHitRatio: number;
  }> {
    try {
      // Connection statistics
      const connectionStats = await this.database.execute(sql`
        SELECT 
          state,
          count(*) as count
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state
      `);

      // Table statistics
      const tableStats = await this.database.execute(sql`
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
      `);

      // Index usage statistics
      const indexUsage = await this.database.execute(sql`
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
      `);

      // Cache hit ratio
      const cacheStats = await this.database.execute(sql`
        SELECT 
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
        FROM pg_statio_user_tables
      `);

      const cacheHitRatio = (cacheStats as any)[0]?.cache_hit_ratio || 0;

      return {
        connectionStats: connectionStats as any[],
        tableStats: tableStats as any[],
        indexUsage: indexUsage as any[],
        cacheHitRatio,
      };
    } catch (error) {
      logger.error('Failed to get database metrics', { error });
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
        await this.database.execute(sql.raw(indexQuery));
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
        await this.database.execute(sql.raw(`VACUUM ANALYZE ${tableName}`));
        logger.info(`Optimized table: ${tableName}`);
      } else {
        await this.database.execute(sql`VACUUM ANALYZE`);
        logger.info('Optimized all tables');
      }
    } catch (error) {
      logger.error('Table optimization failed', { tableName, error });
      throw error;
    }
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(milliseconds: number): void {
    this.slowQueryThreshold = milliseconds;
  }

  /**
   * Clear query metrics
   */
  clearMetrics(queryId?: string): void {
    if (queryId) {
      this.queryMetrics.delete(queryId);
    } else {
      this.queryMetrics.clear();
    }
  }

  /**
   * Export query metrics for analysis
   */
  exportMetrics(): Record<string, QueryMetrics[]> {
    const exported: Record<string, QueryMetrics[]> = {};
    for (const [queryId, metrics] of this.queryMetrics.entries()) {
      exported[queryId] = [...metrics];
    }
    return exported;
  }
}

export const drizzleQueryOptimizer = new DrizzleQueryOptimizer();
