import { DatabaseConnection } from './connection';
import { PoolClient } from 'pg';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  planningTime: number;
  totalTime: number;
  rowsReturned: number;
  bufferHits: number;
  bufferReads: number;
  timestamp: Date;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface QueryOptimizationReport {
  slowQueries: QueryPerformanceMetrics[];
  indexSuggestions: IndexSuggestion[];
  tableStatistics: TableStatistics[];
  recommendations: string[];
}

export interface TableStatistics {
  tableName: string;
  rowCount: number;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  sequentialScans: number;
  indexScans: number;
  lastAnalyzed: Date | null;
  lastVacuumed: Date | null;
}

export class QueryOptimizer {
  private connection: DatabaseConnection;
  private performanceLog: QueryPerformanceMetrics[] = [];
  private maxLogSize = 1000;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Execute a query with performance monitoring
   */
  async executeWithMonitoring<T>(
    query: string,
    params: any[] = []
  ): Promise<{ result: T; metrics: QueryPerformanceMetrics }> {
    const client = await this.connection.pool.connect();

    try {
      const startTime = Date.now();

      // Enable timing and buffer statistics
      await client.query('SET track_io_timing = on');
      await client.query('SET log_statement_stats = on');

      // Execute EXPLAIN ANALYZE to get detailed metrics
      const explainResult = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        params
      );

      // Execute the actual query
      const result = await client.query(query, params);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Parse execution plan
      const plan = explainResult.rows[0]['QUERY PLAN'][0];

      const metrics: QueryPerformanceMetrics = {
        query,
        executionTime: plan['Execution Time'] || 0,
        planningTime: plan['Planning Time'] || 0,
        totalTime,
        rowsReturned: result.rowCount || 0,
        bufferHits: this.extractBufferHits(plan),
        bufferReads: this.extractBufferReads(plan),
        timestamp: new Date(),
      };

      // Log performance metrics
      this.logPerformanceMetrics(metrics);

      return { result: result.rows as T, metrics };
    } finally {
      client.release();
    }
  }

  /**
   * Analyze slow queries and generate optimization report
   */
  async generateOptimizationReport(
    slowQueryThresholdMs: number = 1000
  ): Promise<QueryOptimizationReport> {
    const slowQueries = this.performanceLog
      .filter(metric => metric.totalTime > slowQueryThresholdMs)
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 20);

    const tableStatistics = await this.getTableStatistics();
    const indexSuggestions = await this.generateIndexSuggestions(slowQueries);
    const recommendations = this.generateRecommendations(
      slowQueries,
      tableStatistics
    );

    return {
      slowQueries,
      indexSuggestions,
      tableStatistics,
      recommendations,
    };
  }

  /**
   * Get comprehensive table statistics
   */
  async getTableStatistics(): Promise<TableStatistics[]> {
    const client = await this.connection.pool.connect();

    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as total_writes,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan as sequential_scans,
          seq_tup_read as sequential_reads,
          idx_scan as index_scans,
          idx_tup_fetch as index_reads,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY total_writes DESC;
      `;

      const result = await client.query(query);
      const statistics: TableStatistics[] = [];

      for (const row of result.rows) {
        // Get table size information
        const sizeQuery = `
          SELECT 
            pg_size_pretty(pg_total_relation_size('${row.tablename}')) as total_size,
            pg_size_pretty(pg_relation_size('${row.tablename}')) as table_size,
            pg_size_pretty(pg_total_relation_size('${row.tablename}') - pg_relation_size('${row.tablename}')) as index_size,
            (SELECT reltuples::bigint FROM pg_class WHERE relname = '${row.tablename}') as row_count
        `;

        const sizeResult = await client.query(sizeQuery);
        const sizeData = sizeResult.rows[0];

        statistics.push({
          tableName: row.tablename,
          rowCount: parseInt(sizeData.row_count) || 0,
          tableSize: sizeData.table_size,
          indexSize: sizeData.index_size,
          totalSize: sizeData.total_size,
          sequentialScans: row.sequential_scans || 0,
          indexScans: row.index_scans || 0,
          lastAnalyzed: row.last_analyze || row.last_autoanalyze,
          lastVacuumed: row.last_vacuum || row.last_autovacuum,
        });
      }

      return statistics;
    } finally {
      client.release();
    }
  }

  /**
   * Generate index suggestions based on slow queries
   */
  async generateIndexSuggestions(
    slowQueries: QueryPerformanceMetrics[]
  ): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];
    const client = await this.connection.pool.connect();

    try {
      // Analyze missing indexes
      const missingIndexQuery = `
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        AND n_distinct > 100
        ORDER BY n_distinct DESC;
      `;

      const result = await client.query(missingIndexQuery);

      for (const row of result.rows) {
        // Check if index already exists
        const indexExistsQuery = `
          SELECT 1 FROM pg_indexes 
          WHERE tablename = $1 AND indexdef LIKE '%${row.attname}%'
        `;

        const indexExists = await client.query(indexExistsQuery, [
          row.tablename,
        ]);

        if (indexExists.rows.length === 0) {
          suggestions.push({
            table: row.tablename,
            columns: [row.attname],
            reason: `High cardinality column (${row.n_distinct} distinct values) without index`,
            estimatedImprovement: this.calculateIndexImprovement(
              row.n_distinct
            ),
            priority:
              row.n_distinct > 1000
                ? 'HIGH'
                : row.n_distinct > 500
                  ? 'MEDIUM'
                  : 'LOW',
          });
        }
      }

      // Analyze composite index opportunities
      const compositeIndexQuery = `
        SELECT 
          schemaname,
          tablename,
          array_agg(attname ORDER BY n_distinct DESC) as columns
        FROM pg_stats 
        WHERE schemaname = 'public'
        GROUP BY schemaname, tablename
        HAVING count(*) > 1;
      `;

      const compositeResult = await client.query(compositeIndexQuery);

      for (const row of compositeResult.rows) {
        if (row.columns.length >= 2) {
          const topColumns = row.columns.slice(0, 3); // Max 3 columns for composite index

          suggestions.push({
            table: row.tablename,
            columns: topColumns,
            reason: 'Potential composite index for multi-column queries',
            estimatedImprovement: 30,
            priority: 'MEDIUM',
          });
        }
      }

      return suggestions;
    } finally {
      client.release();
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    slowQueries: QueryPerformanceMetrics[],
    tableStats: TableStatistics[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyze slow queries
    if (slowQueries.length > 0) {
      recommendations.push(
        `Found ${slowQueries.length} slow queries. Consider optimizing the slowest ones first.`
      );

      const avgExecutionTime =
        slowQueries.reduce((sum, q) => sum + q.executionTime, 0) /
        slowQueries.length;
      if (avgExecutionTime > 5000) {
        recommendations.push(
          'Average execution time is very high. Consider query optimization and indexing.'
        );
      }
    }

    // Analyze table statistics
    const tablesNeedingVacuum = tableStats.filter(stat => {
      const lastVacuum = stat.lastVacuumed;
      if (!lastVacuum) return true;

      const daysSinceVacuum =
        (Date.now() - lastVacuum.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceVacuum > 7;
    });

    if (tablesNeedingVacuum.length > 0) {
      recommendations.push(
        `${tablesNeedingVacuum.length} tables need VACUUM. Consider running VACUUM ANALYZE.`
      );
    }

    const tablesNeedingAnalyze = tableStats.filter(stat => {
      const lastAnalyze = stat.lastAnalyzed;
      if (!lastAnalyze) return true;

      const daysSinceAnalyze =
        (Date.now() - lastAnalyze.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceAnalyze > 3;
    });

    if (tablesNeedingAnalyze.length > 0) {
      recommendations.push(
        `${tablesNeedingAnalyze.length} tables need ANALYZE for updated statistics.`
      );
    }

    // Check for tables with high sequential scan ratio
    const tablesWithHighSeqScans = tableStats.filter(stat => {
      const totalScans = stat.sequentialScans + stat.indexScans;
      return totalScans > 0 && stat.sequentialScans / totalScans > 0.8;
    });

    if (tablesWithHighSeqScans.length > 0) {
      recommendations.push(
        `${tablesWithHighSeqScans.length} tables have high sequential scan ratios. Consider adding indexes.`
      );
    }

    return recommendations;
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(
    suggestions: IndexSuggestion[]
  ): Promise<void> {
    const client = await this.connection.pool.connect();

    try {
      for (const suggestion of suggestions) {
        if (suggestion.priority === 'HIGH') {
          const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;
          const createIndexQuery = `
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} 
            ON ${suggestion.table} (${suggestion.columns.join(', ')})
          `;

          try {
            await client.query(createIndexQuery);
            console.log(`Created index: ${indexName}`);
          } catch (error) {
            console.error(`Failed to create index ${indexName}:`, error);
          }
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Run database maintenance tasks
   */
  async runMaintenance(): Promise<void> {
    const client = await this.connection.pool.connect();

    try {
      console.log('Running database maintenance...');

      // Update table statistics
      await client.query('ANALYZE');

      // Vacuum tables that need it
      const tableStats = await this.getTableStatistics();
      const tablesNeedingVacuum = tableStats.filter(stat => {
        const lastVacuum = stat.lastVacuumed;
        if (!lastVacuum) return true;

        const daysSinceVacuum =
          (Date.now() - lastVacuum.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceVacuum > 7;
      });

      for (const table of tablesNeedingVacuum) {
        await client.query(`VACUUM ANALYZE ${table.tableName}`);
        console.log(`Vacuumed table: ${table.tableName}`);
      }

      console.log('Database maintenance completed');
    } finally {
      client.release();
    }
  }

  private logPerformanceMetrics(metrics: QueryPerformanceMetrics): void {
    this.performanceLog.push(metrics);

    // Keep log size manageable
    if (this.performanceLog.length > this.maxLogSize) {
      this.performanceLog = this.performanceLog.slice(-this.maxLogSize);
    }
  }

  private extractBufferHits(plan: any): number {
    // Extract buffer hits from execution plan
    return this.extractFromPlan(plan, 'Shared Hit Blocks') || 0;
  }

  private extractBufferReads(plan: any): number {
    // Extract buffer reads from execution plan
    return this.extractFromPlan(plan, 'Shared Read Blocks') || 0;
  }

  private extractFromPlan(plan: any, key: string): number {
    if (!plan) return 0;

    if (plan[key]) return plan[key];

    if (plan.Plans) {
      return plan.Plans.reduce(
        (sum: number, subPlan: any) => sum + this.extractFromPlan(subPlan, key),
        0
      );
    }

    return 0;
  }

  private calculateIndexImprovement(distinctValues: number): number {
    // Estimate improvement percentage based on cardinality
    if (distinctValues > 10000) return 80;
    if (distinctValues > 1000) return 60;
    if (distinctValues > 100) return 40;
    return 20;
  }
}

// Factory function
export function createQueryOptimizer(
  connection: DatabaseConnection
): QueryOptimizer {
  return new QueryOptimizer(connection);
}
