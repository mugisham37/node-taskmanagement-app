#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

interface SetupOptions {
  environment: 'development' | 'production' | 'staging' | 'test';
  skipDependencies?: boolean;
  skipDatabase?: boolean;
  skipDocker?: boolean;
  generateSecrets?: boolean;
  verbose?: boolean;
}

class EnvironmentSetup {
  private options: SetupOptions;
  private projectRoot: string;

  constructor(options: SetupOptions) {
    this.options = options;
    this.projectRoot = process.cwd();
  }

  async setup(): Promise<void> {
    console.log(`🚀 Setting up ${this.options.environment} environment...`);

    try {
      await this.validatePrerequisites();
      await this.createDirectories();
      await this.generateEnvironmentFile();

      if (!this.options.skipDependencies) {
        await this.installDependencies();
      }

      if (!this.options.skipDatabase) {
        await this.setupDatabase();
      }

      if (!this.options.skipDocker) {
        await this.setupDocker();
      }

      await this.validateSetup();

      console.log('✅ Environment setup completed successfully!');
      this.printNextSteps();
    } catch (error) {
      console.error('❌ Environment setup failed:', error);
      process.exit(1);
    }
  }

  private async validatePrerequisites(): Promise<void> {
    console.log('🔍 Validating prerequisites...');

    const requirements = [
      { command: 'node --version', name: 'Node.js', minVersion: '18.0.0' },
      { command: 'npm --version', name: 'npm', minVersion: '8.0.0' },
      { command: 'docker --version', name: 'Docker', minVersion: '20.0.0' },
      {
        command: 'docker-compose --version',
        name: 'Docker Compose',
        minVersion: '2.0.0',
      },
    ];

    for (const req of requirements) {
      try {
        const output = execSync(req.command, { encoding: 'utf8' });
        const version = this.extractVersion(output);

        if (this.compareVersions(version, req.minVersion) < 0) {
          throw new Error(
            `${req.name} version ${version} is below minimum required ${req.minVersion}`
          );
        }

        console.log(`  ✓ ${req.name} ${version}`);
      } catch (error) {
        throw new Error(`${req.name} is not installed or not accessible`);
      }
    }
  }

  private extractVersion(output: string): string {
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : '0.0.0';
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }

