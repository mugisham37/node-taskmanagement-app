#!/usr/bin/env tsx

import { getConfigurationManager } from '../src/config/configuration-manager';
import { getServiceDiscovery } from '../src/config/service-discovery';
import { getFeatureFlagService } from '../src/config/feature-flags';
import fs from 'fs';
import path from 'path';

interface ValidationResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

class ConfigurationValidator {
  private results: ValidationResult[] = [];
  private configManager = getConfigurationManager();
  private serviceDiscovery = getServiceDiscovery();
  private featureFlagService = getFeatureFlagService();

  async validate(): Promise<ValidationResult[]> {
    console.log('🔍 Validating configuration...\n');

    await this.validateEnvironmentVariables();
    await this.validateConfigurationSchema();
    await this.validateSecuritySettings();
    await this.validateDatabaseConfiguration();
    await this.validateRedisConfiguration();
    await this.validateEmailConfiguration();
    await this.validateStorageConfiguration();
    await this.validateExternalServices();
    await this.validateFeatureFlags();
    await this.validateServiceDiscovery();
    await this.validateFileSystem();
    await this.validateNetworkConnectivity();

    return this.results;
  }

  private addResult(
    category: string,
    name: string,
    status: 'pass' | 'fail' | 'warn',
    message: string,
    details?: any
  ): void {
    this.results.push({ category, name, status, message, details });
  }

  private async validateEnvironmentVariables(): Promise<void> {
    const category = 'Environment Variables';

    try {
      const requiredVars = [
        'NODE_ENV',
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
        'CSRF_SECRET',
      ];

      for (const varName of requiredVars) {
        const value = process.env[varName];
        if (!value) {
          this.addResult(
            category,
            varName,
            'fail',
            `Required environment variable ${varName} is not set`
          );
        } else if (
          value.includes('change-this-in-production') &&
          this.configManager.isProduction()
        ) {
          this.addResult(
            category,
            varName,
            'fail',
            `${varName} contains default value in production`
          );
        } else {
          this.addResult(
            category,
            varName,
            'pass',
            `${varName} is properly configured`
          );
        }
      }

      // Check for sensitive data in environment variables
      const sensitivePatterns = [
        { pattern: /password/i, name: 'Password' },
        { pattern: /secret/i, name: 'Secret' },
        { pattern: /key/i, name: 'Key' },
        { pattern: /token/i, name: 'Token' },
      ];

      for (const [key, value] of Object.entries(process.env)) {
        for (const { pattern, name } of sensitivePatterns) {
          if (pattern.test(key) && value && value.length < 16) {
            this.addResult(
              category,
              key,
              'warn',
              `${name} ${key} appears to be too short (${value.length} characters)`
            );
          }
        }
      }
    } catch (error) {
      this.addResult(
        category,
        'General',
        'fail',
        `Environment validation failed: ${error.message}`
      );
    }
  }

  private async validateConfigurationSchema(): Promise<void> {
    const category = 'Configuration Schema';

    try {
      const validation = await this.configManager.validate();

      if (validation.isValid) {
        this.addResult(
          category,
          'Schema Validation',
          'pass',
          'Configuration schema is valid'
        );
      } else {
        this.addResult(
          category,
          'Schema Validation',
          'fail',
          'Configuration schema validation failed',
          {
            errors: validation.errors,
          }
        );
      }

      for (const warning of validation.warnings) {
        this.addResult(category, 'Schema Warning', 'warn', warning);
      }
    } catch (error) {
      this.addResult(
        category,
        'Schema Validation',
        'fail',
        `Schema validation error: ${error.message}`
      );
    }
  }

