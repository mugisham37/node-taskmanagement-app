import { CacheConfigLoader } from '../cache/cache-config';
import { DatabaseConfigLoader } from '../database/database-config';
import { environmentLoader } from '../environment/environment-loader';
import { FeatureFlagsLoader } from '../features/feature-flags';
import { MonitoringConfigLoader } from '../monitoring/monitoring-config';
import { SecretsManagerLoader } from '../secrets/secrets-manager';
import { SecurityConfigLoader } from '../security/security-config';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  component: string;
}

/**
 * Configuration validation summary
 */
export interface ValidationSummary {
  isValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  results: ValidationResult[];
  recommendations: string[];
}

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate all configuration components
   */
  static async validateAll(): Promise<ValidationSummary> {
    const results: ValidationResult[] = [];

    // Validate environment configuration
    results.push(this.validateEnvironment());

    // Validate database configuration
    results.push(this.validateDatabase());

    // Validate security configuration
    results.push(this.validateSecurity());

    // Validate monitoring configuration
    results.push(this.validateMonitoring());

    // Validate cache configuration
    results.push(this.validateCache());

    // Validate feature flags
    results.push(this.validateFeatureFlags());

    // Validate secrets manager
    results.push(this.validateSecretsManager());

    // Validate cross-component dependencies
    results.push(await this.validateDependencies());

    // Calculate summary
    const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
    const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);
    const isValid = totalErrors === 0;

    return {
      isValid,
      totalErrors,
      totalWarnings,
      results,
      recommendations: this.generateRecommendations(results),
    };
  }

  /**
   * Validate environment configuration
   */
  private static validateEnvironment(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const env = environmentLoader.load();
      const environment = environmentLoader.getEnvironment();

      // Validate environment-specific requirements
      const envValidation = environmentLoader.validateEnvironment(environment);
      errors.push(...envValidation.missingVars);
      warnings.push(...envValidation.warnings);

      // Check for common misconfigurations
      if (environment === 'production') {
        if (env.NODE_ENV !== 'production') {
          warnings.push('NODE_ENV should be "production" in production environment');
        }
        
        if (env.PORT === 3000) {
          warnings.push('Using default port 3000 in production');
        }
      }

      if (environment === 'development') {
        if (!env.ENABLE_SWAGGER) {
          warnings.push('Swagger is disabled in development environment');
        }
      }

    } catch (error) {
      errors.push(`Environment validation failed: ${error}`);
    }

    return {
      component: 'Environment',
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate database configuration
   */
  private static validateDatabase(): ValidationResult {
    try {
      return {
        component: 'Database',
        ...DatabaseConfigLoader.validate(),
      };
    } catch (error) {
      return {
        component: 'Database',
        isValid: false,
        errors: [`Database configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate security configuration
   */
  private static validateSecurity(): ValidationResult {
    try {
      return {
        component: 'Security',
        ...SecurityConfigLoader.validate(),
      };
    } catch (error) {
      return {
        component: 'Security',
        isValid: false,
        errors: [`Security configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate monitoring configuration
   */
  private static validateMonitoring(): ValidationResult {
    try {
      return {
        component: 'Monitoring',
        ...MonitoringConfigLoader.validate(),
      };
    } catch (error) {
      return {
        component: 'Monitoring',
        isValid: false,
        errors: [`Monitoring configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate cache configuration
   */
  private static validateCache(): ValidationResult {
    try {
      return {
        component: 'Cache',
        ...CacheConfigLoader.validate(),
      };
    } catch (error) {
      return {
        component: 'Cache',
        isValid: false,
        errors: [`Cache configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate feature flags configuration
   */
  private static validateFeatureFlags(): ValidationResult {
    try {
      return {
        component: 'FeatureFlags',
        ...FeatureFlagsLoader.validate(),
      };
    } catch (error) {
      return {
        component: 'FeatureFlags',
        isValid: false,
        errors: [`Feature flags configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate secrets manager configuration
   */
  private static validateSecretsManager(): ValidationResult {
    try {
      return {
        component: 'SecretsManager',
        ...SecretsManagerLoader.validate(),
      };
    } catch (error) {
      return {
        component: 'SecretsManager',
        isValid: false,
        errors: [`Secrets manager configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate cross-component dependencies
   */
  private static async validateDependencies(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const environment = environmentLoader.getEnvironment();

      // Check Redis dependency for cache
      try {
        const cacheConfig = CacheConfigLoader.load();
        const env = environmentLoader.getEnv();
        
        if (cacheConfig.redis.host !== env.REDIS_HOST) {
          warnings.push('Cache Redis host differs from environment Redis host');
        }
        
        if (cacheConfig.redis.port !== env.REDIS_PORT) {
          warnings.push('Cache Redis port differs from environment Redis port');
        }
      } catch (error) {
        errors.push('Failed to validate Redis dependency for cache');
      }

      // Check JWT secret consistency
      try {
        const securityConfig = SecurityConfigLoader.load();
        const jwtSecret = await SecretsManagerLoader.getSecret('jwtSecret');
        
        if (jwtSecret && securityConfig.jwt.secret !== jwtSecret) {
          warnings.push('JWT secret in security config differs from secrets manager');
        }
      } catch (error) {
        warnings.push('Could not validate JWT secret consistency');
      }

      // Check monitoring dependencies
      try {
        const monitoringConfig = MonitoringConfigLoader.load();
        
        if (monitoringConfig.metrics.enabled && !monitoringConfig.healthCheck.enabled) {
          warnings.push('Metrics enabled but health checks disabled');
        }
        
        if (monitoringConfig.tracing.enabled && !monitoringConfig.logging.enabled) {
          warnings.push('Tracing enabled but logging disabled');
        }
      } catch (error) {
        warnings.push('Could not validate monitoring dependencies');
      }

      // Environment-specific dependency checks
      if (environment === 'production') {
        // Check that production has proper monitoring
        try {
          const monitoringConfig = MonitoringConfigLoader.load();
          if (!monitoringConfig.alerting.enabled) {
            errors.push('Alerting should be enabled in production');
          }
          
          if (!monitoringConfig.metrics.enabled) {
            errors.push('Metrics should be enabled in production');
          }
        } catch (error) {
          errors.push('Could not validate production monitoring requirements');
        }

        // Check that production has proper security
        try {
          const securityConfig = SecurityConfigLoader.load();
          if (!securityConfig.headers.hsts.enabled) {
            warnings.push('HSTS should be enabled in production');
          }
          
          if (securityConfig.cors.origins.includes('*')) {
            errors.push('Wildcard CORS origins not allowed in production');
          }
        } catch (error) {
          errors.push('Could not validate production security requirements');
        }
      }

    } catch (error) {
      errors.push(`Dependency validation failed: ${error}`);
    }

    return {
      component: 'Dependencies',
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  private static generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];
    const environment = environmentLoader.getEnvironment();

    // Count errors and warnings by component
    const componentStats = results.reduce((stats, result) => {
      stats[result.component] = {
        errors: result.errors.length,
        warnings: result.warnings.length,
      };
      return stats;
    }, {} as Record<string, { errors: number; warnings: number }>);

    // General recommendations
    if (componentStats.Environment?.errors > 0) {
      recommendations.push('Review and fix environment variable configuration');
      recommendations.push('Consider using a .env file for local development');
    }

    if (componentStats.Security?.errors > 0) {
      recommendations.push('Address security configuration issues immediately');
      recommendations.push('Review JWT secret strength and rotation policy');
    }

    if (componentStats.Database?.warnings > 0) {
      recommendations.push('Optimize database connection pool settings for your workload');
      recommendations.push('Consider enabling SSL for database connections');
    }

    if (componentStats.Cache?.warnings > 0) {
      recommendations.push('Review cache configuration for optimal performance');
      recommendations.push('Consider enabling cache warming for frequently accessed data');
    }

    if (componentStats.Monitoring?.warnings > 0) {
      recommendations.push('Enable comprehensive monitoring for production environments');
      recommendations.push('Configure alerting for critical system metrics');
    }

    // Environment-specific recommendations
    switch (environment) {
      case 'production':
        recommendations.push('Ensure all secrets are managed through a secure secrets manager');
        recommendations.push('Enable comprehensive audit logging');
        recommendations.push('Configure automated backups and disaster recovery');
        recommendations.push('Set up monitoring dashboards and alerting');
        break;
      
      case 'staging':
        recommendations.push('Use staging environment to test production configurations');
        recommendations.push('Enable feature flags for gradual rollouts');
        break;
      
      case 'development':
        recommendations.push('Enable development tools like Swagger for API documentation');
        recommendations.push('Use relaxed security settings for easier development');
        recommendations.push('Consider using Docker for consistent development environments');
        break;
      
      case 'test':
        recommendations.push('Disable external integrations in test environment');
        recommendations.push('Use in-memory databases for faster test execution');
        recommendations.push('Mock external services to avoid dependencies');
        break;
    }

    return recommendations;
  }

  /**
   * Generate configuration report
   */
  static async generateReport(): Promise<string> {
    const summary = await this.validateAll();
    const environment = environmentLoader.getEnvironment();

    let report = '\n=== CONFIGURATION VALIDATION REPORT ===\n\n';
    
    report += `Environment: ${environment.toUpperCase()}\n`;
    report += `Validation Status: ${summary.isValid ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `Total Errors: ${summary.totalErrors}\n`;
    report += `Total Warnings: ${summary.totalWarnings}\n\n`;

    // Component results
    report += '=== COMPONENT VALIDATION RESULTS ===\n\n';
    
    summary.results.forEach(result => {
      const status = result.isValid ? '✅' : '❌';
      report += `${status} ${result.component}\n`;
      
      if (result.errors.length > 0) {
        report += '  Errors:\n';
        result.errors.forEach(error => {
          report += `    - ${error}\n`;
        });
      }
      
      if (result.warnings.length > 0) {
        report += '  Warnings:\n';
        result.warnings.forEach(warning => {
          report += `    - ${warning}\n`;
        });
      }
      
      report += '\n';
    });

    // Recommendations
    if (summary.recommendations.length > 0) {
      report += '=== RECOMMENDATIONS ===\n\n';
      summary.recommendations.forEach((recommendation, index) => {
        report += `${index + 1}. ${recommendation}\n`;
      });
      report += '\n';
    }

    report += '=== END REPORT ===\n';
    
    return report;
  }

  /**
   * Validate specific configuration component
   */
  static validateComponent(component: string): ValidationResult {
    switch (component.toLowerCase()) {
      case 'environment':
        return this.validateEnvironment();
      case 'database':
        return this.validateDatabase();
      case 'security':
        return this.validateSecurity();
      case 'monitoring':
        return this.validateMonitoring();
      case 'cache':
        return this.validateCache();
      case 'featureflags':
        return this.validateFeatureFlags();
      case 'secretsmanager':
        return this.validateSecretsManager();
      default:
        return {
          component,
          isValid: false,
          errors: [`Unknown component: ${component}`],
          warnings: [],
        };
    }
  }
}