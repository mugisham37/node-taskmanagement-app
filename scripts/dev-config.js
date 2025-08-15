#!/usr/bin/env node

/**
 * Development Configuration Manager
 * Handles environment setup, service management, and development utilities
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DevConfig {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaultConfig = {
      services: {
        client: {
          port: 3000,
          command: 'npm run dev',
          cwd: 'apps/client',
          env: {
            NODE_ENV: 'development',
            NEXT_PUBLIC_API_URL: 'http://localhost:3001',
            NEXT_PUBLIC_WS_URL: 'ws://localhost:3001'
          }
        },
        server: {
          port: 3001,
          command: 'npm run dev',
          cwd: 'apps/server',
          env: {
            NODE_ENV: 'development',
            PORT: '3001',
            CORS_ORIGIN: 'http://localhost:3000'
          }
        },
        database: {
          port: 5432,
          service: 'postgresql',
          docker: true
        },
        redis: {
          port: 6379,
          service: 'redis',
          docker: true
        }
      },
      build: {
        order: [
          '@taskmanagement/shared',
          '@taskmanagement/database',
          '@taskmanagement/config',
          '@taskmanagement/ui',
          '@taskmanagement/server',
          '@taskmanagement/client'
        ]
      },
      watch: {
        patterns: [
          'packages/*/src/**/*.ts',
          'packages/*/src/**/*.tsx',
          'apps/*/src/**/*.ts',
          'apps/*/src/**/*.tsx'
        ],
        ignore: [
          'node_modules',
          'dist',
          '.next',
          'coverage'
        ]
      }
    };

    // Try to load custom config
    const configPath = path.join(this.rootDir, 'dev.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...customConfig };
      } catch (error) {
        console.warn('⚠️  Failed to load custom dev config, using defaults');
        return defaultConfig;
      }
    }

    return defaultConfig;
  }

  saveConfig() {
    const configPath = path.join(this.rootDir, 'dev.config.json');
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    console.log('✅ Development configuration saved');
  }

  getServiceConfig(serviceName) {
    return this.config.services[serviceName];
  }

  updateServiceConfig(serviceName, updates) {
    if (this.config.services[serviceName]) {
      this.config.services[serviceName] = {
        ...this.config.services[serviceName],
        ...updates
      };
      this.saveConfig();
    }
  }

  getBuildOrder() {
    return this.config.build.order;
  }

  getWatchPatterns() {
    return this.config.watch.patterns;
  }

  // Generate environment files based on config
  generateEnvFiles() {
    console.log('🔧 Generating environment files...');

    // Root .env
    const rootEnv = `# Root Environment Configuration
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmanagement
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-change-in-production
`;
    fs.writeFileSync(path.join(this.rootDir, '.env'), rootEnv);

    // Client .env.local
    const clientConfig = this.getServiceConfig('client');
    const clientEnv = Object.entries(clientConfig.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const clientEnvPath = path.join(this.rootDir, 'apps/client/.env.local');
    fs.writeFileSync(clientEnvPath, `# Client Environment\n${clientEnv}\n`);

    // Server .env
    const serverConfig = this.getServiceConfig('server');
    const serverEnv = Object.entries(serverConfig.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const serverEnvPath = path.join(this.rootDir, 'apps/server/.env');
    fs.writeFileSync(serverEnvPath, `# Server Environment\n${serverEnv}\nDATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmanagement\nREDIS_URL=redis://localhost:6379\nJWT_SECRET=dev-jwt-secret-change-in-production\n`);

    console.log('✅ Environment files generated');
  }

  // Validate development setup
  validateSetup() {
    console.log('🔍 Validating development setup...');
    
    const issues = [];

    // Check required files
    const requiredFiles = [
      'package.json',
      'turbo.json',
      'tsconfig.json',
      'apps/client/package.json',
      'apps/server/package.json'
    ];

    requiredFiles.forEach(file => {
      if (!fs.existsSync(path.join(this.rootDir, file))) {
        issues.push(`Missing required file: ${file}`);
      }
    });

    // Check workspace packages
    const workspaces = ['shared', 'database', 'ui', 'config'];
    workspaces.forEach(workspace => {
      const pkgPath = path.join(this.rootDir, 'packages', workspace, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        issues.push(`Missing workspace package: packages/${workspace}`);
      }
    });

    if (issues.length > 0) {
      console.log('❌ Setup validation failed:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      return false;
    }

    console.log('✅ Development setup validation passed');
    return true;
  }

  // Display current configuration
  displayConfig() {
    console.log('📋 Current Development Configuration:');
    console.log('=====================================');
    
    console.log('\n🌐 Services:');
    Object.entries(this.config.services).forEach(([name, config]) => {
      console.log(`  ${name}:`);
      console.log(`    Port: ${config.port || 'N/A'}`);
      console.log(`    Command: ${config.command || 'N/A'}`);
      if (config.cwd) console.log(`    Directory: ${config.cwd}`);
    });

    console.log('\n🔨 Build Order:');
    this.config.build.order.forEach((pkg, index) => {
      console.log(`  ${index + 1}. ${pkg}`);
    });

    console.log('\n👀 Watch Patterns:');
    this.config.watch.patterns.forEach(pattern => {
      console.log(`  - ${pattern}`);
    });
  }
}

// CLI interface
const command = process.argv[2];
const devConfig = new DevConfig();

switch (command) {
  case 'generate-env':
    devConfig.generateEnvFiles();
    break;
  case 'validate':
    devConfig.validateSetup();
    break;
  case 'show':
    devConfig.displayConfig();
    break;
  case 'init':
    devConfig.generateEnvFiles();
    devConfig.validateSetup();
    break;
  default:
    console.log('📋 Available commands:');
    console.log('  generate-env  - Generate environment files');
    console.log('  validate      - Validate development setup');
    console.log('  show          - Display current configuration');
    console.log('  init          - Initialize development environment');
}

module.exports = DevConfig;