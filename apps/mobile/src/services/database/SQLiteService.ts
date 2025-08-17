import { Project, Task, User, Workspace } from '@taskmanagement/types';
import * as SQLite from 'expo-sqlite';

export interface DatabaseSchema {
  tasks: Task;
  projects: Project;
  users: User;
  workspaces: Workspace;
  sync_queue: SyncQueueItem;
  offline_changes: OfflineChange;
}

export interface SyncQueueItem {
  id: string;
  table: keyof DatabaseSchema;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
}

export interface OfflineChange {
  id: string;
  entityId: string;
  entityType: keyof DatabaseSchema;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
  conflictResolution?: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MANUAL';
}

class SQLiteService {
  private db: SQLite.WebSQLDatabase | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = SQLite.openDatabase('taskmanagement.db');
      await this.createTables();
      await this.createIndexes();
      this.isInitialized = true;
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createTableQueries = [
      // Tasks table
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT,
        project_id TEXT,
        assignee_id TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        last_sync_at TEXT
      )`,

      // Projects table
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        owner_id TEXT,
        start_date TEXT,
        end_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        last_sync_at TEXT
      )`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        last_sync_at TEXT
      )`,

      // Workspaces table
      `CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_id TEXT NOT NULL,
        settings TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        last_sync_at TEXT
      )`,

      // Sync queue table
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT NOT NULL
      )`,

      // Offline changes table
      `CREATE TABLE IF NOT EXISTS offline_changes (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        change_type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        conflict_resolution TEXT,
        is_resolved INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`,

      // Attachments table
      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        is_uploaded INTEGER DEFAULT 0,
        upload_url TEXT,
        created_at TEXT NOT NULL
      )`
    ];

    for (const query of createTableQueries) {
      await this.executeQuery(query);
    }
  }

  private async createIndexes(): Promise<void> {
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_offline_changes_entity ON offline_changes(entity_id, entity_type)',
      'CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id)'
    ];

    for (const query of indexQueries) {
      await this.executeQuery(query);
    }
  }

  private executeQuery(query: string, params: any[] = []): Promise<SQLite.SQLResultSet> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          query,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            console.error('SQL Error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  // Generic CRUD operations
  async insert<T extends keyof DatabaseSchema>(
    table: T,
    data: Partial<DatabaseSchema[T]>
  ): Promise<void> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    await this.executeQuery(query, values);
  }

  async update<T extends keyof DatabaseSchema>(
    table: T,
    id: string,
    data: Partial<DatabaseSchema[T]>
  ): Promise<void> {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    await this.executeQuery(query, values);
  }

  async delete<T extends keyof DatabaseSchema>(table: T, id: string): Promise<void> {
    const query = `DELETE FROM ${table} WHERE id = ?`;
    await this.executeQuery(query, [id]);
  }

  async findById<T extends keyof DatabaseSchema>(
    table: T,
    id: string
  ): Promise<DatabaseSchema[T] | null> {
    const query = `SELECT * FROM ${table} WHERE id = ?`;
    const result = await this.executeQuery(query, [id]);
    
    if (result.rows.length === 0) return null;
    return result.rows.item(0) as DatabaseSchema[T];
  }

  async findAll<T extends keyof DatabaseSchema>(
    table: T,
    where?: string,
    params?: any[]
  ): Promise<DatabaseSchema[T][]> {
    let query = `SELECT * FROM ${table}`;
    if (where) {
      query += ` WHERE ${where}`;
    }

    const result = await this.executeQuery(query, params || []);
    const items: DatabaseSchema[T][] = [];
    
    for (let i = 0; i < result.rows.length; i++) {
      items.push(result.rows.item(i) as DatabaseSchema[T]);
    }
    
    return items;
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'retryCount' | 'status'>): Promise<void> {
    const syncItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
      status: 'PENDING'
    };

    await this.insert('sync_queue', {
      ...syncItem,
      data: JSON.stringify(syncItem.data),
      created_at: new Date().toISOString()
    });
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const items = await this.findAll('sync_queue', 'status = ?', ['PENDING']);
    return items.map(item => ({
      ...item,
      data: JSON.parse(item.data as string)
    })) as SyncQueueItem[];
  }

  async updateSyncItemStatus(id: string, status: SyncQueueItem['status'], errorMessage?: string): Promise<void> {
    const updateData: any = { status };
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    if (status === 'FAILED') {
      const item = await this.findById('sync_queue', id);
      if (item) {
        updateData.retry_count = (item.retry_count || 0) + 1;
      }
    }
    
    await this.update('sync_queue', id, updateData);
  }

  // Offline changes tracking
  async trackOfflineChange(change: Omit<OfflineChange, 'id'>): Promise<void> {
    const offlineChange: OfflineChange = {
      ...change,
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    await this.insert('offline_changes', {
      ...offlineChange,
      data: JSON.stringify(offlineChange.data),
      is_resolved: 0,
      created_at: new Date().toISOString()
    });
  }

  async getUnresolvedChanges(): Promise<OfflineChange[]> {
    const changes = await this.findAll('offline_changes', 'is_resolved = ?', [0]);
    return changes.map(change => ({
      ...change,
      data: JSON.parse(change.data as string)
    })) as OfflineChange[];
  }

  async markChangeResolved(id: string): Promise<void> {
    await this.update('offline_changes', id, { is_resolved: 1 });
  }

  // Cleanup operations
  async clearSyncedItems(): Promise<void> {
    await this.executeQuery('DELETE FROM sync_queue WHERE status = ?', ['COMPLETED']);
  }

  async clearOldData(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString();

    await this.executeQuery('DELETE FROM sync_queue WHERE status = ? AND created_at < ?', ['COMPLETED', cutoffISO]);
    await this.executeQuery('DELETE FROM offline_changes WHERE is_resolved = 1 AND created_at < ?', [cutoffISO]);
  }

  async getStorageStats(): Promise<{
    totalTasks: number;
    totalProjects: number;
    pendingSyncItems: number;
    unresolvedChanges: number;
  }> {
    const [tasks, projects, syncItems, changes] = await Promise.all([
      this.executeQuery('SELECT COUNT(*) as count FROM tasks'),
      this.executeQuery('SELECT COUNT(*) as count FROM projects'),
      this.executeQuery('SELECT COUNT(*) as count FROM sync_queue WHERE status = ?', ['PENDING']),
      this.executeQuery('SELECT COUNT(*) as count FROM offline_changes WHERE is_resolved = 0')
    ]);

    return {
      totalTasks: tasks.rows.item(0).count,
      totalProjects: projects.rows.item(0).count,
      pendingSyncItems: syncItems.rows.item(0).count,
      unresolvedChanges: changes.rows.item(0).count
    };
  }

  async close(): Promise<void> {
    // SQLite doesn't have an explicit close method in Expo
    this.db = null;
    this.isInitialized = false;
  }
}

export const sqliteService = new SQLiteService();