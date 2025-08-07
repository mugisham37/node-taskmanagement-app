import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Client } from 'pg';
import Redis from 'ioredis';
import { execSync } from 'child_process';
import { createId } from '@paralleldrive/cuid2';

export interface TestContainerConfig {
  postgres: {
    database: string;
    username: string;
    password: string;
    port: number;
  };
  redis: {
    port: number;
  };
  mailhog: {
    smtpPort: number;
    httpPort: number;
  };
}

export class TestContainerManager {
  private containers: Map<string, StartedTestContainer> = new Map();
  private config: TestContainerConfig;
  private isInitialized: boolean = false;

  constructor() {
    this.config = {
      postgres: {
        database: `unified_enterprise_platform_test_${createId()}`,
        username: 'postgres',
        password: 'postgres',
        port: 5432,
      },
      redis: {
        port: 6379,
      },
      mailhog: {
        smtpPort: 1025,
        httpPort: 8025,
      },
    };
  }

  async startPostgreSQL(): Promise<StartedTestContainer> {
    if (this.containers.has('postgres')) {
      return this.containers.get('postgres')!;
    }

    const container = await new GenericContainer('postgres:15-alpine')
      .withEnvironment({
        POSTGRES_DB: this.config.postgres.database,
        POSTGRES_USER: this.config.postgres.username,
        POSTGRES_PASSWORD: this.config.postgres.password,
      })
      .withExposedPorts(this.config.postgres.port)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections', 2)
      )
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=1024m' })
      .start();

    // Initialize database schema
    await this.initializeDatabase(container);

    this.containers.set('postgres', container);
    return container;
  }

  async startRedis(): Promise<StartedTestContainer> {
    if (this.containers.has('redis')) {
      return this.containers.get('redis')!;
    }

    const container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(this.config.redis.port)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .withTmpFs({ '/data': 'rw,noexec,nosuid,size=512m' })
      .start();

    this.containers.set('redis', container);
    return container;
  }

  async startMailHog(): Promise<StartedTestContainer> {
    if (this.containers.has('mailhog')) {
      return this.containers.get('mailhog')!;
    }

    const container = await new GenericContainer('mailhog/mailhog:latest')
      .withExposedPorts(
        this.config.mailhog.smtpPort,
        this.config.mailhog.httpPort
      )
      .withWaitStrategy(
        Wait.forHttp('/api/v1/messages', this.config.mailhog.httpPort)
      )
      .start();

    this.containers.set('mailhog', container);
    return container;
  }

  async startAll(): Promise<{
    postgres: StartedTestContainer;
    redis: StartedTestContainer;
    mailhog: StartedTestContainer;
  }> {
    const [postgres, redis, mailhog] = await Promise.all([
      this.startPostgreSQL(),
      this.startRedis(),
      this.startMailHog(),
    ]);

    return { postgres, redis, mailhog };
  }

  async cleanup(): Promise<void> {
    const stopPromises = Array.from(this.containers.values()).map(container =>
      container.stop()
    );

    await Promise.all(stopPromises);
    this.containers.clear();
  }

  getConnectionString(containerName: 'postgres'): string {
    const container = this.containers.get(containerName);
    if (!container) {
      throw new Error(`Container ${containerName} not started`);
    }

    const host = container.getHost();
    const port = container.getMappedPort(this.config.postgres.port);

    return `postgresql://${this.config.postgres.username}:${this.config.postgres.password}@${host}:${port}/${this.config.postgres.database}`;
  }

  getRedisConfig(): { host: string; port: number } {
    const container = this.containers.get('redis');
    if (!container) {
      throw new Error('Redis container not started');
    }

    return {
      host: container.getHost(),
      port: container.getMappedPort(this.config.redis.port),
    };
  }

  getMailHogConfig(): { smtpHost: string; smtpPort: number; httpUrl: string } {
    const container = this.containers.get('mailhog');
    if (!container) {
      throw new Error('MailHog container not started');
    }

    const host = container.getHost();
    const smtpPort = container.getMappedPort(this.config.mailhog.smtpPort);
    const httpPort = container.getMappedPort(this.config.mailhog.httpPort);

    return {
      smtpHost: host,
      smtpPort,
      httpUrl: `http://${host}:${httpPort}`,
    };
  }

  private async initializeDatabase(
    container: StartedTestContainer
  ): Promise<void> {
    const host = container.getHost();
    const port = container.getMappedPort(this.config.postgres.port);

    const client = new Client({
      host,
      port,
      database: this.config.postgres.database,
      user: this.config.postgres.username,
      password: this.config.postgres.password,
    });

    try {
      await client.connect();

      // Install required extensions
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "btree_gin"');

      // Run Prisma migrations
      process.env.DATABASE_URL = this.getConnectionString('postgres');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } finally {
      await client.end();
    }
  }
}

