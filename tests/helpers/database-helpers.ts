import { execSync } from 'child_process';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export class DatabaseHelpers {
  private static connection: any;
  private static database: any;

  static async getConnection() {
    if (!this.connection) {
      this.connection = postgres(
        process.env.TEST_DATABASE_URL ||
          'postgresql://test:test@localhost:5432/test_db'
      );
      this.database = drizzle(this.connection);
    }
    return { connection: this.connection, database: this.database };
  }

  static async cleanupDatabase() {
    try {
      const { database } = await this.getConnection();

      // Clean up all tables in reverse dependency order
      await database.execute('TRUNCATE TABLE file_attachments CASCADE');
      await database.execute('TRUNCATE TABLE calendar_events CASCADE');
      await database.execute('TRUNCATE TABLE webhooks CASCADE');
      await database.execute('TRUNCATE TABLE audit_logs CASCADE');
      await database.execute('TRUNCATE TABLE notifications CASCADE');
      await database.execute('TRUNCATE TABLE tasks CASCADE');
      await database.execute('TRUNCATE TABLE projects CASCADE');
      await database.execute('TRUNCATE TABLE workspaces CASCADE');
      await database.execute('TRUNCATE TABLE users CASCADE');

      console.log('✅ Database cleaned up successfully');
    } catch (error) {
      console.warn('⚠️  Database cleanup failed:', error);
    }
  }

  static async seedTestData() {
    try {
      const { database } = await this.getConnection();

      // Create test users
      await database.execute(`
        INSERT INTO users (id, email, first_name, last_name, password_hash, status, created_at, updated_at)
        VALUES 
          ('test-user-1', 'test1@example.com', 'Test', 'User1', '$2b$10$hash1', 'ACTIVE', NOW(), NOW()),
          ('test-user-2', 'test2@example.com', 'Test', 'User2', '$2b$10$hash2', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      // Create test workspaces
      await database.execute(`
        INSERT INTO workspaces (id, name, slug, description, settings, plan_type, created_at, updated_at)
        VALUES 
          ('test-workspace-1', 'Test Workspace 1', 'test-workspace-1', 'Test workspace', '{}', 'FREE', NOW(), NOW()),
          ('test-workspace-2', 'Test Workspace 2', 'test-workspace-2', 'Test workspace', '{}', 'FREE', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      // Create test projects
      await database.execute(`
        INSERT INTO projects (id, workspace_id, owner_id, name, description, status, start_date, end_date, created_at, updated_at)
        VALUES 
          ('test-project-1', 'test-workspace-1', 'test-user-1', 'Test Project 1', 'Test project', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW()),
          ('test-project-2', 'test-workspace-2', 'test-user-2', 'Test Project 2', 'Test project', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      console.log('✅ Test data seeded successfully');
    } catch (error) {
      console.warn('⚠️  Test data seeding failed:', error);
    }
  }

  static async resetDatabase() {
    try {
      // Drop and recreate the test database
      execSync('dropdb test_db --if-exists', { stdio: 'inherit' });
      execSync('createdb test_db', { stdio: 'inherit' });

      // Run migrations
      execSync('npm run db:migrate', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      });

      console.log('✅ Database reset successfully');
    } catch (error) {
      console.warn('⚠️  Database reset failed:', error);
    }
  }

  static async closeConnection() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      this.database = null;
    }
  }
}

// Export for backward compatibility
export const cleanupDatabase =
  DatabaseHelpers.cleanupDatabase.bind(DatabaseHelpers);
export const seedTestData = DatabaseHelpers.seedTestData.bind(DatabaseHelpers);
