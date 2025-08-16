import { ConfigLoader } from './app-config';

/**
 * Configuration Integration Validator
 * 
 * Validates that all services are properly integrated with the centralized configuration system
 */
export class ConfigIntegrationValidator {
  
  /**
   * Validate all configurations can be loaded
   */
  static validateAllConfigurations(): {
    isValid: boolean;
    issues: string[];
    loadedConfigs: string[];
  } {
    const issues: string[] = [];
    const loadedConfigs: string[] = [];

    try {
      // Validate central configuration loading
      const configs = ConfigLoader.validateAllConfigs();
      console.log('✅ Central configuration validation passed');

      // Test each configuration type
      const configTests = [
        { name: 'APP_CONFIG', test: () => ConfigLoader.loadAppConfig() },
        { name: 'DATABASE_CONFIG', test: () => ConfigLoader.loadDatabaseConfig() },
        { name: 'REDIS_CONFIG', test: () => ConfigLoader.loadRedisConfig() },
        { name: 'JWT_CONFIG', test: () => ConfigLoader.loadJwtConfig() },
        { name: 'EMAIL_CONFIG', test: () => ConfigLoader.loadEmailConfig() },
      ];

      // Test configuration loading
      for (const config of configTests) {
        try {
          const instance = config.test();
          if (instance) {
            loadedConfigs.push(config.name);
            console.log(`✅ ${config.name} configuration properly loaded`);
          } else {
            issues.push(`❌ ${config.name} configuration failed to load`);
          }
        } catch (error) {
          issues.push(`❌ ${config.name} configuration error: ${error}`);
        }
      }

    } catch (error) {
      issues.push(`❌ Critical configuration error: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      loadedConfigs,
    };
  }

  /**
   * Validate configuration structure and completeness
   */
  static validateConfigurationStructure(): {
    isValid: boolean;
    issues: string[];
    validConfigs: string[];
  } {
    const issues: string[] = [];
    const validConfigs: string[] = [];

    try {
      // Test JWT configuration structure
      const jwtConfig = ConfigLoader.loadJwtConfig();
      if (jwtConfig.accessTokenSecret && jwtConfig.refreshTokenSecret) {
        validConfigs.push('JWT_CONFIG_STRUCTURE');
        console.log('✅ JWT configuration has proper token structure');
      } else {
        issues.push('❌ JWT configuration missing required token secrets');
      }

      // Test Email configuration structure
      const emailConfig = ConfigLoader.loadEmailConfig();
      if (emailConfig.smtp && emailConfig.smtp.host) {
        validConfigs.push('EMAIL_CONFIG_STRUCTURE');
        console.log('✅ Email configuration has proper SMTP structure');
      } else {
        issues.push('❌ Email configuration missing required SMTP structure');
      }

      // Test Redis configuration structure
      const redisConfig = ConfigLoader.loadRedisConfig();
      if (redisConfig.defaultTTL && redisConfig.keyPrefix) {
        validConfigs.push('REDIS_CONFIG_STRUCTURE');
        console.log('✅ Redis configuration has proper cache structure');
      } else {
        issues.push('❌ Redis configuration missing cache properties');
      }

      // Test Database configuration structure
      const dbConfig = ConfigLoader.loadDatabaseConfig();
      if (dbConfig.maxConnections && dbConfig.connectionTimeout) {
        validConfigs.push('DATABASE_CONFIG_STRUCTURE');
        console.log('✅ Database configuration has proper connection pool structure');
      } else {
        issues.push('❌ Database configuration missing connection pool properties');
      }

    } catch (error) {
      issues.push(`❌ Configuration structure validation error: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      validConfigs,
    };
  }

  /**
   * Generate configuration validation report
   */
  static generateValidationReport(validationResult: {
    isValid: boolean;
    issues: string[];
    loadedConfigs?: string[];
    validConfigs?: string[];
  }): string {
    const { isValid, issues, loadedConfigs = [], validConfigs = [] } = validationResult;

    let report = '\n=== CONFIGURATION VALIDATION REPORT ===\n\n';
    
    if (isValid) {
      report += '🎉 ALL CONFIGURATIONS VALID AND PROPERLY LOADED\n\n';
    } else {
      report += '⚠️  CONFIGURATION VALIDATION ISSUES FOUND\n\n';
    }

    if (loadedConfigs.length > 0) {
      report += `✅ Loaded Configurations (${loadedConfigs.length}):\n`;
      loadedConfigs.forEach(config => {
        report += `   - ${config}\n`;
      });
    }

    if (validConfigs.length > 0) {
      report += `\n✅ Valid Configuration Structures (${validConfigs.length}):\n`;
      validConfigs.forEach(config => {
        report += `   - ${config}\n`;
      });
    }

    if (issues.length > 0) {
      report += '\n🔍 Issues Found:\n';
      issues.forEach(issue => {
        report += `   ${issue}\n`;
      });
    }

    report += '\n=== END REPORT ===\n';
    
    return report;
  }

  /**
   * Validate environment variables are properly mapped
   */
  static validateEnvironmentMapping(): {
    isValid: boolean;
    missingVars: string[];
    recommendations: string[];
  } {
    const requiredVars = [
      'NODE_ENV',
      'PORT',
      'DB_HOST',
      'DB_PORT', 
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'REDIS_HOST',
      'REDIS_PORT',
      'JWT_SECRET',
      'EMAIL_HOST',
      'EMAIL_PORT',
    ];

    const missingVars: string[] = [];
    const recommendations: string[] = [];

    requiredVars.forEach(envVar => {
      if (!process.env[envVar]) {
        missingVars.push(envVar);
      }
    });

    if (missingVars.length > 0) {
      recommendations.push('Set missing environment variables in your .env file');
      recommendations.push('Use the setup-environment.ts script to generate default values');
      recommendations.push('Ensure production environment has all required variables');
    }

    return {
      isValid: missingVars.length === 0,
      missingVars,
      recommendations,
    };
  }
}
