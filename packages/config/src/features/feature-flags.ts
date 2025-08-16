import { z } from 'zod';
import { environmentLoader } from '../environment/environment-loader';

/**
 * Feature flag configuration schema
 */
const FeatureFlagSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  description: z.string().optional(),
  environments: z.array(z.string()).optional(),
  rolloutPercentage: z.number().min(0).max(100).default(100),
  userGroups: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

/**
 * Feature flags configuration schema
 */
const FeatureFlagsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['local', 'remote', 'database']).default('local'),
  
  // Remote provider settings
  remote: z.object({
    url: z.string().optional(),
    apiKey: z.string().optional(),
    timeout: z.number().default(5000),
    refreshInterval: z.number().default(300000), // 5 minutes
    fallbackToLocal: z.boolean().default(true),
  }),
  
  // Database provider settings
  database: z.object({
    table: z.string().default('feature_flags'),
    cacheTimeout: z.number().default(300000), // 5 minutes
  }),
  
  // Local flags
  flags: z.record(z.string(), FeatureFlagSchema).default({}),
  
  // Runtime configuration
  runtime: z.object({
    enableLogging: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
    enableAudit: z.boolean().default(true),
    defaultValue: z.boolean().default(false),
  }),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfigSchema>;

/**
 * Feature flags configuration loader
 */
export class FeatureFlagsLoader {
  /**
   * Load feature flags configuration
   */
  static load(): FeatureFlagsConfig {
    const environment = environmentLoader.getEnvironment();

    const config = {
      enabled: process.env.FEATURE_FLAGS_ENABLED !== 'false',
      provider: (process.env.FEATURE_FLAGS_PROVIDER as any) || 'local',
      
      remote: {
        url: process.env.FEATURE_FLAGS_URL,
        apiKey: process.env.FEATURE_FLAGS_API_KEY,
        timeout: parseInt(process.env.FEATURE_FLAGS_TIMEOUT || '5000'),
        refreshInterval: parseInt(process.env.FEATURE_FLAGS_REFRESH_INTERVAL || '300000'),
        fallbackToLocal: process.env.FEATURE_FLAGS_FALLBACK !== 'false',
      },
      
      database: {
        table: process.env.FEATURE_FLAGS_TABLE || 'feature_flags',
        cacheTimeout: parseInt(process.env.FEATURE_FLAGS_CACHE_TIMEOUT || '300000'),
      },
      
      flags: this.getDefaultFlags(environment),
      
      runtime: {
        enableLogging: process.env.FEATURE_FLAGS_LOGGING !== 'false',
        enableMetrics: process.env.FEATURE_FLAGS_METRICS !== 'false',
        enableAudit: process.env.FEATURE_FLAGS_AUDIT !== 'false',
        defaultValue: process.env.FEATURE_FLAGS_DEFAULT_VALUE === 'true',
      },
    };

    return FeatureFlagsConfigSchema.parse(config);
  }