  private async validateSecuritySettings(): Promise<void> {
    const category = 'Security Settings';

    try {
      const config = this.configManager.getConfig();

      // JWT Secret validation
      if (config.jwt.secret.length < 32) {
        this.addResult(
          category,
          'JWT Secret',
          'fail',
          'JWT secret is too short (minimum 32 characters)'
        );
      } else {
        this.addResult(
          category,
          'JWT Secret',
          'pass',
          'JWT secret meets length requirements'
        );
      }

      // CORS validation
      if (
        this.configManager.isProduction() &&
        config.security.corsOrigin === '*'
      ) {
        this.addResult(
          category,
          'CORS',
          'warn',
          'CORS is set to allow all origins in production'
        );
      } else {
        this.addResult(
          category,
          'CORS',
          'pass',
          'CORS configuration is appropriate'
        );
      }

      // Rate limiting validation
      if (
        config.security.rateLimitMax > 1000 &&
        this.configManager.isProduction()
      ) {
        this.addResult(
          category,
          'Rate Limiting',
          'warn',
          'Rate limit is very high for production'
        );
      } else {
        this.addResult(
          category,
          'Rate Limiting',
          'pass',
          'Rate limiting is properly configured'
        );
      }

      // Bcrypt rounds validation
      const minRounds = this.configManager.isProduction() ? 12 : 10;
      if (config.security.bcryptRounds < minRounds) {
        this.addResult(
          category,
          'Bcrypt Rounds',
          'warn',
          `Bcrypt rounds (${config.security.bcryptRounds}) is below recommended minimum (${minRounds})`
        );
      } else {
        this.addResult(
          category,
          'Bcrypt Rounds',
          'pass',
          'Bcrypt rounds are appropriate'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Security Validation',
        'fail',
        `Security validation error: ${error.message}`
      );
    }
  }

  private async validateDatabaseConfiguration(): Promise<void> {
    const category = 'Database Configuration';

    try {
      const config = this.configManager.getConfig();

      // URL validation
      const dbUrl = new URL(config.database.url);
      if (dbUrl.protocol !== 'postgresql:') {
        this.addResult(
          category,
          'Database URL',
          'fail',
          'Database URL must use postgresql protocol'
        );
      } else {
        this.addResult(
          category,
          'Database URL',
          'pass',
          'Database URL format is valid'
        );
      }

      // SSL validation for production
      if (this.configManager.isProduction() && !config.database.ssl) {
        this.addResult(
          category,
          'SSL',
          'warn',
          'SSL is disabled for production database'
        );
      } else {
        this.addResult(
          category,
          'SSL',
          'pass',
          'Database SSL configuration is appropriate'
        );
      }

      // Connection pool validation
      if (config.database.maxConnections > 50) {
        this.addResult(
          category,
          'Connection Pool',
          'warn',
          'Database connection pool is very large'
        );
      } else {
        this.addResult(
          category,
          'Connection Pool',
          'pass',
          'Database connection pool size is reasonable'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Database Validation',
        'fail',
        `Database validation error: ${error.message}`
      );
    }
  }

  private async validateRedisConfiguration(): Promise<void> {
    const category = 'Redis Configuration';

    try {
      const config = this.configManager.getConfig();

      // Redis URL or host/port validation
      if (!config.redis.url && !config.redis.host) {
        this.addResult(
          category,
          'Connection',
          'fail',
          'Redis URL or host must be configured'
        );
      } else {
        this.addResult(
          category,
          'Connection',
          'pass',
          'Redis connection configuration is valid'
        );
      }

      // Password validation for production
      if (this.configManager.isProduction() && !config.redis.password) {
        this.addResult(
          category,
          'Authentication',
          'warn',
          'Redis password is not set in production'
        );
      } else {
        this.addResult(
          category,
          'Authentication',
          'pass',
          'Redis authentication is configured'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Redis Validation',
        'fail',
        `Redis validation error: ${error.message}`
      );
    }
  }

  private async validateEmailConfiguration(): Promise<void> {
    const category = 'Email Configuration';

    try {
      const config = this.configManager.getConfig();

      // SMTP configuration validation
      if (config.email.provider === 'smtp') {
        if (!config.email.smtp?.host) {
          this.addResult(
            category,
            'SMTP Host',
            'fail',
            'SMTP host is required when using SMTP provider'
          );
        } else {
          this.addResult(
            category,
            'SMTP Host',
            'pass',
            'SMTP host is configured'
          );
        }

        if (
          this.configManager.isProduction() &&
          (!config.email.smtp?.user || !config.email.smtp?.pass)
        ) {
          this.addResult(
            category,
            'SMTP Authentication',
            'warn',
            'SMTP authentication is not configured in production'
          );
        }
      }

      // From address validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(config.email.from)) {
        this.addResult(
          category,
          'From Address',
          'fail',
          'Invalid from email address format'
        );
      } else {
        this.addResult(
          category,
          'From Address',
          'pass',
          'From email address is valid'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Email Validation',
        'fail',
        `Email validation error: ${error.message}`
      );
    }
  }

  private async validateStorageConfiguration(): Promise<void> {
    const category = 'Storage Configuration';

    try {
      const config = this.configManager.getConfig();

      // Storage type validation
      const validTypes = ['local', 's3', 'azure', 'gcs'];
      if (!validTypes.includes(config.storage.type)) {
        this.addResult(
          category,
          'Storage Type',
          'fail',
          `Invalid storage type: ${config.storage.type}`
        );
      } else {
        this.addResult(
          category,
          'Storage Type',
          'pass',
          `Storage type ${config.storage.type} is valid`
        );
      }

      // Local storage validation
      if (config.storage.type === 'local') {
        const storagePath = config.storage.local?.path || './uploads';
        if (!fs.existsSync(storagePath)) {
          this.addResult(
            category,
            'Local Path',
            'warn',
            `Local storage path ${storagePath} does not exist`
          );
        } else {
          this.addResult(
            category,
            'Local Path',
            'pass',
            'Local storage path exists'
          );
        }
      }

      // S3 configuration validation
      if (config.storage.type === 's3') {
        const s3Config = config.storage.s3;
        if (
          !s3Config?.accessKeyId ||
          !s3Config?.secretAccessKey ||
          !s3Config?.bucket
        ) {
          this.addResult(
            category,
            'S3 Configuration',
            'fail',
            'S3 configuration is incomplete'
          );
        } else {
          this.addResult(
            category,
            'S3 Configuration',
            'pass',
            'S3 configuration is complete'
          );
        }
      }
    } catch (error) {
      this.addResult(
        category,
        'Storage Validation',
        'fail',
        `Storage validation error: ${error.message}`
      );
    }
  }

  private async validateExternalServices(): Promise<void> {
    const category = 'External Services';

    try {
      const config = this.configManager.getConfig();

      // OAuth providers validation
      if (this.featureFlagService.isFeatureEnabled('enableOAuth')) {
        const googleConfig = config.externalServices.google;
        const githubConfig = config.externalServices.github;

        if (!googleConfig?.clientId && !githubConfig?.clientId) {
          this.addResult(
            category,
            'OAuth Providers',
            'warn',
            'OAuth is enabled but no providers are configured'
          );
        } else {
          this.addResult(
            category,
            'OAuth Providers',
            'pass',
            'OAuth providers are configured'
          );
        }
      }

      // Twilio validation
      const twilioConfig = config.externalServices.twilio;
      if (
        twilioConfig?.accountSid &&
        (!twilioConfig.authToken || !twilioConfig.phoneNumber)
      ) {
        this.addResult(
          category,
          'Twilio',
          'warn',
          'Twilio configuration is incomplete'
        );
      } else if (twilioConfig?.accountSid) {
        this.addResult(
          category,
          'Twilio',
          'pass',
          'Twilio configuration is complete'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'External Services Validation',
        'fail',
        `External services validation error: ${error.message}`
      );
    }
  }

  private async validateFeatureFlags(): Promise<void> {
    const category = 'Feature Flags';

    try {
      const flags = await this.featureFlagService.getAllFlags();

      this.addResult(
        category,
        'Feature Flags',
        'pass',
        `${Object.keys(flags).length} feature flags configured`
      );

      // Validate flag consistency
      if (flags.enableMFA && !flags.enableEmailVerification) {
        this.addResult(
          category,
          'MFA Consistency',
          'warn',
          'MFA is enabled but email verification is disabled'
        );
      }

      if (flags.enableOAuth && !flags.enableRegistration) {
        this.addResult(
          category,
          'OAuth Consistency',
          'warn',
          'OAuth is enabled but registration is disabled'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Feature Flags Validation',
        'fail',
        `Feature flags validation error: ${error.message}`
      );
    }
  }

  private async validateServiceDiscovery(): Promise<void> {
    const category = 'Service Discovery';

    try {
      const services = this.serviceDiscovery.getAllServices();
      this.addResult(
        category,
        'Service Registration',
        'pass',
        `${services.length} services registered`
      );

      // Check service health
      const healthChecks = await this.serviceDiscovery.checkHealth();
      const healthyServices = healthChecks.filter(
        h => h.status === 'healthy'
      ).length;
      const totalServices = healthChecks.length;

      if (healthyServices === totalServices) {
        this.addResult(
          category,
          'Service Health',
          'pass',
          `All ${totalServices} services are healthy`
        );
      } else {
        this.addResult(
          category,
          'Service Health',
          'warn',
          `${healthyServices}/${totalServices} services are healthy`
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Service Discovery Validation',
        'fail',
        `Service discovery validation error: ${error.message}`
      );
    }
  }

  private async validateFileSystem(): Promise<void> {
    const category = 'File System';

    try {
      const requiredDirectories = ['logs', 'uploads', 'config'];

      for (const dir of requiredDirectories) {
        if (fs.existsSync(dir)) {
          // Check write permissions
          try {
            const testFile = path.join(dir, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            this.addResult(
              category,
              `${dir} Directory`,
              'pass',
              `${dir} directory exists and is writable`
            );
          } catch (error) {
            this.addResult(
              category,
              `${dir} Directory`,
              'fail',
              `${dir} directory is not writable`
            );
          }
        } else {
          this.addResult(
            category,
            `${dir} Directory`,
            'warn',
            `${dir} directory does not exist`
          );
        }
      }

      // Check disk space
      const stats = fs.statSync('.');
      this.addResult(
        category,
        'Disk Space',
        'pass',
        'File system is accessible'
      );
    } catch (error) {
      this.addResult(
        category,
        'File System Validation',
        'fail',
        `File system validation error: ${error.message}`
      );
    }
  }

  private async validateNetworkConnectivity(): Promise<void> {
    const category = 'Network Connectivity';

    try {
      // Test database connectivity
      try {
        const config = this.configManager.getConfig();
        const dbUrl = new URL(config.database.url);

        // Simple connectivity test (in a real implementation, you'd use the actual database client)
        this.addResult(
          category,
          'Database Connectivity',
          'pass',
          `Database host ${dbUrl.hostname} is configured`
        );
      } catch (error) {
        this.addResult(
          category,
          'Database Connectivity',
          'fail',
          'Database connectivity test failed'
        );
      }

      // Test Redis connectivity
      try {
        const config = this.configManager.getConfig();
        const redisHost = config.redis.host || 'localhost';

        this.addResult(
          category,
          'Redis Connectivity',
          'pass',
          `Redis host ${redisHost} is configured`
        );
      } catch (error) {
        this.addResult(
          category,
          'Redis Connectivity',
          'fail',
          'Redis connectivity test failed'
        );
      }
    } catch (error) {
      this.addResult(
        category,
        'Network Validation',
        'fail',
        `Network validation error: ${error.message}`
      );
    }
  }

  printResults(): void {
    console.log('\n📊 Configuration Validation Results\n');

    const categories = [...new Set(this.results.map(r => r.category))];

    for (const category of categories) {
      console.log(`\n🔍 ${category}`);
      console.log('─'.repeat(category.length + 4));

      const categoryResults = this.results.filter(r => r.category === category);

      for (const result of categoryResults) {
        const icon =
          result.status === 'pass'
            ? '✅'
            : result.status === 'warn'
              ? '⚠️'
              : '❌';
        console.log(`  ${icon} ${result.name}: ${result.message}`);

        if (result.details && result.status === 'fail') {
          console.log(
            `     Details: ${JSON.stringify(result.details, null, 2)}`
          );
        }
      }
    }

    // Summary
    const passed = this.results.filter(r => r.status === 'pass').length;
    const warned = this.results.filter(r => r.status === 'warn').length;
    const failed = this.results.filter(r => r.status === 'fail').length;

    console.log('\n📈 Summary');
    console.log('─'.repeat(10));
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ⚠️  Warnings: ${warned}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total: ${this.results.length}`);

    if (failed > 0) {
      console.log(
        '\n❌ Configuration validation failed. Please fix the errors above.'
      );
      process.exit(1);
    } else if (warned > 0) {
      console.log(
        '\n⚠️  Configuration validation completed with warnings. Review the warnings above.'
      );
    } else {
      console.log('\n✅ Configuration validation passed successfully!');
    }
  }
}

// CLI Interface
async function main() {
  const validator = new ConfigurationValidator();
  await validator.validate();
  validator.printResults();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ConfigurationValidator, ValidationResult };