// Singleton instance for global use
export const testContainerManager = new TestContainerManager();

  async startMinIO(): Promise<StartedTestContainer> {
    if (this.containers.has('minio')) {
      return this.containers.get('minio')!;
    }

    const container = await new GenericContainer('minio/minio:latest')
      .withEnvironment({
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin',
      })
      .withExposedPorts(9000, 9001)
      .withCommand(['server', '/data', '--console-address', ':9001'])
      .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
      .withTmpFs({ '/data': 'rw,noexec,nosuid,size=512m' })
      .start();

    this.containers.set('minio', container);
    return container;
  }

  async startElasticsearch(): Promise<StartedTestContainer> {
    if (this.containers.has('elasticsearch')) {
      return this.containers.get('elasticsearch')!;
    }

    const container = await new GenericContainer('elasticsearch:8.11.0')
      .withEnvironment({
        'discovery.type': 'single-node',
        'xpack.security.enabled': 'false',
        'ES_JAVA_OPTS': '-Xms512m -Xmx512m',
      })
      .withExposedPorts(9200)
      .withWaitStrategy(Wait.forHttp('/_cluster/health', 9200))
      .withTmpFs({ '/usr/share/elasticsearch/data': 'rw,noexec,nosuid,size=1024m' })
      .start();

    this.containers.set('elasticsearch', container);
    return container;
  }

  async startWebhookSite(): Promise<StartedTestContainer> {
    if (this.containers.has('webhook-site')) {
      return this.containers.get('webhook-site')!;
    }

    const container = await new GenericContainer('tarampampam/webhook-tester:latest')
      .withExposedPorts(8080)
      .withWaitStrategy(Wait.forHttp('/', 8080))
      .start();

    this.containers.set('webhook-site', container);
    return container;
  }

  async initializeTestEnvironment(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Start all required containers
    await this.startAll();

    // Initialize test data
    await this.seedTestData();

    this.isInitialized = true;
  }

  private async seedTestData(): Promise<void> {
    const connectionString = this.getConnectionString('postgres');
    const client = new Client({ connectionString });

    try {
      await client.connect();

      // Create test schemas
      await client.query(`
        CREATE SCHEMA IF NOT EXISTS test_data;
        CREATE SCHEMA IF NOT EXISTS test_audit;
      `);

      // Create test functions for data generation
      await client.query(`
        CREATE OR REPLACE FUNCTION test_data.generate_test_user(
          email_prefix TEXT DEFAULT 'test',
          workspace_count INTEGER DEFAULT 1
        ) RETURNS TABLE(user_id TEXT, workspace_ids TEXT[]) AS $$
        DECLARE
          new_user_id TEXT;
          workspace_id TEXT;
          workspace_ids TEXT[] := '{}';
        BEGIN
          new_user_id := 'test_' || extract(epoch from now())::text || '_' || floor(random() * 1000)::text;
          
          INSERT INTO "User" (
            id, email, name, "passwordHash", "emailVerified", "mfaEnabled",
            "totpSecret", "backupCodes", "failedLoginAttempts", "lockedUntil",
            "lastLoginAt", "lastLoginIp", "riskScore", timezone, "workHours",
            "taskViewPreferences", "notificationSettings", "productivitySettings",
            "avatarColor", "activeWorkspaceId", "workspacePreferences"
          ) VALUES (
            new_user_id,
            email_prefix || '_' || new_user_id || '@example.com',
            'Test User ' || new_user_id,
            '$argon2id$v=19$m=65536,t=3,p=4$test',
            NOW(),
            false,
            null,
            '{}',
            0,
            null,
            NOW(),
            '127.0.0.1',
            0.0,
            'UTC',
            '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}',
            '{"defaultView": "list", "groupBy": "status"}',
            '{"email": true, "push": true, "desktop": true}',
            '{"pomodoroLength": 25, "breakLength": 5}',
            '#3B82F6',
            null,
            '{}'
          );

          FOR i IN 1..workspace_count LOOP
            workspace_id := 'ws_' || new_user_id || '_' || i;
            workspace_ids := array_append(workspace_ids, workspace_id);
            
            INSERT INTO "Workspace" (
              id, name, slug, description, "ownerId", "subscriptionTier",
              "billingEmail", settings, branding, "securitySettings",
              "isActive", "memberLimit", "projectLimit", "storageLimitGb", "deletedAt"
            ) VALUES (
              workspace_id,
              'Test Workspace ' || i,
              'test-workspace-' || new_user_id || '-' || i,
              'Test workspace for user ' || new_user_id,
              new_user_id,
              'free',
              null,
              '{}',
              '{}',
              '{}',
              true,
              10,
              5,
              1,
              null
            );

            INSERT INTO "WorkspaceMember" (
              id, "workspaceId", "userId", role, permissions, "invitedBy",
              "invitedAt", "joinedAt", "lastActiveAt", settings
            ) VALUES (
              'wm_' || workspace_id,
              workspace_id,
              new_user_id,
              'OWNER',
              '["*"]',
              new_user_id,
              NOW(),
              NOW(),
              NOW(),
              '{}'
            );
          END LOOP;

          RETURN QUERY SELECT new_user_id, workspace_ids;
        END;
        $$ LANGUAGE plpgsql;
      `);

    } finally {
      await client.end();
    }
  }

  getMinIOConfig(): { endpoint: string; accessKey: string; secretKey: string } {
    const container = this.containers.get('minio');
    if (!container) {
      throw new Error('MinIO container not started');
    }

    return {
      endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
    };
  }

  getElasticsearchConfig(): { node: string } {
    const container = this.containers.get('elasticsearch');
    if (!container) {
      throw new Error('Elasticsearch container not started');
    }

    return {
      node: `http://${container.getHost()}:${container.getMappedPort(9200)}`,
    };
  }

  getWebhookSiteConfig(): { url: string } {
    const container = this.containers.get('webhook-site');
    if (!container) {
      throw new Error('Webhook site container not started');
    }

    return {
      url: `http://${container.getHost()}:${container.getMappedPort(8080)}`,
    };
  }

  async waitForHealthy(containerName: string, timeout: number = 30000): Promise<void> {
    const container = this.containers.get(containerName);
    if (!container) {
      throw new Error(`Container ${containerName} not found`);
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const health = await container.exec(['sh', '-c', 'echo "healthy"']);
        if (health.exitCode === 0) {
          return;
        }
      } catch (error) {
        // Container not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Container ${containerName} did not become healthy within ${timeout}ms`);
  }

  async getContainerLogs(containerName: string): Promise<string> {
    const container = this.containers.get(containerName);
    if (!container) {
      throw new Error(`Container ${containerName} not found`);
    }

    const logs = await container.logs();
    return logs.toString();
  }

  async executeInContainer(containerName: string, command: string[]): Promise<{ exitCode: number; output: string }> {
    const container = this.containers.get(containerName);
    if (!container) {
      throw new Error(`Container ${containerName} not found`);
    }

    const result = await container.exec(command);
    return {
      exitCode: result.exitCode,
      output: result.output,
    };
  }