  /**
   * Get default feature flags for environment
   */
  private static getDefaultFlags(environment: string): Record<string, FeatureFlag> {
    const baseFlags: Record<string, FeatureFlag> = {
      // API Features
      enableSwagger: {
        name: 'enableSwagger',
        enabled: environment !== 'production',
        description: 'Enable Swagger API documentation',
        environments: ['development', 'staging'],
      },
      
      enableMetrics: {
        name: 'enableMetrics',
        enabled: true,
        description: 'Enable Prometheus metrics collection',
      },
      
      enableWebSocket: {
        name: 'enableWebSocket',
        enabled: true,
        description: 'Enable WebSocket real-time features',
      },
      
      enableMFA: {
        name: 'enableMFA',
        enabled: true,
        description: 'Enable multi-factor authentication',
      },
      
      enableOAuth: {
        name: 'enableOAuth',
        enabled: true,
        description: 'Enable OAuth authentication providers',
      },
      
      enableAPIRateLimit: {
        name: 'enableAPIRateLimit',
        enabled: true,
        description: 'Enable API rate limiting',
      },
      
      // Task Management Features
      enableTaskTemplates: {
        name: 'enableTaskTemplates',
        enabled: false,
        description: 'Enable task templates feature',
        rolloutPercentage: 50,
      },
      
      enableTaskAutomation: {
        name: 'enableTaskAutomation',
        enabled: false,
        description: 'Enable task automation workflows',
        rolloutPercentage: 25,
      },
      
      enableAdvancedSearch: {
        name: 'enableAdvancedSearch',
        enabled: true,
        description: 'Enable advanced search capabilities',
      },
      
      enableTaskDependencies: {
        name: 'enableTaskDependencies',
        enabled: true,
        description: 'Enable task dependencies feature',
      },
      
      enableTimeTracking: {
        name: 'enableTimeTracking',
        enabled: true,
        description: 'Enable time tracking for tasks',
      },
      
      // Collaboration Features
      enableRealTimeCollaboration: {
        name: 'enableRealTimeCollaboration',
        enabled: true,
        description: 'Enable real-time collaboration features',
      },
      
      enableComments: {
        name: 'enableComments',
        enabled: true,
        description: 'Enable task and project comments',
      },
      
      enableMentions: {
        name: 'enableMentions',
        enabled: true,
        description: 'Enable @mentions in comments',
      },
      
      enableFileSharing: {
        name: 'enableFileSharing',
        enabled: true,
        description: 'Enable file attachments and sharing',
      },
      
      // Notification Features
      enableEmailNotifications: {
        name: 'enableEmailNotifications',
        enabled: true,
        description: 'Enable email notifications',
      },
      
      enablePushNotifications: {
        name: 'enablePushNotifications',
        enabled: true,
        description: 'Enable push notifications',
      },
      
      enableSlackIntegration: {
        name: 'enableSlackIntegration',
        enabled: false,
        description: 'Enable Slack integration',
        rolloutPercentage: 30,
      },
      
      // Analytics Features
      enableAnalytics: {
        name: 'enableAnalytics',
        enabled: true,
        description: 'Enable analytics and reporting',
      },
      
      enableAdvancedReports: {
        name: 'enableAdvancedReports',
        enabled: false,
        description: 'Enable advanced reporting features',
        rolloutPercentage: 40,
      },
      
      enableExportFeatures: {
        name: 'enableExportFeatures',
        enabled: true,
        description: 'Enable data export features',
      },
      
      // Mobile Features
      enableOfflineMode: {
        name: 'enableOfflineMode',
        enabled: true,
        description: 'Enable offline mode for mobile app',
      },
      
      enableBiometricAuth: {
        name: 'enableBiometricAuth',
        enabled: true,
        description: 'Enable biometric authentication',
      },
      
      enableCameraIntegration: {
        name: 'enableCameraIntegration',
        enabled: true,
        description: 'Enable camera integration for file uploads',
      },
      
      // Performance Features
      enableCaching: {
        name: 'enableCaching',
        enabled: true,
        description: 'Enable application caching',
      },
      
      enableLazyLoading: {
        name: 'enableLazyLoading',
        enabled: true,
        description: 'Enable lazy loading for better performance',
      },
      
      enableServiceWorker: {
        name: 'enableServiceWorker',
        enabled: environment === 'production',
        description: 'Enable service worker for PWA features',
      },
      
      // Experimental Features
      enableAIAssistant: {
        name: 'enableAIAssistant',
        enabled: false,
        description: 'Enable AI-powered task assistant',
        rolloutPercentage: 10,
        userGroups: ['beta-testers'],
      },
      
      enableVoiceCommands: {
        name: 'enableVoiceCommands',
        enabled: false,
        description: 'Enable voice command interface',
        rolloutPercentage: 5,
        userGroups: ['beta-testers'],
      },
      
      enableDarkMode: {
        name: 'enableDarkMode',
        enabled: true,
        description: 'Enable dark mode theme',
      },
      
      // Security Features
      enableAdvancedSecurity: {
        name: 'enableAdvancedSecurity',
        enabled: environment === 'production',
        description: 'Enable advanced security features',
      },
      
      enableAuditLogging: {
        name: 'enableAuditLogging',
        enabled: true,
        description: 'Enable comprehensive audit logging',
      },
      
      enableSessionManagement: {
        name: 'enableSessionManagement',
        enabled: true,
        description: 'Enable advanced session management',
      },
    };

    // Environment-specific overrides
    switch (environment) {
      case 'production':
        return {
          ...baseFlags,
          enableSwagger: { ...baseFlags.enableSwagger, enabled: false },
          enableTaskTemplates: { ...baseFlags.enableTaskTemplates, rolloutPercentage: 100 },
          enableAdvancedReports: { ...baseFlags.enableAdvancedReports, rolloutPercentage: 100 },
        };
      
      case 'staging':
        return {
          ...baseFlags,
          enableTaskAutomation: { ...baseFlags.enableTaskAutomation, rolloutPercentage: 100 },
          enableAIAssistant: { ...baseFlags.enableAIAssistant, rolloutPercentage: 50 },
        };
      
      case 'development':
        return {
          ...baseFlags,
          enableSwagger: { ...baseFlags.enableSwagger, enabled: true },
          enableTaskTemplates: { ...baseFlags.enableTaskTemplates, enabled: true },
          enableTaskAutomation: { ...baseFlags.enableTaskAutomation, enabled: true },
          enableAIAssistant: { ...baseFlags.enableAIAssistant, enabled: true },
          enableVoiceCommands: { ...baseFlags.enableVoiceCommands, enabled: true },
        };
      
      case 'test':
        return Object.fromEntries(
          Object.entries(baseFlags).map(([key, flag]) => [
            key,
            { ...flag, enabled: false }, // Disable all features in tests by default
          ])
        );
      
      default:
        return baseFlags;
    }
  }