  private async createDirectories(): Promise<void> {
    console.log('📁 Creating required directories...');

    const directories = [
      'logs',
      'uploads',
      'backups',
      'ssl',
      'config/nginx/sites-available',
      'config/grafana/provisioning/dashboards',
      'config/grafana/provisioning/datasources',
      'config/grafana/dashboards',
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  ✓ Created ${dir}`);
      }
    }
  }

  private async generateEnvironmentFile(): Promise<void> {
    console.log('🔧 Generating environment configuration...');

    const envPath = path.join(this.projectRoot, '.env');
    const examplePath = path.join(this.projectRoot, '.env.example');

    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
        console.log('  ✓ Created .env from .env.example');
      } else {
        await this.createDefaultEnvFile(envPath);
        console.log('  ✓ Created default .env file');
      }
    }

    if (this.options.generateSecrets) {
      await this.generateSecrets(envPath);
    }

    await this.updateEnvironmentSpecificSettings(envPath);
  }

  private async createDefaultEnvFile(envPath: string): Promise<void> {
    const defaultEnv = `# Environment Configuration
NODE_ENV=${this.options.environment}
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unified_enterprise_platform
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/unified_enterprise_platform_test

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=${this.generateSecret(64)}
JWT_REFRESH_SECRET=${this.generateSecret(64)}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
SESSION_SECRET=${this.generateSecret(64)}
CSRF_SECRET=${this.generateSecret(64)}
BCRYPT_ROUNDS=12

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_FROM=noreply@unified-enterprise-platform.com

# Monitoring Configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
LOG_LEVEL=info

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_MFA=true
ENABLE_OAUTH=true
ENABLE_API_DOCS=true

# Webhook Configuration
WEBHOOK_SECRET=${this.generateSecret(32)}
`;

    fs.writeFileSync(envPath, defaultEnv);
  }

  private generateSecret(length: number): string {
    return createHash('sha256')
      .update(Math.random().toString() + Date.now().toString())
      .digest('hex')
      .substring(0, length);
  }

  private async generateSecrets(envPath: string): Promise<void> {
    console.log('🔐 Generating secure secrets...');

    let envContent = fs.readFileSync(envPath, 'utf8');

    const secretFields = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'SESSION_SECRET',
      'CSRF_SECRET',
      'WEBHOOK_SECRET',
    ];

    for (const field of secretFields) {
      const regex = new RegExp(`${field}=.*`, 'g');
      const newSecret = this.generateSecret(64);

      if (envContent.includes(`${field}=`)) {
        envContent = envContent.replace(regex, `${field}=${newSecret}`);
      } else {
        envContent += `\n${field}=${newSecret}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log('  ✓ Generated secure secrets');
  }

  private async updateEnvironmentSpecificSettings(
    envPath: string
  ): Promise<void> {
    let envContent = fs.readFileSync(envPath, 'utf8');

    const environmentSettings = {
      development: {
        LOG_LEVEL: 'debug',
        ENABLE_API_DOCS: 'true',
        BCRYPT_ROUNDS: '10',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
      },
      production: {
        LOG_LEVEL: 'info',
        ENABLE_API_DOCS: 'false',
        BCRYPT_ROUNDS: '12',
        TRUST_PROXY: 'true',
      },
      staging: {
        LOG_LEVEL: 'debug',
        ENABLE_API_DOCS: 'true',
        BCRYPT_ROUNDS: '12',
      },
      test: {
        LOG_LEVEL: 'error',
        ENABLE_API_DOCS: 'false',
        BCRYPT_ROUNDS: '4',
        PORT: '3001',
      },
    };

    const settings = environmentSettings[this.options.environment];

    for (const [key, value] of Object.entries(settings)) {
      const regex = new RegExp(`${key}=.*`, 'g');

      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log(
      `  ✓ Updated settings for ${this.options.environment} environment`
    );
  }

  private async installDependencies(): Promise<void> {
    console.log('📦 Installing dependencies...');

    try {
      execSync('npm ci', {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        cwd: this.projectRoot,
      });
      console.log('  ✓ Dependencies installed');
    } catch (error) {
      throw new Error('Failed to install dependencies');
    }
  }

  private async setupDatabase(): Promise<void> {
    console.log('🗄️  Setting up database...');

    try {
      // Generate Prisma client
      execSync('npx prisma generate', {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        cwd: this.projectRoot,
      });
      console.log('  ✓ Generated Prisma client');

      if (this.options.environment !== 'production') {
        // Run database migrations
        execSync('npx prisma migrate dev --name init', {
          stdio: this.options.verbose ? 'inherit' : 'pipe',
          cwd: this.projectRoot,
        });
        console.log('  ✓ Applied database migrations');

        // Seed database
        execSync('npm run db:seed', {
          stdio: this.options.verbose ? 'inherit' : 'pipe',
          cwd: this.projectRoot,
        });
        console.log('  ✓ Seeded database');
      }
    } catch (error) {
      console.warn(
        '  ⚠️  Database setup failed (this is normal if database is not running)'
      );
    }
  }

  private async setupDocker(): Promise<void> {
    console.log('🐳 Setting up Docker environment...');

    try {
      // Create additional Docker configuration files
      await this.createDockerConfigs();

      if (this.options.environment === 'development') {
        // Start development services
        execSync('docker-compose up -d postgres redis mailhog', {
          stdio: this.options.verbose ? 'inherit' : 'pipe',
          cwd: this.projectRoot,
        });
        console.log('  ✓ Started development services');
      }
    } catch (error) {
      console.warn('  ⚠️  Docker setup failed (Docker may not be running)');
    }
  }

  private async createDockerConfigs(): Promise<void> {
    // Redis configuration
    const redisConfig = `# Redis Configuration
bind 0.0.0.0
port 6379
timeout 0
tcp-keepalive 300
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile ""
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ./
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
`;

    fs.writeFileSync(
      path.join(this.projectRoot, 'config/redis.conf'),
      redisConfig
    );

    // Prometheus configuration
    const prometheusConfig = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'unified-platform-app'
    static_configs:
      - targets: ['app:9091']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
`;

    fs.writeFileSync(
      path.join(this.projectRoot, 'config/prometheus.yml'),
      prometheusConfig
    );

    // Nginx configuration
    const nginxConfig = `events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://app/health;
            access_log off;
        }
    }
}
`;

    fs.writeFileSync(
      path.join(this.projectRoot, 'config/nginx.conf'),
      nginxConfig
    );

    console.log('  ✓ Created Docker configuration files');
  }

  private async validateSetup(): Promise<void> {
    console.log('✅ Validating setup...');

    const validations = [
      { name: 'Environment file', check: () => fs.existsSync('.env') },
      { name: 'Configuration directory', check: () => fs.existsSync('config') },
      { name: 'Logs directory', check: () => fs.existsSync('logs') },
      { name: 'Uploads directory', check: () => fs.existsSync('uploads') },
      { name: 'Node modules', check: () => fs.existsSync('node_modules') },
    ];

    for (const validation of validations) {
      if (validation.check()) {
        console.log(`  ✓ ${validation.name}`);
      } else {
        console.warn(`  ⚠️  ${validation.name} not found`);
      }
    }
  }

  private printNextSteps(): void {
    console.log('\n🎉 Setup completed! Next steps:');
    console.log('');

    if (this.options.environment === 'development') {
      console.log('1. Start the development environment:');
      console.log('   npm run dev');
      console.log('');
      console.log('2. Or start with Docker:');
      console.log('   docker-compose up');
      console.log('');
      console.log('3. Access the application:');
      console.log('   - API: http://localhost:3000');
      console.log('   - API Docs: http://localhost:3000/docs');
      console.log('   - MailHog: http://localhost:8025');
      console.log('   - Prometheus: http://localhost:9090');
    } else if (this.options.environment === 'production') {
      console.log('1. Review and update the .env file with production values');
      console.log('2. Set up SSL certificates in the ssl/ directory');
      console.log('3. Deploy with Docker Compose:');
      console.log('   docker-compose -f docker-compose.production.yml up -d');
      console.log('');
      console.log('4. Monitor the deployment:');
      console.log('   docker-compose -f docker-compose.production.yml logs -f');
    }

    console.log('');
    console.log('📚 Documentation:');
    console.log('   - README.md for detailed setup instructions');
    console.log('   - API documentation at /docs endpoint');
    console.log('');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const environment = (args[0] as SetupOptions['environment']) || 'development';

  const options: SetupOptions = {
    environment,
    skipDependencies: args.includes('--skip-deps'),
    skipDatabase: args.includes('--skip-db'),
    skipDocker: args.includes('--skip-docker'),
    generateSecrets: args.includes('--generate-secrets'),
    verbose: args.includes('--verbose'),
  };

  if (!['development', 'production', 'staging', 'test'].includes(environment)) {
    console.error(
      '❌ Invalid environment. Use: development, production, staging, or test'
    );
    process.exit(1);
  }

  const setup = new EnvironmentSetup(options);
  await setup.setup();
}

if (require.main === module) {
  main().catch(console.error);
}

export { EnvironmentSetup, SetupOptions };
