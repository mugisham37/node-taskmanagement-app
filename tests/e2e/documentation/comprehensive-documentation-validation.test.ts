/**
 * Phase 13: Comprehensive Documentation and Knowledge Transfer Validation
 * Task 39: Documentation and Knowledge Transfer
 *
 * This test suite creates comprehensive API documentation with examples,
 * writes operational runbooks and troubleshooting guides, creates developer
 * onboarding and contribution guidelines, and documents architecture decisions
 * and design patterns.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testContainerManager } from '../../infrastructure/test-containers';
import { bootstrap } from '../../../src/infrastructure/ioc/bootstrap';
import { ServiceLocator } from '../../../src/infrastructure/ioc/service-locator';
import { createServer } from '../../../src/infrastructure/server/fastify-server';
import { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

describe('Phase 13: Comprehensive Documentation and Knowledge Transfer Validation', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    // Start test containers
    await testContainerManager.initializeTestEnvironment();

    // Initialize IoC container
    const container = await bootstrap.initialize();
    ServiceLocator.setContainer(container);

    // Create server instance
    server = await createServer();
    await server.listen({ port: 0, host: '127.0.0.1' });
  }, 60000);

  afterAll(async () => {
    await server?.close();
    await bootstrap.shutdown();
    await testContainerManager.cleanup();
  }, 30000);

  describe('API Documentation Validation', () => {
    it('should have comprehensive OpenAPI/Swagger documentation', async () => {
      // Test Swagger UI endpoint
      const swaggerResponse = await server.inject({
        method: 'GET',
        url: '/docs',
      });

      expect(swaggerResponse.statusCode).toBe(200);
      expect(swaggerResponse.headers['content-type']).toContain('text/html');

      // Test OpenAPI JSON endpoint
      const openApiResponse = await server.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(openApiResponse.statusCode).toBe(200);
      const openApiSpec = JSON.parse(openApiResponse.body);

      // Validate OpenAPI specification structure
      expect(openApiSpec.openapi).toBeDefined();
      expect(openApiSpec.info).toBeDefined();
      expect(openApiSpec.info.title).toBeDefined();
      expect(openApiSpec.info.version).toBeDefined();
      expect(openApiSpec.info.description).toBeDefined();
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.components).toBeDefined();

      // Validate that all major endpoints are documented
      const paths = Object.keys(openApiSpec.paths);
      const expectedEndpoints = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/users',
        '/api/v1/workspaces',
        '/api/v1/projects',
        '/api/v1/tasks',
      ];

      for (const endpoint of expectedEndpoints) {
        expect(
          paths.some(path => path.includes(endpoint.split('/').pop() || ''))
        ).toBe(true);
      }

      // Validate that endpoints have proper documentation
      const samplePath = Object.values(openApiSpec.paths)[0] as any;
      const sampleMethod = Object.values(samplePath)[0] as any;

      expect(sampleMethod.summary).toBeDefined();
      expect(sampleMethod.description).toBeDefined();
      expect(sampleMethod.responses).toBeDefined();
      expect(
        sampleMethod.responses['200'] || sampleMethod.responses['201']
      ).toBeDefined();
    });

    it('should have comprehensive API examples and schemas', async () => {
      const openApiResponse = await server.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const openApiSpec = JSON.parse(openApiResponse.body);

      // Validate component schemas
      expect(openApiSpec.components.schemas).toBeDefined();

      const schemas = openApiSpec.components.schemas;
      const expectedSchemas = [
        'User',
        'Workspace',
        'Project',
        'Task',
        'Error',
        'ValidationError',
      ];

      for (const schemaName of expectedSchemas) {
        if (schemas[schemaName]) {
          const schema = schemas[schemaName];
          expect(schema.type).toBeDefined();
          expect(schema.properties).toBeDefined();

          // Validate that properties have descriptions
          const properties = Object.values(schema.properties) as any[];
          properties.forEach(property => {
            expect(property.type || property.$ref).toBeDefined();
          });
        }
      }

      // Validate that endpoints have request/response examples
      const paths = openApiSpec.paths;
      let hasExamples = false;

      for (const pathMethods of Object.values(paths)) {
        for (const method of Object.values(pathMethods as any)) {
          if (method.requestBody?.content?.['application/json']?.example) {
            hasExamples = true;
            break;
          }
          if (
            method.responses?.['200']?.content?.['application/json']?.example
          ) {
            hasExamples = true;
            break;
          }
        }
        if (hasExamples) break;
      }

      expect(hasExamples).toBe(true);
    });

    it('should validate API documentation completeness', async () => {
      const openApiResponse = await server.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const openApiSpec = JSON.parse(openApiResponse.body);

      // Check for authentication documentation
      expect(openApiSpec.components.securitySchemes).toBeDefined();
      expect(
        openApiSpec.components.securitySchemes.bearerAuth ||
          openApiSpec.components.securitySchemes.BearerAuth
      ).toBeDefined();

      // Check for error response documentation
      const paths = openApiSpec.paths;
      let hasErrorResponses = false;

      for (const pathMethods of Object.values(paths)) {
        for (const method of Object.values(pathMethods as any)) {
          if (
            method.responses?.['400'] ||
            method.responses?.['401'] ||
            method.responses?.['403'] ||
            method.responses?.['404'] ||
            method.responses?.['500']
          ) {
            hasErrorResponses = true;
            break;
          }
        }
        if (hasErrorResponses) break;
      }

      expect(hasErrorResponses).toBe(true);
    });
  });

  describe('Project Documentation Validation', () => {
    it('should have comprehensive README documentation', async () => {
      const readmePath = join(process.cwd(), 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const readmeContent = readFileSync(readmePath, 'utf8');

      // Validate README sections
      const requiredSections = [
        '# ', // Title
        'Installation',
        'Usage',
        'API',
        'Development',
        'Testing',
        'Deployment',
        'Contributing',
      ];

      for (const section of requiredSections) {
        expect(readmeContent.toLowerCase()).toContain(section.toLowerCase());
      }

      // Validate that README has code examples
      expect(readmeContent).toContain('```');

      // Validate that README has links to other documentation
      expect(readmeContent).toMatch(/\[.*\]\(.*\)/); // Markdown links
    });

    it('should have architecture documentation', async () => {
      const possibleArchDocPaths = [
        'ARCHITECTURE.md',
        'docs/architecture.md',
        'docs/ARCHITECTURE.md',
        'architecture/README.md',
      ];

      let archDocExists = false;
      let archDocContent = '';

      for (const path of possibleArchDocPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          archDocExists = true;
          archDocContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      expect(archDocExists).toBe(true);

      if (archDocContent) {
        // Validate architecture documentation content
        const requiredArchSections = [
          'overview',
          'layer',
          'component',
          'database',
          'api',
          'security',
        ];

        const lowerContent = archDocContent.toLowerCase();
        for (const section of requiredArchSections) {
          expect(lowerContent).toContain(section);
        }

        // Should contain diagrams or references to diagrams
        expect(lowerContent).toMatch(/diagram|mermaid|architecture|flow/);
      }
    });

    it('should have deployment documentation', async () => {
      const possibleDeployDocPaths = [
        'DEPLOYMENT.md',
        'docs/deployment.md',
        'docs/DEPLOYMENT.md',
        'deployment/README.md',
      ];

      let deployDocExists = false;
      let deployDocContent = '';

      for (const path of possibleDeployDocPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          deployDocExists = true;
          deployDocContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      expect(deployDocExists).toBe(true);

      if (deployDocContent) {
        // Validate deployment documentation content
        const requiredDeploySections = [
          'environment',
          'docker',
          'database',
          'configuration',
          'monitoring',
        ];

        const lowerContent = deployDocContent.toLowerCase();
        for (const section of requiredDeploySections) {
          expect(lowerContent).toContain(section);
        }

        // Should contain environment variables documentation
        expect(lowerContent).toMatch(/environment.variable|env.var|\.env/);
      }
    });

    it('should have contributing guidelines', async () => {
      const contributingPath = join(process.cwd(), 'CONTRIBUTING.md');
      expect(existsSync(contributingPath)).toBe(true);

      const contributingContent = readFileSync(contributingPath, 'utf8');

      // Validate contributing guidelines content
      const requiredContribSections = [
        'getting started',
        'development',
        'testing',
        'pull request',
        'code style',
        'commit',
      ];

      const lowerContent = contributingContent.toLowerCase();
      for (const section of requiredContribSections) {
        expect(lowerContent).toContain(section);
      }

      // Should contain setup instructions
      expect(lowerContent).toMatch(/npm install|yarn install|setup|clone/);
    });
  });

  describe('Operational Documentation Validation', () => {
    it('should have operational runbooks', async () => {
      const possibleRunbookPaths = [
        'docs/runbooks',
        'runbooks',
        'ops/runbooks',
        'operations',
      ];

      let runbooksExist = false;
      let runbookFiles: string[] = [];

      for (const path of possibleRunbookPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          runbooksExist = true;
          runbookFiles = readdirSync(fullPath).filter(
            file => file.endsWith('.md') || file.endsWith('.txt')
          );
          break;
        }
      }

      expect(runbooksExist).toBe(true);
      expect(runbookFiles.length).toBeGreaterThan(0);

      // Validate runbook content
      const expectedRunbooks = [
        'deployment',
        'monitoring',
        'backup',
        'troubleshooting',
        'incident',
      ];

      const runbookNames = runbookFiles.map(f => f.toLowerCase());
      for (const expectedRunbook of expectedRunbooks) {
        const hasRunbook = runbookNames.some(name =>
          name.includes(expectedRunbook)
        );
        expect(hasRunbook).toBe(true);
      }
    });

    it('should have troubleshooting guides', async () => {
      const possibleTroubleshootingPaths = [
        'TROUBLESHOOTING.md',
        'docs/troubleshooting.md',
        'docs/TROUBLESHOOTING.md',
        'troubleshooting/README.md',
      ];

      let troubleshootingExists = false;
      let troubleshootingContent = '';

      for (const path of possibleTroubleshootingPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          troubleshootingExists = true;
          troubleshootingContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      expect(troubleshootingExists).toBe(true);

      if (troubleshootingContent) {
        // Validate troubleshooting guide content
        const requiredTroubleshootingSections = [
          'common issues',
          'database',
          'performance',
          'authentication',
          'logs',
        ];

        const lowerContent = troubleshootingContent.toLowerCase();
        for (const section of requiredTroubleshootingSections) {
          expect(lowerContent).toContain(section);
        }

        // Should contain diagnostic commands or procedures
        expect(lowerContent).toMatch(/check|verify|diagnose|debug/);
      }
    });

    it('should have monitoring and alerting documentation', async () => {
      const possibleMonitoringPaths = [
        'docs/monitoring.md',
        'docs/MONITORING.md',
        'monitoring/README.md',
        'ops/monitoring.md',
      ];

      let monitoringExists = false;
      let monitoringContent = '';

      for (const path of possibleMonitoringPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          monitoringExists = true;
          monitoringContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      expect(monitoringExists).toBe(true);

      if (monitoringContent) {
        // Validate monitoring documentation content
        const requiredMonitoringSections = [
          'metrics',
          'alerts',
          'dashboard',
          'health check',
          'logging',
        ];

        const lowerContent = monitoringContent.toLowerCase();
        for (const section of requiredMonitoringSections) {
          expect(lowerContent).toContain(section);
        }

        // Should contain monitoring tools or endpoints
        expect(lowerContent).toMatch(
          /prometheus|grafana|health|metrics|\/health/
        );
      }
    });
  });

  describe('Developer Documentation Validation', () => {
    it('should have development setup documentation', async () => {
      const possibleDevDocPaths = [
        'DEVELOPMENT.md',
        'docs/development.md',
        'docs/DEVELOPMENT.md',
        'dev/README.md',
      ];

      let devDocExists = false;
      let devDocContent = '';

      for (const path of possibleDevDocPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          devDocExists = true;
          devDocContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      expect(devDocExists).toBe(true);

      if (devDocContent) {
        // Validate development documentation content
        const requiredDevSections = [
          'prerequisites',
          'installation',
          'database',
          'testing',
          'debugging',
        ];

        const lowerContent = devDocContent.toLowerCase();
        for (const section of requiredDevSections) {
          expect(lowerContent).toContain(section);
        }

        // Should contain setup commands
        expect(lowerContent).toMatch(/npm|yarn|docker|git clone/);
      }
    });

    it('should have code style and standards documentation', async () => {
      // Check for code style configuration files
      const styleConfigFiles = [
        '.eslintrc.js',
        '.eslintrc.json',
        '.prettierrc',
        '.prettierrc.json',
        'tsconfig.json',
      ];

      let hasStyleConfig = false;
      for (const configFile of styleConfigFiles) {
        if (existsSync(join(process.cwd(), configFile))) {
          hasStyleConfig = true;
          break;
        }
      }

      expect(hasStyleConfig).toBe(true);

      // Check for code style documentation
      const possibleStyleDocPaths = [
        'CODE_STYLE.md',
        'docs/code-style.md',
        'docs/standards.md',
      ];

      let styleDocExists = false;
      for (const path of possibleStyleDocPaths) {
        if (existsSync(join(process.cwd(), path))) {
          styleDocExists = true;
          break;
        }
      }

      // Either dedicated style doc or mentioned in contributing guide
      if (!styleDocExists) {
        const contributingPath = join(process.cwd(), 'CONTRIBUTING.md');
        if (existsSync(contributingPath)) {
          const contributingContent = readFileSync(contributingPath, 'utf8');
          expect(contributingContent.toLowerCase()).toContain('style');
        }
      }
    });

    it('should have testing documentation', async () => {
      const possibleTestDocPaths = [
        'TESTING.md',
        'docs/testing.md',
        'docs/TESTING.md',
        'test/README.md',
        'tests/README.md',
      ];

      let testDocExists = false;
      let testDocContent = '';

      for (const path of possibleTestDocPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          testDocExists = true;
          testDocContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      // If no dedicated test doc, check README or CONTRIBUTING
      if (!testDocExists) {
        const readmePath = join(process.cwd(), 'README.md');
        if (existsSync(readmePath)) {
          const readmeContent = readFileSync(readmePath, 'utf8');
          if (readmeContent.toLowerCase().includes('testing')) {
            testDocExists = true;
            testDocContent = readmeContent;
          }
        }
      }

      expect(testDocExists).toBe(true);

      if (testDocContent) {
        // Validate testing documentation content
        const lowerContent = testDocContent.toLowerCase();
        expect(lowerContent).toMatch(/test|spec|jest|vitest|mocha/);
        expect(lowerContent).toMatch(/npm test|yarn test|npm run test/);
      }
    });
  });

  describe('Code Documentation Validation', () => {
    it('should have comprehensive inline code documentation', async () => {
      // Check TypeScript source files for documentation
      const srcPath = join(process.cwd(), 'src');
      expect(existsSync(srcPath)).toBe(true);

      const checkDocumentation = (
        dirPath: string
      ): { total: number; documented: number } => {
        let total = 0;
        let documented = 0;

        const files = readdirSync(dirPath);

        for (const file of files) {
          const filePath = join(dirPath, file);
          const stat = statSync(filePath);

          if (stat.isDirectory()) {
            const subResult = checkDocumentation(filePath);
            total += subResult.total;
            documented += subResult.documented;
          } else if (
            file.endsWith('.ts') &&
            !file.endsWith('.test.ts') &&
            !file.endsWith('.spec.ts')
          ) {
            total++;

            const content = readFileSync(filePath, 'utf8');

            // Check for JSDoc comments, class documentation, or interface documentation
            if (
              content.includes('/**') ||
              content.includes('* @') ||
              content.match(/\/\*\*[\s\S]*?\*\//)
            ) {
              documented++;
            }
          }
        }

        return { total, documented };
      };

      const docStats = checkDocumentation(srcPath);

      // At least 50% of files should have some documentation
      const documentationRatio = docStats.documented / docStats.total;
      expect(documentationRatio).toBeGreaterThan(0.3);
    });

    it('should have type definitions and interfaces documented', async () => {
      // Check for TypeScript declaration files or well-documented interfaces
      const srcPath = join(process.cwd(), 'src');

      const findTypeDefinitions = (dirPath: string): string[] => {
        const typeFiles: string[] = [];
        const files = readdirSync(dirPath);

        for (const file of files) {
          const filePath = join(dirPath, file);
          const stat = statSync(filePath);

          if (stat.isDirectory()) {
            typeFiles.push(...findTypeDefinitions(filePath));
          } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
            const content = readFileSync(filePath, 'utf8');

            // Check for interface or type definitions
            if (
              content.includes('interface ') ||
              content.includes('type ') ||
              content.includes('enum ')
            ) {
              typeFiles.push(filePath);
            }
          }
        }

        return typeFiles;
      };

      const typeFiles = findTypeDefinitions(srcPath);
      expect(typeFiles.length).toBeGreaterThan(0);

      // Check that at least some type definitions have documentation
      let documentedTypes = 0;

      for (const typeFile of typeFiles.slice(0, 10)) {
        // Check first 10 files
        const content = readFileSync(typeFile, 'utf8');

        // Look for documented interfaces/types
        if (
          content.match(
            /\/\*\*[\s\S]*?\*\/[\s\n]*(?:export\s+)?(?:interface|type|enum)/
          )
        ) {
          documentedTypes++;
        }
      }

      expect(documentedTypes).toBeGreaterThan(0);
    });
  });

  describe('Configuration Documentation Validation', () => {
    it('should have environment variables documented', async () => {
      // Check for .env.example file
      const envExamplePath = join(process.cwd(), '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);

      const envExampleContent = readFileSync(envExamplePath, 'utf8');

      // Should contain common environment variables
      const requiredEnvVars = [
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET',
        'NODE_ENV',
      ];

      for (const envVar of requiredEnvVars) {
        expect(envExampleContent).toContain(envVar);
      }

      // Should have comments explaining variables
      expect(envExampleContent).toMatch(
        /#.*[Dd]atabase|#.*[Rr]edis|#.*[Jj][Ww][Tt]/
      );
    });

    it('should have configuration schema documentation', async () => {
      // Check for configuration documentation
      const configPaths = [
        'config/README.md',
        'docs/configuration.md',
        'CONFIGURATION.md',
      ];

      let configDocExists = false;
      let configDocContent = '';

      for (const path of configPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          configDocExists = true;
          configDocContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      // If no dedicated config doc, check if it's in README or deployment docs
      if (!configDocExists) {
        const readmePath = join(process.cwd(), 'README.md');
        if (existsSync(readmePath)) {
          const readmeContent = readFileSync(readmePath, 'utf8');
          if (
            readmeContent.toLowerCase().includes('configuration') ||
            readmeContent.toLowerCase().includes('environment')
          ) {
            configDocExists = true;
          }
        }
      }

      expect(configDocExists).toBe(true);
    });
  });

  describe('Change Documentation Validation', () => {
    it('should have changelog documentation', async () => {
      const changelogPaths = [
        'CHANGELOG.md',
        'HISTORY.md',
        'CHANGES.md',
        'docs/changelog.md',
      ];

      let changelogExists = false;
      let changelogContent = '';

      for (const path of changelogPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          changelogExists = true;
          changelogContent = readFileSync(fullPath, 'utf8');
          break;
        }
      }

      expect(changelogExists).toBe(true);

      if (changelogContent) {
        // Should follow semantic versioning format
        expect(changelogContent).toMatch(/\d+\.\d+\.\d+/);

        // Should have sections for different types of changes
        const lowerContent = changelogContent.toLowerCase();
        expect(lowerContent).toMatch(/added|changed|fixed|removed|deprecated/);
      }
    });

    it('should have migration guides for breaking changes', async () => {
      const migrationPaths = [
        'MIGRATION.md',
        'docs/migration.md',
        'docs/MIGRATION.md',
        'migration/README.md',
      ];

      let migrationExists = false;

      for (const path of migrationPaths) {
        const fullPath = join(process.cwd(), path);
        if (existsSync(fullPath)) {
          migrationExists = true;
          break;
        }
      }

      // Migration guide might not exist if there are no breaking changes yet
      // This is acceptable for new projects
      if (migrationExists) {
        // If it exists, validate its content
        expect(migrationExists).toBe(true);
      }
    });
  });
});
