import { getConfigurationManager } from './configuration-manager';
import type { FeatureFlags } from './configuration-manager';

export interface FeatureFlagContext {
  userId?: string;
  workspaceId?: string;
  userRole?: string;
  environment?: string;
  [key: string]: any;
}

export interface FeatureFlagRule {
  flag: string;
  enabled: boolean;
  conditions?: FeatureFlagCondition[];
  variants?: FeatureFlagVariant[];
  rolloutPercentage?: number;
}

export interface FeatureFlagCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex';
  value: any;
}

export interface FeatureFlagVariant {
  name: string;
  weight: number;
  payload?: Record<string, any>;
}

export interface IFeatureFlagService {
  isEnabled(
    flag: keyof FeatureFlags,
    context?: FeatureFlagContext
  ): Promise<boolean>;
  getVariant(flag: string, context?: FeatureFlagContext): Promise<string>;
  getAllFlags(context?: FeatureFlagContext): Promise<Record<string, boolean>>;
  evaluateRule(
    rule: FeatureFlagRule,
    context?: FeatureFlagContext
  ): Promise<boolean>;
  refreshFlags(): Promise<void>;
}

class EnterpriseFeatureFlagService implements IFeatureFlagService {
  private configManager = getConfigurationManager();
  private customRules: Map<string, FeatureFlagRule> = new Map();
  private cache: Map<string, { value: boolean; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadCustomRules();
  }

  private loadCustomRules(): void {
    // Load custom feature flag rules from configuration or external service
    // This would typically come from a feature flag management service
    const customRules: FeatureFlagRule[] = [
      {
        flag: 'enableAdvancedSearch',
        enabled: true,
        conditions: [
          {
            field: 'userRole',
            operator: 'in',
            value: ['admin', 'premium_user'],
          },
        ],
        rolloutPercentage: 50,
      },
      {
        flag: 'enableBulkOperations',
        enabled: true,
        conditions: [
          {
            field: 'workspaceId',
            operator: 'not_equals',
            value: 'demo_workspace',
          },
        ],
      },
      {
        flag: 'enableCalendarIntegration',
        enabled: true,
        variants: [
          { name: 'google_calendar', weight: 60 },
          { name: 'outlook_calendar', weight: 40 },
        ],
      },
    ];

    customRules.forEach(rule => {
      this.customRules.set(rule.flag, rule);
    });
  }

  async isEnabled(
    flag: keyof FeatureFlags,
    context?: FeatureFlagContext
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(flag, context);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    let enabled = false;

    // Check custom rules first
    const customRule = this.customRules.get(flag);
    if (customRule) {
      enabled = await this.evaluateRule(customRule, context);
    } else {
      // Fall back to configuration
      enabled = this.configManager.isFeatureEnabled(flag);
    }

    // Cache the result
    this.cache.set(cacheKey, {
      value: enabled,
      expiry: Date.now() + this.CACHE_TTL,
    });

    return enabled;
  }

  async getVariant(
    flag: string,
    context?: FeatureFlagContext
  ): Promise<string> {
    const isEnabled = await this.isEnabled(flag as keyof FeatureFlags, context);
    if (!isEnabled) {
      return 'disabled';
    }

    const customRule = this.customRules.get(flag);
    if (customRule?.variants && customRule.variants.length > 0) {
      return this.selectVariant(customRule.variants, context);
    }

    // Fall back to configuration manager
    return this.configManager.getFeatureVariant(flag, context);
  }

  async getAllFlags(
    context?: FeatureFlagContext
  ): Promise<Record<string, boolean>> {
    const config = this.configManager.getConfig();
    const flags: Record<string, boolean> = {};

    // Evaluate all feature flags
    for (const [flagName] of Object.entries(config.featureFlags)) {
      flags[flagName] = await this.isEnabled(
        flagName as keyof FeatureFlags,
        context
      );
    }

    // Add custom flags
    for (const [flagName] of this.customRules) {
      if (!(flagName in flags)) {
        flags[flagName] = await this.isEnabled(
          flagName as keyof FeatureFlags,
          context
        );
      }
    }

    return flags;
  }

