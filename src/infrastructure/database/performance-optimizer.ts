import { DatabaseConnection } from './connection';
import { QueryOptimizer } from './query-optimizer';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface DatabasePerformanceConfig {
  connectionPoolSize: number;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  statementTimeout: number;
  idleTimeout: number;
  enableQueryLogging: boolean;
  slowQueryThreshold: number;
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  averageConnectionTime: number;
  peakConnections: number;
}

export interface DatabaseIndexInfo {
  schemaName: string;
  tableName: string;
  indexName: string;
  columns: string[];
  isUnique: boolean;
  size: string;
  scans: number;
  tuplesRead: number;
  tuplesInserted: number;
  efficiency: number;
}

export class DatabasePerformanceOptimizer {
  private queryOptimizer: QueryOptimizer;
  private performanceConfig: DatabasePerformanceConfig;

  constructor(
    private readonly connection: DatabaseConnection,
    config?: Partial<DatabasePerformanceConfig>
  ) {
    this.queryOptimizer = new QueryOptimizer(connection);
    this.performanceConfig = {
      connectionPoolSize: 20,
      maxConnections: 100,
      connectionTimeout: 30000,
      queryTimeout: 60000,
      statementTimeout: 30000,
      idleTimeout: 10000,
      enableQueryLogging: true,
      slowQueryThreshold: 1000,
      ...config,
    };
  }

