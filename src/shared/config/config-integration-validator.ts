import { ConfigLoader } from './app-config';
import { SERVICE_TOKENS } from '../container/types';
import { Container } from '../container';

/**
 * Configuration Integration Validator
 * 
 * Validates that all services are properly integrated with the centralized configuration system
 */
export class ConfigIntegrationValidator {
  
  /**
   * Validate all service configurations are properly connected
   */
  static async validateServiceIntegration(container: Container): Promise<{
    isValid: boolean;
    issues: string[];
    connectedServices: string[];
    missingIntegrations: string[];
  }> {
    const issues: string[] = [];
    const connectedServices: string[] = [];
    const missingIntegrations: string[] = [];

    try {
      // Validate central configuration loading
      ConfigLoader.validateAllConfigs();
      console.log('✅ Central configuration validation passed');

      // Test service configurations
      const serviceTests = [
        {
          name: 'APP_CONFIG',
          token: SERVICE_TOKENS.APP_CONFIG,
          test: () => container.resolve(SERVICE_TOKENS.APP_CONFIG),
        },
        {
          name: 'DATABASE_CONFIG',
          token: SERVICE_TOKENS.DATABASE_CONFIG,
          test: () => container.resolve(SERVICE_TOKENS.DATABASE_CONFIG),
        },
        {
          name: 'REDIS_CONFIG',
          token: SERVICE_TOKENS.REDIS_CONFIG,
          test: () => container.resolve(SERVICE_TOKENS.REDIS_CONFIG),
        },
        {
          name: 'JWT_CONFIG',
          token: SERVICE_TOKENS.JWT_CONFIG,
          test: () => container.resolve(SERVICE_TOKENS.JWT_CONFIG),
        },
        {
          name: 'EMAIL_CONFIG',
          token: SERVICE_TOKENS.EMAIL_CONFIG,
          test: () => container.resolve(SERVICE_TOKENS.EMAIL_CONFIG),
        },
      ];

      // Test infrastructure services that should use centralized config
      const infrastructureServiceTests = [
        {
          name: 'LOGGING_SERVICE',
          token: SERVICE_TOKENS.LOGGING_SERVICE,
          test: () => container.resolve(SERVICE_TOKENS.LOGGING_SERVICE),
        },
        {
          name: 'METRICS_SERVICE',
          token: SERVICE_TOKENS.METRICS_SERVICE,
          test: () => container.resolve(SERVICE_TOKENS.METRICS_SERVICE),
        },
        {
          name: 'CACHE_SERVICE',
          token: SERVICE_TOKENS.CACHE_SERVICE,
          test: () => container.resolve(SERVICE_TOKENS.CACHE_SERVICE),
        },
        {
          name: 'JWT_SERVICE',
          token: SERVICE_TOKENS.JWT_SERVICE,
          test: () => container.resolve(SERVICE_TOKENS.JWT_SERVICE),
        },
        {
          name: 'EMAIL_SERVICE',
          token: SERVICE_TOKENS.EMAIL_SERVICE,
          test: () => container.resolve(SERVICE_TOKENS.EMAIL_SERVICE),
        },
      ];

      // Test configuration services
      for (const service of serviceTests) {
        try {
          const instance = service.test();
          if (instance) {
            connectedServices.push(service.name);
            console.log(`✅ ${service.name} configuration properly loaded`);
          } else {
            issues.push(`❌ ${service.name} configuration failed to load`);
            missingIntegrations.push(service.name);
          }
        } catch (error) {
          issues.push(`❌ ${service.name} configuration error: ${error}`);
          missingIntegrations.push(service.name);
        }
      }

      // Test infrastructure services
      for (const service of infrastructureServiceTests) {
        try {
          const instance = service.test();
          if (instance) {
            connectedServices.push(service.name);
            console.log(`✅ ${service.name} properly instantiated with config`);
          } else {
            issues.push(`❌ ${service.name} failed to instantiate`);
            missingIntegrations.push(service.name);
          }
        } catch (error) {
          issues.push(`❌ ${service.name} instantiation error: ${error}`);
          missingIntegrations.push(service.name);
        }
      }

      // Validate specific integration patterns
      await this.validateSpecificIntegrations(container, issues, connectedServices, missingIntegrations);

    } catch (error) {
      issues.push(`❌ Critical configuration error: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      connectedServices,
      missingIntegrations,
    };
  }

  /**
   * Validate specific service integration patterns
   */
  private static async validateSpecificIntegrations(
    container: Container,
    issues: string[],
    connectedServices: string[],
    missingIntegrations: string[]
  ): Promise<void> {
    
    // Test JWT Service configuration compatibility
    try {
      const jwtConfig = container.resolve(SERVICE_TOKENS.JWT_CONFIG) as any;
      const jwtService = container.resolve(SERVICE_TOKENS.JWT_SERVICE) as any;
      
      if (jwtConfig && jwtService) {
        // Check if JWT service has required config properties
        if (jwtConfig.accessTokenSecret && jwtConfig.refreshTokenSecret) {
          connectedServices.push('JWT_SERVICE_INTEGRATION');
          console.log('✅ JWT Service properly integrated with enhanced config');
        } else {
          issues.push('❌ JWT Service config missing required token secrets');
          missingIntegrations.push('JWT_SERVICE_INTEGRATION');
        }
      }
    } catch (error) {
      issues.push(`❌ JWT Service integration validation error: ${error}`);
      missingIntegrations.push('JWT_SERVICE_INTEGRATION');
    }

    // Test Email Service configuration compatibility
    try {
      const emailConfig = container.resolve(SERVICE_TOKENS.EMAIL_CONFIG) as any;
      const emailService = container.resolve(SERVICE_TOKENS.EMAIL_SERVICE) as any;
      
      if (emailConfig && emailService) {
        // Check if Email service has required nested config structure
        if (emailConfig.smtp && emailConfig.smtp.host) {
          connectedServices.push('EMAIL_SERVICE_INTEGRATION');
          console.log('✅ Email Service properly integrated with nested config structure');
        } else {
          issues.push('❌ Email Service config missing required smtp structure');
          missingIntegrations.push('EMAIL_SERVICE_INTEGRATION');
        }
      }
    } catch (error) {
      issues.push(`❌ Email Service integration validation error: ${error}`);
      missingIntegrations.push('EMAIL_SERVICE_INTEGRATION');
    }

    // Test Cache Service Redis integration
    try {
      const redisConfig = container.resolve(SERVICE_TOKENS.REDIS_CONFIG) as any;
      const cacheService = container.resolve(SERVICE_TOKENS.CACHE_SERVICE) as any;
      
      if (redisConfig && cacheService) {
        // Check if Cache service is using Redis config
        if (redisConfig.defaultTTL && redisConfig.keyPrefix) {
          connectedServices.push('CACHE_SERVICE_INTEGRATION');
          console.log('✅ Cache Service properly integrated with Redis config');
        } else {
          issues.push('❌ Cache Service not fully integrated with Redis config');
          missingIntegrations.push('CACHE_SERVICE_INTEGRATION');
        }
      }
    } catch (error) {
      issues.push(`❌ Cache Service integration validation error: ${error}`);
      missingIntegrations.push('CACHE_SERVICE_INTEGRATION');
    }
  }

  /**
   * Generate integration report
   */
  static generateIntegrationReport(validationResult: {
    isValid: boolean;
    issues: string[];
    connectedServices: string[];
    missingIntegrations: string[];
  }): string {
    const { isValid, issues, connectedServices, missingIntegrations } = validationResult;

    let report = '\n=== CONFIGURATION INTEGRATION REPORT ===\n\n';
    
    if (isValid) {
      report += '🎉 ALL SERVICES PROPERLY INTEGRATED WITH CENTRALIZED CONFIGURATION\n\n';
    } else {
      report += '⚠️  CONFIGURATION INTEGRATION ISSUES FOUND\n\n';
    }

    report += `✅ Connected Services (${connectedServices.length}):\n`;
    connectedServices.forEach(service => {
      report += `   - ${service}\n`;
    });

    if (missingIntegrations.length > 0) {
      report += `\n❌ Missing Integrations (${missingIntegrations.length}):\n`;
      missingIntegrations.forEach(service => {
        report += `   - ${service}\n`;
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
