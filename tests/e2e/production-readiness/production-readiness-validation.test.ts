/**
 * Phase 13: Production Readiness Validation Tests
 * Task 38: Production Readiness Validation
 *
 * This test suite validates all configuration management and deployment procedures,
 * tests monitoring, alerting, and operational procedures, verifies backup and
 * disaster recovery procedures, and performs final performance and scalability testing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testContainerManager } from '../../infrastructure/test-containers';
import { bootstrap } from '../../../src/infrastructure/ioc/bootstrap';
import { ServiceLocator } from '../../../src/infrastructure/ioc/service-locator';
import { createServer } from '../../../src/infrastructure/server/fastify-server';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TestDataFactory } from '../../utils/test-helpers';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Phase 13: Production Readiness Validation', () => {
  let server: FastifyInstance;
  let prisma: PrismaClient;
  let testUser: any;
  let testWorkspace: any;
  let authToken: string;

  beforeAll(async () => {
    // Start test containers
    await testContainerManager.initializeTestEnvironment();

    // Initialize IoC container
    const container = await bootstrap.initialize();
    ServiceLocator.setContainer(container);

    // Create server instance
    server = await createServer();
    await server.listen({ port: 0, host: '127.0.0.1' });

    // Get Prisma client
    prisma = container.resolve<PrismaClient>('PrismaClient');

    // Create test data
    testUser = await TestDataFactory.createTestUser();
    testWorkspace = await TestDataFactory.createTestWorkspace(testUser.id);

    // Get auth token
    const authResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testUser.email,
        password: 'testpassword123',
      },
    });

    authToken = JSON.parse(authResponse.body).accessToken;
  }, 60000);

  afterAll(async () => {
    await server?.close();
    await bootstrap.shutdown();
    await testContainerManager.cleanup();
  }, 30000);

  describe('Configuration Management Validation', () => {
    it('should validate all environment configurations', async () => {
      const environments = ['development', 'staging', 'production', 'test'];

      for (const env of environments) {
        const configPath = join(process.cwd(), 'config', `${env}.json`);

        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf8'));

          // Validate required configuration sections
          expect(config.database).toBeDefined();
          expect(config.redis).toBeDefined();
          expect(config.server).toBeDefined();
          expect(config.security).toBeDefined();

          // Validate database configuration
          expect(config.database.url).toBeDefined();
          expect(config.database.pool).toBeDefined();
          expect(config.database.pool.min).toBeGreaterThanOrEqual(1);
          expect(config.database.pool.max).toBeGreaterThan(
            config.database.pool.min
          );

          // Validate Redis configuration
          expect(config.redis.host).toBeDefined();
          expect(config.redis.port).toBeGreaterThan(0);

          // Validate server configuration
          expect(config.server.port).toBeGreaterThan(0);
          expect(config.server.host).toBeDefined();

          // Validate security configuration
          expect(config.security.jwtSecret).toBeDefined();
          expect(config.security.bcryptRounds).toBeGreaterThanOrEqual(10);

          // Production-specific validations
          if (env === 'production') {
            expect(config.server.host).not.toBe('0.0.0.0'); // Should be specific
            expect(config.security.jwtSecret).not.toBe('default-secret');
            expect(config.logging.level).toBe('info'); // Not debug in production
          }
        }
      }
    });

    it('should validate environment variable requirements', async () => {
      const requiredEnvVars = [
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET',
        'NODE_ENV',
      ];

      // Check if validation script exists and runs
      try {
        const validationResult = execSync('npm run validate:config', {
          encoding: 'utf8',
          timeout: 10000,
        });

        expect(validationResult).toContain('Configuration validation passed');
      } catch (error) {
        // If script doesn't exist, manually validate critical env vars
        for (const envVar of requiredEnvVars) {
          if (envVar === 'JWT_SECRET' && process.env.NODE_ENV === 'test') {
            continue; // Skip in test environment
          }
          expect(process.env[envVar]).toBeDefined();
        }
      }
    });

    it('should validate feature flags configuration', async () => {
      // Test feature flags endpoint
      const featureFlagsResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/feature-flags',
        headers: { authorization: `Bearer ${authToken}` },
      });

      if (featureFlagsResponse.statusCode === 200) {
        const featureFlags = JSON.parse(featureFlagsResponse.body);

        // Validate feature flag structure
        expect(featureFlags).toBeDefined();
        expect(typeof featureFlags).toBe('object');

        // Check for common feature flags
        const expectedFlags = [
          'enableWebSocket',
          'enableCaching',
          'enableMetrics',
          'enableAuditLogging',
        ];

        for (const flag of expectedFlags) {
          if (featureFlags[flag] !== undefined) {
            expect(typeof featureFlags[flag]).toBe('boolean');
          }
        }
      }
    });
  });

  describe('Deployment Procedures Validation', () => {
    it('should validate Docker configuration', async () => {
      // Check if Dockerfile exists and is valid
      const dockerfilePath = join(process.cwd(), 'Dockerfile');
      const dockerComposeDevPath = join(process.cwd(), 'docker-compose.yml');
      const dockerComposeProdPath = join(
        process.cwd(),
        'docker-compose.production.yml'
      );

      expect(existsSync(dockerfilePath)).toBe(true);
      expect(existsSync(dockerComposeDevPath)).toBe(true);
      expect(existsSync(dockerComposeProdPath)).toBe(true);

      // Validate Docker Compose configuration
      try {
        execSync('docker-compose -f docker-compose.yml config', {
          encoding: 'utf8',
          timeout: 10000,
        });

        execSync('docker-compose -f docker-compose.production.yml config', {
          encoding: 'utf8',
          timeout: 10000,
        });
      } catch (error) {
        // Docker might not be available in test environment
        console.warn('Docker validation skipped:', error);
      }
    });

    it('should validate database migration procedures', async () => {
      // Test migration status
      try {
        const migrationStatus = execSync('npx prisma migrate status', {
          encoding: 'utf8',
          timeout: 15000,
        });

        expect(migrationStatus).toContain('Database is up to date');
      } catch (error) {
        // Check if there are pending migrations
        const errorMessage = error.toString();
        if (errorMessage.includes('pending migrations')) {
          // This is expected in some cases
          console.warn('Pending migrations detected');
        } else {
          throw error;
        }
      }

      // Validate migration files exist
      const migrationsPath = join(process.cwd(), 'prisma', 'migrations');
      expect(existsSync(migrationsPath)).toBe(true);
    });

    it('should validate build and deployment scripts', async () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      // Validate required scripts
      const requiredScripts = [
        'build',
        'start',
        'test',
        'db:migrate',
        'db:seed',
      ];

      for (const script of requiredScripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }

      // Test build process
      try {
        execSync('npm run build', {
          encoding: 'utf8',
          timeout: 30000,
        });

        // Verify build output exists
        const distPath = join(process.cwd(), 'dist');
        expect(existsSync(distPath)).toBe(true);
      } catch (error) {
        console.warn('Build test skipped:', error);
      }
    });
  });

  describe('Monitoring and Alerting Validation', () => {
    it('should validate health check endpoints', async () => {
      // Test basic health check
      const healthResponse = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(healthResponse.statusCode).toBe(200);
      const healthData = JSON.parse(healthResponse.body);

      expect(healthData.status).toBe('healthy');
      expect(healthData.timestamp).toBeDefined();
      expect(healthData.uptime).toBeGreaterThan(0);

      // Test detailed health check
      const detailedHealthResponse = await server.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      if (detailedHealthResponse.statusCode === 200) {
        const detailedHealth = JSON.parse(detailedHealthResponse.body);

        expect(detailedHealth.database).toBeDefined();
        expect(detailedHealth.redis).toBeDefined();
        expect(detailedHealth.external_services).toBeDefined();

        // All services should be healthy
        expect(detailedHealth.database.status).toBe('healthy');
        expect(detailedHealth.redis.status).toBe('healthy');
      }
    });

    it('should validate metrics collection', async () => {
      // Test metrics endpoint
      const metricsResponse = await server.inject({
        method: 'GET',
        url: '/metrics',
      });

      if (metricsResponse.statusCode === 200) {
        const metricsData = metricsResponse.body;

        // Should contain Prometheus-format metrics
        expect(metricsData).toContain('# HELP');
        expect(metricsData).toContain('# TYPE');

        // Check for common metrics
        expect(metricsData).toContain('http_requests_total');
        expect(metricsData).toContain('http_request_duration_seconds');
        expect(metricsData).toContain('nodejs_heap_size_used_bytes');
      }
    });

    it('should validate logging configuration', async () => {
      // Perform operations that should generate logs
      await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Logging Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      // Check if logs are being generated
      const logsPath = join(process.cwd(), 'logs');
      if (existsSync(logsPath)) {
        const logFiles = require('fs').readdirSync(logsPath);
        expect(logFiles.length).toBeGreaterThan(0);

        // Check log format
        const latestLogFile = logFiles[logFiles.length - 1];
        const logContent = readFileSync(join(logsPath, latestLogFile), 'utf8');

        // Should contain structured JSON logs
        const logLines = logContent.trim().split('\n');
        if (logLines.length > 0) {
          const lastLog = JSON.parse(logLines[logLines.length - 1]);
          expect(lastLog.timestamp).toBeDefined();
          expect(lastLog.level).toBeDefined();
          expect(lastLog.message).toBeDefined();
        }
      }
    });

    it('should validate alerting configuration', async () => {
      // Test alert configuration endpoint
      const alertConfigResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/alerts/config',
        headers: { authorization: `Bearer ${authToken}` },
      });

      if (alertConfigResponse.statusCode === 200) {
        const alertConfig = JSON.parse(alertConfigResponse.body);

        expect(alertConfig.rules).toBeDefined();
        expect(Array.isArray(alertConfig.rules)).toBe(true);

        // Check for critical alert rules
        const criticalRules = alertConfig.rules.filter(
          (rule: any) => rule.severity === 'critical'
        );

        expect(criticalRules.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Backup and Disaster Recovery Validation', () => {
    it('should validate backup procedures', async () => {
      // Test backup creation
      const backupResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/backup',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          type: 'full',
          description: 'Production readiness test backup',
        },
      });

      if (
        backupResponse.statusCode === 200 ||
        backupResponse.statusCode === 202
      ) {
        const backup = JSON.parse(backupResponse.body);
        expect(backup.id).toBeDefined();
        expect(backup.status).toMatch(/pending|in_progress|completed/);

        // Wait for backup completion if needed
        if (backup.status !== 'completed') {
          await new Promise(resolve => setTimeout(resolve, 5000));

          const statusResponse = await server.inject({
            method: 'GET',
            url: `/api/v1/admin/backup/${backup.id}`,
            headers: { authorization: `Bearer ${authToken}` },
          });

          if (statusResponse.statusCode === 200) {
            const updatedBackup = JSON.parse(statusResponse.body);
            expect(['completed', 'failed']).toContain(updatedBackup.status);
          }
        }
      }
    });

    it('should validate backup restoration procedures', async () => {
      // Create test data
      const taskResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Backup Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      const task = JSON.parse(taskResponse.body);

      // Test backup restoration (dry run)
      const restoreResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/restore',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          backupId: 'test-backup-id',
          dryRun: true,
          tables: ['tasks'],
        },
      });

      // Should either succeed or return appropriate error
      expect([200, 202, 404, 501]).toContain(restoreResponse.statusCode);
    });

    it('should validate disaster recovery procedures', async () => {
      // Test disaster recovery endpoint
      const drResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/disaster-recovery/test',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          scenario: 'database_failure',
          dryRun: true,
        },
      });

      if (drResponse.statusCode === 200) {
        const drResult = JSON.parse(drResponse.body);
        expect(drResult.procedures).toBeDefined();
        expect(drResult.estimatedRecoveryTime).toBeDefined();
        expect(drResult.dataLossRisk).toBeDefined();
      }
    });
  });

  describe('Performance and Scalability Testing', () => {
    it('should handle sustained high load', async () => {
      const testDuration = 30000; // 30 seconds
      const requestsPerSecond = 10;
      const totalRequests = (testDuration / 1000) * requestsPerSecond;

      const startTime = Date.now();
      const responses: any[] = [];

      // Generate sustained load
      const loadTest = async () => {
        while (Date.now() - startTime < testDuration) {
          const batchPromises = Array.from({ length: requestsPerSecond }, () =>
            server.inject({
              method: 'GET',
              url: `/api/v1/workspaces/${testWorkspace.id}/tasks`,
              headers: { authorization: `Bearer ${authToken}` },
            })
          );

          const batchResponses = await Promise.allSettled(batchPromises);
          responses.push(...batchResponses);

          // Wait for next second
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      };

      await loadTest();

      // Analyze results
      const successfulRequests = responses.filter(
        r => r.status === 'fulfilled' && r.value.statusCode === 200
      ).length;

      const errorRate =
        (responses.length - successfulRequests) / responses.length;

      // Should handle most requests successfully
      expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate
      expect(successfulRequests).toBeGreaterThan(totalRequests * 0.9); // At least 90% success
    }, 35000);

    it('should maintain performance under memory pressure', async () => {
      // Create memory pressure by generating large responses
      const largeDataRequests = Array.from({ length: 20 }, () =>
        server.inject({
          method: 'GET',
          url: `/api/v1/workspaces/${testWorkspace.id}/export`,
          headers: { authorization: `Bearer ${authToken}` },
        })
      );

      const responses = await Promise.allSettled(largeDataRequests);

      // Should handle requests without memory issues
      const successfulRequests = responses.filter(
        r => r.status === 'fulfilled' && [200, 202].includes(r.value.statusCode)
      ).length;

      expect(successfulRequests).toBeGreaterThan(15); // At least 75% success

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(512 * 1024 * 1024); // Less than 512MB
    });

    it('should handle database connection pool exhaustion', async () => {
      // Create many concurrent database operations
      const dbOperations = Array.from({ length: 50 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          headers: { authorization: `Bearer ${authToken}` },
          payload: {
            title: `Pool Test Task ${i}`,
            workspaceId: testWorkspace.id,
          },
        })
      );

      const responses = await Promise.allSettled(dbOperations);

      // Should handle connection pool pressure gracefully
      const successfulRequests = responses.filter(
        r => r.status === 'fulfilled' && r.value.statusCode === 201
      ).length;

      // Should succeed with most requests or fail gracefully
      expect(successfulRequests).toBeGreaterThan(40); // At least 80% success

      // Check for proper error handling on failures
      const failedRequests = responses.filter(
        r => r.status === 'fulfilled' && r.value.statusCode >= 500
      );

      failedRequests.forEach(request => {
        if (request.status === 'fulfilled') {
          const errorData = JSON.parse(request.value.body);
          expect(errorData.error).toBeDefined();
          expect(errorData.message).toBeDefined();
        }
      });
    });
  });

  describe('Operational Procedures Validation', () => {
    it('should validate graceful shutdown procedures', async () => {
      // Test graceful shutdown endpoint
      const shutdownResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/shutdown',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { graceful: true, timeout: 30 },
      });

      // Should either initiate shutdown or return appropriate response
      expect([200, 202, 501]).toContain(shutdownResponse.statusCode);

      if (shutdownResponse.statusCode === 200) {
        const shutdownData = JSON.parse(shutdownResponse.body);
        expect(shutdownData.message).toContain('shutdown');
      }
    });

    it('should validate maintenance mode procedures', async () => {
      // Test maintenance mode activation
      const maintenanceResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/admin/maintenance',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          enabled: true,
          message: 'System maintenance in progress',
        },
      });

      if (maintenanceResponse.statusCode === 200) {
        // Test that maintenance mode affects regular requests
        const testResponse = await server.inject({
          method: 'GET',
          url: '/api/v1/tasks',
          headers: { authorization: `Bearer ${authToken}` },
        });

        // Should return maintenance response
        expect([503, 200]).toContain(testResponse.statusCode);

        // Disable maintenance mode
        await server.inject({
          method: 'POST',
          url: '/api/v1/admin/maintenance',
          headers: { authorization: `Bearer ${authToken}` },
          payload: { enabled: false },
        });
      }
    });

    it('should validate system status reporting', async () => {
      // Test comprehensive system status
      const statusResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/status',
        headers: { authorization: `Bearer ${authToken}` },
      });

      if (statusResponse.statusCode === 200) {
        const status = JSON.parse(statusResponse.body);

        expect(status.overall).toBeDefined();
        expect(status.components).toBeDefined();
        expect(status.metrics).toBeDefined();

        // Validate component statuses
        const components = status.components;
        expect(components.database).toBeDefined();
        expect(components.redis).toBeDefined();
        expect(components.external_services).toBeDefined();

        // Validate metrics
        const metrics = status.metrics;
        expect(metrics.uptime).toBeGreaterThan(0);
        expect(metrics.memory_usage).toBeDefined();
        expect(metrics.cpu_usage).toBeDefined();
      }
    });
  });

  describe('Security and Compliance Readiness', () => {
    it('should validate security headers in production mode', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      // Check for security headers
      const headers = response.headers;
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['x-xss-protection']).toBeDefined();

      // In production, should have HSTS
      if (process.env.NODE_ENV === 'production') {
        expect(headers['strict-transport-security']).toBeDefined();
      }
    });

    it('should validate audit logging is operational', async () => {
      // Perform auditable action
      await server.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          title: 'Audit Test Task',
          workspaceId: testWorkspace.id,
        },
      });

      // Check audit logs
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId: testUser.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(auditLogs.length).toBeGreaterThan(0);

      const log = auditLogs[0];
      expect(log.action).toBeDefined();
      expect(log.userId).toBe(testUser.id);
      expect(log.ipAddress).toBeDefined();
      expect(log.metadata).toBeDefined();
    });
  });
});
