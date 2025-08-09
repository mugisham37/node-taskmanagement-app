import { DatabaseConnection } from '../connection';
import { createDatabaseConfig } from '../config';
import { UserSeeder } from './user-seeder';
import { WorkspaceSeeder } from './workspace-seeder';
import { ProjectSeeder } from './project-seeder';
import { TaskSeeder } from './task-seeder';

export interface SeedOptions {
  environment: 'development' | 'test' | 'staging';
  userCount?: number;
  workspaceCount?: number;
  projectsPerWorkspace?: number;
  tasksPerProject?: number;
  clearExisting?: boolean;
}

export class DatabaseSeeder {
  private connection: DatabaseConnection;
  private userSeeder: UserSeeder;
  private workspaceSeeder: WorkspaceSeeder;
  private projectSeeder: ProjectSeeder;
  private taskSeeder: TaskSeeder;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
    this.userSeeder = new UserSeeder(connection);
    this.workspaceSeeder = new WorkspaceSeeder(connection);
    this.projectSeeder = new ProjectSeeder(connection);
    this.taskSeeder = new TaskSeeder(connection);
  }

  async seedAll(options: SeedOptions): Promise<void> {
    const {
      userCount = 50,
      workspaceCount = 10,
      projectsPerWorkspace = 5,
      tasksPerProject = 20,
      clearExisting = false,
    } = options;

    console.log('Starting database seeding...');
    console.log(`Environment: ${options.environment}`);
    console.log(
      `Users: ${userCount}, Workspaces: ${workspaceCount}, Projects per workspace: ${projectsPerWorkspace}, Tasks per project: ${tasksPerProject}`
    );

    try {
      // Clear existing data if requested
      if (clearExisting) {
        await this.clearAllData();
      }

      // Seed in dependency order
      console.log('Seeding users...');
      const users = await this.userSeeder.seed(userCount);

      console.log('Seeding workspaces...');
      const workspaces = await this.workspaceSeeder.seed(workspaceCount, users);

      console.log('Seeding projects...');
      const projects = await this.projectSeeder.seed(
        workspaces,
        users,
        projectsPerWorkspace
      );

      console.log('Seeding tasks...');
      await this.taskSeeder.seed(projects, users, tasksPerProject);

      console.log('Database seeding completed successfully!');
    } catch (error) {
      console.error('Database seeding failed:', error);
      throw error;
    }
  }

  async seedUsers(count: number): Promise<void> {
    console.log(`Seeding ${count} users...`);
    await this.userSeeder.seed(count);
    console.log('Users seeded successfully!');
  }

  async seedWorkspaces(count: number, users?: any[]): Promise<void> {
    console.log(`Seeding ${count} workspaces...`);

    if (!users) {
      // Get existing users
      users = await this.userSeeder.getExistingUsers();
    }

    await this.workspaceSeeder.seed(count, users);
    console.log('Workspaces seeded successfully!');
  }

  async clearAllData(): Promise<void> {
    console.log('Clearing existing data...');

    const client = await this.connection.pool.connect();

    try {
      // Disable foreign key checks temporarily
      await client.query('SET session_replication_role = replica');

      // Clear tables in reverse dependency order
      await client.query('TRUNCATE task_dependencies CASCADE');
      await client.query('TRUNCATE tasks CASCADE');
      await client.query('TRUNCATE project_members CASCADE');
      await client.query('TRUNCATE projects CASCADE');
      await client.query('TRUNCATE workspaces CASCADE');
      await client.query('TRUNCATE users CASCADE');

      // Re-enable foreign key checks
      await client.query('SET session_replication_role = DEFAULT');

      console.log('Existing data cleared successfully!');
    } finally {
      client.release();
    }
  }

  async getSeededDataSummary(): Promise<{
    users: number;
    workspaces: number;
    projects: number;
    tasks: number;
    taskDependencies: number;
  }> {
    const client = await this.connection.pool.connect();

    try {
      const [
        usersResult,
        workspacesResult,
        projectsResult,
        tasksResult,
        dependenciesResult,
      ] = await Promise.all([
        client.query('SELECT COUNT(*) FROM users'),
        client.query('SELECT COUNT(*) FROM workspaces'),
        client.query('SELECT COUNT(*) FROM projects'),
        client.query('SELECT COUNT(*) FROM tasks'),
        client.query('SELECT COUNT(*) FROM task_dependencies'),
      ]);

      return {
        users: parseInt(usersResult.rows[0].count),
        workspaces: parseInt(workspacesResult.rows[0].count),
        projects: parseInt(projectsResult.rows[0].count),
        tasks: parseInt(tasksResult.rows[0].count),
        taskDependencies: parseInt(dependenciesResult.rows[0].count),
      };
    } finally {
      client.release();
    }
  }
}

// CLI runner for seeding
if (require.main === module) {
  const environment = (process.argv[2] || 'development') as
    | 'development'
    | 'test'
    | 'staging';
  const userCount = parseInt(process.argv[3]) || 50;
  const workspaceCount = parseInt(process.argv[4]) || 10;
  const clearExisting = process.argv.includes('--clear');

  async function runSeeding() {
    const config = createDatabaseConfig(environment);
    const connection = DatabaseConnection.getInstance(config);

    try {
      await connection.connect();

      const seeder = new DatabaseSeeder(connection);

      await seeder.seedAll({
        environment,
        userCount,
        workspaceCount,
        clearExisting,
      });

      const summary = await seeder.getSeededDataSummary();
      console.log('\nSeeding Summary:');
      console.log(`Users: ${summary.users}`);
      console.log(`Workspaces: ${summary.workspaces}`);
      console.log(`Projects: ${summary.projects}`);
      console.log(`Tasks: ${summary.tasks}`);
      console.log(`Task Dependencies: ${summary.taskDependencies}`);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    } finally {
      await connection.disconnect();
    }
  }

  runSeeding();
}

export { UserSeeder, WorkspaceSeeder, ProjectSeeder, TaskSeeder };