  /**
   * Optimize database connection pool settings
   */
  async optimizeConnectionPool(): Promise<void> {
    const client = await this.connection.pool.connect();

    try {
      // Set optimal connection pool parameters
      await client.query(
        `SET max_connections = ${this.performanceConfig.maxConnections}`
      );
      await client.query(`SET shared_buffers = '256MB'`);
      await client.query(`SET effective_cache_size = '1GB'`);
      await client.query(`SET work_mem = '4MB'`);
      await client.query(`SET maintenance_work_mem = '64MB'`);
      await client.query(`SET checkpoint_completion_target = 0.9`);
      await client.query(`SET wal_buffers = '16MB'`);
      await client.query(`SET default_statistics_target = 100`);

      // Enable query optimization features
      await client.query(`SET enable_hashjoin = on`);
      await client.query(`SET enable_mergejoin = on`);
      await client.query(`SET enable_nestloop = on`);
      await client.query(`SET enable_seqscan = on`);
      await client.query(`SET enable_indexscan = on`);
      await client.query(`SET enable_bitmapscan = on`);

      // Configure logging for performance monitoring
      if (this.performanceConfig.enableQueryLogging) {
        await client.query(`SET log_statement = 'all'`);
        await client.query(`SET log_duration = on`);
        await client.query(
          `SET log_min_duration_statement = ${this.performanceConfig.slowQueryThreshold}`
        );
      }

      console.log('Database connection pool optimized successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Create performance-optimized indexes
   */
  async createOptimizedIndexes(): Promise<void> {
    const client = await this.connection.pool.connect();

    try {
      const indexes = [
        // User table indexes
        {
          name: 'idx_users_email_active',
          table: 'users',
          columns: ['email', 'is_active'],
          where: 'is_active = true',
        },
        {
          name: 'idx_users_created_at',
          table: 'users',
          columns: ['created_at'],
        },

        // Task table indexes
        {
          name: 'idx_tasks_project_status',
          table: 'tasks',
          columns: ['project_id', 'status'],
        },
        {
          name: 'idx_tasks_assignee_status',
          table: 'tasks',
          columns: ['assignee_id', 'status'],
          where: 'assignee_id IS NOT NULL',
        },
        {
          name: 'idx_tasks_due_date',
          table: 'tasks',
          columns: ['due_date'],
          where: 'due_date IS NOT NULL',
        },
        {
          name: 'idx_tasks_priority_created',
          table: 'tasks',
          columns: ['priority', 'created_at'],
        },
        {
          name: 'idx_tasks_status_updated',
          table: 'tasks',
          columns: ['status', 'updated_at'],
        },

        // Project table indexes
        {
          name: 'idx_projects_workspace_status',
          table: 'projects',
          columns: ['workspace_id', 'status'],
        },
        {
          name: 'idx_projects_manager_status',
          table: 'projects',
          columns: ['manager_id', 'status'],
        },
        {
          name: 'idx_projects_created_at',
          table: 'projects',
          columns: ['created_at'],
        },

        // Workspace table indexes
        {
          name: 'idx_workspaces_owner_active',
          table: 'workspaces',
          columns: ['owner_id', 'is_active'],
        },

        // Project members table indexes
        {
          name: 'idx_project_members_user_role',
          table: 'project_members',
          columns: ['user_id', 'role'],
        },
        {
          name: 'idx_project_members_project_user',
          table: 'project_members',
          columns: ['project_id', 'user_id'],
        },

        // Task dependencies table indexes
        {
          name: 'idx_task_dependencies_task',
          table: 'task_dependencies',
          columns: ['task_id'],
        },
        {
          name: 'idx_task_dependencies_depends_on',
          table: 'task_dependencies',
          columns: ['depends_on_id'],
        },
      ];

      for (const index of indexes) {
        try {
          const whereClause = index.where ? ` WHERE ${index.where}` : '';
          const createIndexQuery = `
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name}
            ON ${index.table} (${index.columns.join(', ')})${whereClause}
          `;

          await client.query(createIndexQuery);
          console.log(`Created index: ${index.name}`);
        } catch (error) {
          console.error(`Failed to create index ${index.name}:`, error);
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Analyze and optimize existing indexes
   */
  async analyzeIndexPerformance(): Promise<DatabaseIndexInfo[]> {
    const client = await this.connection.pool.connect();

    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          pg_size_pretty(pg_relation_size(indexrelid)) as size,
          CASE 
            WHEN idx_scan = 0 THEN 0
            ELSE ROUND((idx_tup_fetch::numeric / idx_scan), 2)
          END as efficiency
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC;
      `;

      const result = await client.query(query);
      const indexInfo: DatabaseIndexInfo[] = [];

      for (const row of result.rows) {
        // Get index definition
        const indexDefQuery = `
          SELECT indexdef 
          FROM pg_indexes 
          WHERE schemaname = $1 AND tablename = $2 AND indexname = $3
        `;

        const indexDefResult = await client.query(indexDefQuery, [
          row.schemaname,
          row.tablename,
          row.indexname,
        ]);

        const indexDef = indexDefResult.rows[0]?.indexdef || '';
        const columns = this.extractColumnsFromIndexDef(indexDef);
        const isUnique = indexDef.includes('UNIQUE');

        indexInfo.push({
          schemaName: row.schemaname,
          tableName: row.tablename,
          indexName: row.indexname,
          columns,
          isUnique,
          size: row.size,
          scans: row.scans || 0,
          tuplesRead: row.tuples_read || 0,
          tuplesInserted: row.tuples_fetched || 0,
          efficiency: row.efficiency || 0,
        });
      }

      return indexInfo;
    } finally {
      client.release();
    }
  }

  /**
   * Remove unused or inefficient indexes
   */
  async removeUnusedIndexes(): Promise<string[]> {
    const indexInfo = await this.analyzeIndexPerformance();
    const removedIndexes: string[] = [];
    const client = await this.connection.pool.connect();

    try {
      for (const index of indexInfo) {
        // Remove indexes that are never used and are not unique constraints
        if (
          index.scans === 0 &&
          !index.isUnique &&
          !this.isSystemIndex(index.indexName)
        ) {
          try {
            await client.query(
              `DROP INDEX CONCURRENTLY IF EXISTS ${index.indexName}`
            );
            removedIndexes.push(index.indexName);
            console.log(`Removed unused index: ${index.indexName}`);
          } catch (error) {
            console.error(`Failed to remove index ${index.indexName}:`, error);
          }
        }
      }

      return removedIndexes;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool metrics
   */
  async getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
    const client = await this.connection.pool.connect();

    try {
      const query = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          avg(extract(epoch from (now() - backend_start))) as avg_connection_time
        FROM pg_stat_activity
        WHERE datname = current_database();
      `;

      const result = await client.query(query);
      const row = result.rows[0];

      return {
        totalConnections: parseInt(row.total_connections) || 0,
        activeConnections: parseInt(row.active_connections) || 0,
        idleConnections: parseInt(row.idle_connections) || 0,
        waitingClients: 0, // Would need to be tracked separately
        averageConnectionTime: parseFloat(row.avg_connection_time) || 0,
        peakConnections: 0, // Would need to be tracked over time
      };
    } finally {
      client.release();
    }
  }

  /**
   * Optimize query execution plans
   */
  async optimizeQueryPlans(): Promise<void> {
    const client = await this.connection.pool.connect();

    try {
      // Update table statistics for better query planning
      await client.query('ANALYZE');

      // Increase statistics target for frequently queried columns
      const statisticsUpdates = [
        'ALTER TABLE users ALTER COLUMN email SET STATISTICS 1000',
        'ALTER TABLE tasks ALTER COLUMN status SET STATISTICS 1000',
        'ALTER TABLE tasks ALTER COLUMN priority SET STATISTICS 1000',
        'ALTER TABLE projects ALTER COLUMN status SET STATISTICS 1000',
      ];

      for (const update of statisticsUpdates) {
        try {
          await client.query(update);
        } catch (error) {
          console.error(`Failed to update statistics:`, error);
        }
      }

      // Re-analyze after statistics updates
      await client.query('ANALYZE');

      console.log('Query plans optimized successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Monitor and log slow queries
   */
  async monitorSlowQueries(): Promise<void> {
    const client = await this.connection.pool.connect();

    try {
      // Enable slow query logging
      await client.query(
        `SET log_min_duration_statement = ${this.performanceConfig.slowQueryThreshold}`
      );
      await client.query("SET log_statement = 'all'");
      await client.query('SET log_duration = on');
      await client.query(
        "SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '"
      );

      console.log(
        `Slow query monitoring enabled (threshold: ${this.performanceConfig.slowQueryThreshold}ms)`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Run comprehensive database maintenance
   */
  async runPerformanceMaintenance(): Promise<void> {
    console.log('Starting database performance maintenance...');

    try {
      // Optimize connection pool
      await this.optimizeConnectionPool();

      // Create missing indexes
      await this.createOptimizedIndexes();

      // Remove unused indexes
      const removedIndexes = await this.removeUnusedIndexes();
      console.log(`Removed ${removedIndexes.length} unused indexes`);

      // Optimize query plans
      await this.optimizeQueryPlans();

      // Run query optimizer maintenance
      await this.queryOptimizer.runMaintenance();

      // Enable monitoring
      await this.monitorSlowQueries();

      console.log('Database performance maintenance completed successfully');
    } catch (error) {
      console.error('Database performance maintenance failed:', error);
      throw new InfrastructureError(
        `Performance maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private extractColumnsFromIndexDef(indexDef: string): string[] {
    const match = indexDef.match(/\(([^)]+)\)/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(col => col.trim().replace(/"/g, ''))
      .filter(col => col.length > 0);
  }

  private isSystemIndex(indexName: string): boolean {
    const systemPrefixes = ['pg_', 'information_schema_', 'sql_'];
    return systemPrefixes.some(prefix => indexName.startsWith(prefix));
  }
}

export function createDatabasePerformanceOptimizer(
  connection: DatabaseConnection,
  config?: Partial<DatabasePerformanceConfig>
): DatabasePerformanceOptimizer {
  return new DatabasePerformanceOptimizer(connection, config);
}