  async evaluateRule(
    rule: FeatureFlagRule,
    context?: FeatureFlagContext
  ): Promise<boolean> {
    if (!rule.enabled) {
      return false;
    }

    // Evaluate conditions
    if (rule.conditions && rule.conditions.length > 0) {
      const conditionResults = rule.conditions.map(condition =>
        this.evaluateCondition(condition, context)
      );

      // All conditions must be true (AND logic)
      if (!conditionResults.every(result => result)) {
        return false;
      }
    }

    // Check rollout percentage
    if (rule.rolloutPercentage !== undefined) {
      const rolloutValue = this.calculateRolloutValue(rule.flag, context);
      if (rolloutValue > rule.rolloutPercentage) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(
    condition: FeatureFlagCondition,
    context?: FeatureFlagContext
  ): boolean {
    if (!context) {
      return false;
    }

    const contextValue = context[condition.field];

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;

      case 'not_equals':
        return contextValue !== condition.value;

      case 'in':
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(contextValue)
        );

      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(contextValue)
        );

      case 'contains':
        return (
          typeof contextValue === 'string' &&
          typeof condition.value === 'string' &&
          contextValue.includes(condition.value)
        );

      case 'regex':
        return (
          typeof contextValue === 'string' &&
          new RegExp(condition.value).test(contextValue)
        );

      default:
        return false;
    }
  }

  private selectVariant(
    variants: FeatureFlagVariant[],
    context?: FeatureFlagContext
  ): string {
    const totalWeight = variants.reduce(
      (sum, variant) => sum + variant.weight,
      0
    );
    const randomValue =
      this.calculateRolloutValue('variant_selection', context) % totalWeight;

    let currentWeight = 0;
    for (const variant of variants) {
      currentWeight += variant.weight;
      if (randomValue < currentWeight) {
        return variant.name;
      }
    }

    return variants[0]?.name || 'default';
  }

  private calculateRolloutValue(
    flag: string,
    context?: FeatureFlagContext
  ): number {
    // Create a deterministic hash based on flag name and user context
    const hashInput = `${flag}:${context?.userId || 'anonymous'}:${context?.workspaceId || 'default'}`;

    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash) % 100;
  }

  private getCacheKey(flag: string, context?: FeatureFlagContext): string {
    const contextKey = context
      ? Object.entries(context)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${key}:${value}`)
          .join('|')
      : 'no_context';

    return `${flag}:${contextKey}`;
  }

  async refreshFlags(): Promise<void> {
    // Clear cache
    this.cache.clear();

    // Reload custom rules (in a real system, this would fetch from an external service)
    this.loadCustomRules();

    console.log('Feature flags refreshed');
  }

  // Administrative methods
  addCustomRule(rule: FeatureFlagRule): void {
    this.customRules.set(rule.flag, rule);
    this.cache.clear(); // Clear cache when rules change
  }

  removeCustomRule(flag: string): void {
    this.customRules.delete(flag);
    this.cache.clear();
  }

  getCustomRules(): FeatureFlagRule[] {
    return Array.from(this.customRules.values());
  }

  // Utility methods for common feature flag patterns
  async isEnabledForUser(
    flag: keyof FeatureFlags,
    userId: string,
    userRole?: string
  ): Promise<boolean> {
    return this.isEnabled(flag, { userId, userRole });
  }

  async isEnabledForWorkspace(
    flag: keyof FeatureFlags,
    workspaceId: string
  ): Promise<boolean> {
    return this.isEnabled(flag, { workspaceId });
  }

  async isEnabledForEnvironment(
    flag: keyof FeatureFlags,
    environment: string
  ): Promise<boolean> {
    return this.isEnabled(flag, { environment });
  }
}

// Singleton instance
let featureFlagService: EnterpriseFeatureFlagService;

export function getFeatureFlagService(): EnterpriseFeatureFlagService {
  if (!featureFlagService) {
    featureFlagService = new EnterpriseFeatureFlagService();
  }
  return featureFlagService;
}

export { EnterpriseFeatureFlagService };

// Convenience functions
export const isFeatureEnabled = (
  flag: keyof FeatureFlags,
  context?: FeatureFlagContext
) => getFeatureFlagService().isEnabled(flag, context);

export const getFeatureVariant = (flag: string, context?: FeatureFlagContext) =>
  getFeatureFlagService().getVariant(flag, context);

export const getAllFeatureFlags = (context?: FeatureFlagContext) =>
  getFeatureFlagService().getAllFlags(context);

export default getFeatureFlagService();
