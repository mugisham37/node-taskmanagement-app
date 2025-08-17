import { Logger } from '@taskmanagement/core';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface QueryStats {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: Date;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: number;
}

export class QueryOptimizer {
  private queryStats: QueryStats[] = [];
  private slowQueryThreshold = 1000; // 1 second
  
  constructor(
    private db: PostgresJsDatabase<any>,
    private logger: Logger
  ) {}

  async analyzeQuery(query: string): Promise<any> {
    const explainResult = await this.db.execute(
      sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`)
    );
    
    return explainResult[0];
  }

  async executeWithStats<T>(
    queryFn: () => Promise<T>,
    queryName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const executionTime = Date.now() - startTime;
      
      this.recordQueryStats({
        query: queryName,
        executionTime,
        rowsAffected: Array.isArray(result) ? result.length : 1,
        timestamp: new Date(),
      });
      
      if (executionTime > this.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          query: queryName,
          executionTime,
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Query execution failed', {
        query: queryName,
        error: error.message,
      });
      throw error;
    }
  }

  private recordQueryStats(stats: QueryStats): void {
    this.queryStats.push(stats);
    
    // Keep only last 1000 queries
    if (this.queryStats.length > 1000) {
      this.queryStats = this.queryStats.slice(-1000);
    }
  }

  getSlowQueries(threshold?: number): QueryStats[] {
    const effectiveThreshold = threshold || this.slowQueryThreshold;
    return this.queryStats.filter(stat => stat.executionTime > effectiveThreshold);
  }

  getQueryStatistics(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    topSlowQueries: QueryStats[];
  } {
    const totalQueries = this.queryStats.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.queryStats.reduce((sum, stat) => sum + stat.executionTime, 0) / totalQueries
      : 0;
    
    const slowQueries = this.getSlowQueries();
    const topSlowQueries = slowQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries: slowQueries.length,
      topSlowQueries,
    };
  }

  async suggestIndexes(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];
    
    // Analyze missing indexes from pg_stat_user_tables
    const missingIndexes = await this.db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins + n_tup_upd + n_tup_del as modifications
      FROM pg_stat_user_tables 
      WHERE seq_scan > 0 
        AND (idx_scan IS NULL OR seq_scan > idx_scan)
        AND seq_tup_read > 1000
      ORDER BY seq_tup_read DESC
    `);

    for (const table of missingIndexes) {
      suggestions.push({
        table: table.tablename,
        columns: ['id'], // This would need more sophisticated analysis
        reason: `High sequential scan ratio (${table.seq_scan} seq scans vs ${table.idx_scan || 0} index scans)`,
        estimatedImprovement: this.calculateIndexImprovement(table),
      });
    }

    return suggestions;
  }

  private calculateIndexImprovement(tableStats: any): number {
    // Simple heuristic: improvement based on seq_scan vs idx_scan ratio
    const seqScans = tableStats.seq_scan || 0;
    const idxScans = tableStats.idx_scan || 0;
    const totalScans = seqScans + idxScans;
    
    if (totalScans === 0) return 0;
    
    return Math.round((seqScans / totalScans) * 100);
  }

  async optimizeTable(tableName: string): Promise<void> {
    // Analyze table statistics
    await this.db.execute(sql.raw(`ANALYZE ${tableName}`));
    
    // Vacuum if needed
    const tableStats = await this.db.execute(sql`
      SELECT 
        n_dead_tup,
        n_live_tup,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables 
      WHERE relname = ${tableName}
    `);

    if (tableStats.length > 0) {
      const stats = tableStats[0];
      const deadTupRatio = stats.n_dead_tup / (stats.n_live_tup + stats.n_dead_tup);
      
      if (deadTupRatio > 0.1) { // More than 10% dead tuples
        this.logger.info(`Vacuuming table ${tableName} (${Math.round(deadTupRatio * 100)}% dead tuples)`);
        await this.db.execute(sql.raw(`VACUUM ANALYZE ${tableName}`));
      }
    }
  }

  async createOptimalIndexes(suggestions: IndexSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      if (suggestion.estimatedImprovement > 20) { // Only create if significant improvement
        const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;
        const createIndexSQL = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${suggestion.table} (${suggestion.columns.join(', ')})`;
        
        try {
          await this.db.execute(sql.raw(createIndexSQL));
          this.logger.info(`Created index ${indexName}`, { suggestion });
        } catch (error) {
          this.logger.error(`Failed to create index ${indexName}`, { error: error.message });
        }
      }
    }
  }
}