  /**
   * Validate feature flags configuration
   */
  static validate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = this.load();

      // Validate provider configuration
      if (config.provider === 'remote') {
        if (!config.remote.url) {
          errors.push('Remote provider URL is required when using remote provider');
        }
        if (!config.remote.apiKey) {
          warnings.push('Remote provider API key not configured');
        }
      }

      // Validate flags
      Object.entries(config.flags).forEach(([key, flag]) => {
        if (flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100) {
          errors.push(`Invalid rollout percentage for flag ${key}: ${flag.rolloutPercentage}`);
        }

        if (flag.startDate && flag.endDate) {
          const start = new Date(flag.startDate);
          const end = new Date(flag.endDate);
          if (start >= end) {
            errors.push(`Invalid date range for flag ${key}: start date must be before end date`);
          }
        }

        // Check dependencies
        flag.dependencies.forEach(dep => {
          if (!config.flags[dep]) {
            warnings.push(`Flag ${key} depends on ${dep} which is not defined`);
          }
        });
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Feature flags configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Get feature flag value with context
   */
  static isEnabled(
    flagName: string,
    context?: {
      userId?: string;
      userGroups?: string[];
      environment?: string;
    }
  ): boolean {
    try {
      const config = this.load();
      const flag = config.flags[flagName];

      if (!flag) {
        return config.runtime.defaultValue;
      }

      // Check if flag is globally disabled
      if (!flag.enabled) {
        return false;
      }

      // Check environment restrictions
      if (flag.environments && flag.environments.length > 0) {
        const currentEnv = context?.environment || environmentLoader.getEnvironment();
        if (!flag.environments.includes(currentEnv)) {
          return false;
        }
      }

      // Check date restrictions
      const now = new Date();
      if (flag.startDate && now < new Date(flag.startDate)) {
        return false;
      }
      if (flag.endDate && now > new Date(flag.endDate)) {
        return false;
      }

      // Check user group restrictions
      if (flag.userGroups.length > 0 && context?.userGroups) {
        const hasRequiredGroup = flag.userGroups.some(group => 
          context.userGroups!.includes(group)
        );
        if (!hasRequiredGroup) {
          return false;
        }
      }

      // Check rollout percentage
      if (flag.rolloutPercentage < 100) {
        // Use user ID for consistent rollout if available
        const seed = context?.userId || Math.random().toString();
        const hash = this.simpleHash(seed + flagName);
        const percentage = (hash % 100) + 1;
        return percentage <= flag.rolloutPercentage;
      }

      return true;
    } catch (error) {
      console.error(`Error evaluating feature flag ${flagName}:`, error);
      return false;
    }
  }

  /**
   * Simple hash function for consistent rollout
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}