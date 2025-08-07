/**
 * Comprehensive Validation Engine
 * Provides multi-layer validation for domain entities and database operations
 */

import { z } from 'zod';
import { logger } from '../../infrastructure/logging/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
  context?: Record<string, any>;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationRule<T> {
  name: string;
  validate: (
    value: T,
    context?: ValidationContext
  ) => Promise<ValidationResult> | ValidationResult;
  priority: number;
  layer: ValidationLayer;
}

export interface ValidationContext {
  entityType: string;
  operation: 'create' | 'update' | 'delete';
  userId?: string;
  workspaceId?: string;
  metadata?: Record<string, any>;
}

export enum ValidationLayer {
  DOMAIN = 'domain',
  APPLICATION = 'application',
  DATABASE = 'database',
  PRESENTATION = 'presentation',
}

export class ValidationEngine {
  private rules = new Map<string, ValidationRule<any>[]>();
  private schemas = new Map<string, z.ZodSchema>();

  /**
   * Register validation rule for entity type
   */
  registerRule<T>(entityType: string, rule: ValidationRule<T>): void {
    if (!this.rules.has(entityType)) {
      this.rules.set(entityType, []);
    }

    const rules = this.rules.get(entityType)!;
    rules.push(rule);

    // Sort by priority (lower number = higher priority)
    rules.sort((a, b) => a.priority - b.priority);

    logger.debug('Validation rule registered', {
      entityType,
      ruleName: rule.name,
      layer: rule.layer,
      priority: rule.priority,
    });
  }

  /**
   * Register Zod schema for entity type
   */
  registerSchema(entityType: string, schema: z.ZodSchema): void {
    this.schemas.set(entityType, schema);

    logger.debug('Validation schema registered', {
      entityType,
      schemaType: schema.constructor.name,
    });
  }

  /**
   * Validate entity with all registered rules
   */
  async validate<T>(
    entityType: string,
    entity: T,
    context: ValidationContext,
    layer?: ValidationLayer
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    try {
      // Schema validation first
      const schemaResult = await this.validateWithSchema(entityType, entity);
      allErrors.push(...schemaResult.errors);
      allWarnings.push(...schemaResult.warnings);

      // Rule-based validation
      const rules = this.rules.get(entityType) || [];
      const applicableRules = layer
        ? rules.filter(rule => rule.layer === layer)
        : rules;

      for (const rule of applicableRules) {
        try {
          const result = await rule.validate(entity, context);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);

          // Stop on first critical error if specified
          if (!result.isValid && rule.priority === 0) {
            break;
          }
        } catch (error) {
          logger.error('Validation rule execution failed', {
            entityType,
            ruleName: rule.name,
            error: error instanceof Error ? error.message : String(error),
          });

          allErrors.push({
            field: 'validation',
            message: `Validation rule '${rule.name}' failed to execute`,
            code: 'VALIDATION_RULE_ERROR',
            context: { ruleName: rule.name },
          });
        }
      }

      const duration = Date.now() - startTime;
      const isValid = allErrors.length === 0;

      logger.debug('Validation completed', {
        entityType,
        layer,
        isValid,
        errorCount: allErrors.length,
        warningCount: allWarnings.length,
        duration,
        rulesExecuted: applicableRules.length,
      });

      return {
        isValid,
        errors: allErrors,
        warnings: allWarnings,
      };
    } catch (error) {
      logger.error('Validation engine error', {
        entityType,
        layer,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          {
            field: 'validation',
            message: 'Validation engine encountered an error',
            code: 'VALIDATION_ENGINE_ERROR',
            context: { error: String(error) },
          },
        ],
        warnings: allWarnings,
      };
    }
  }

  /**
   * Validate with Zod schema
   */
  private async validateWithSchema<T>(
    entityType: string,
    entity: T
  ): Promise<ValidationResult> {
    const schema = this.schemas.get(entityType);
    if (!schema) {
      return { isValid: true, errors: [], warnings: [] };
    }

    try {
      schema.parse(entity);
      return { isValid: true, errors: [], warnings: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: err.received,
          context: { expected: err.expected },
        }));

        return { isValid: false, errors, warnings: [] };
      }

      return {
        isValid: false,
        errors: [
          {
            field: 'schema',
            message: 'Schema validation failed',
            code: 'SCHEMA_ERROR',
            context: { error: String(error) },
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate multiple entities in batch
   */
  async validateBatch<T>(
    entityType: string,
    entities: T[],
    context: ValidationContext,
    layer?: ValidationLayer
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (let i = 0; i < entities.length; i++) {
      const entityContext = {
        ...context,
        metadata: {
          ...context.metadata,
          batchIndex: i,
          batchSize: entities.length,
        },
      };

      const result = await this.validate(
        entityType,
        entities[i],
        entityContext,
        layer
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Get validation summary for batch results
   */
  getBatchSummary(results: ValidationResult[]): {
    totalCount: number;
    validCount: number;
    invalidCount: number;
    totalErrors: number;
    totalWarnings: number;
    validationRate: number;
  } {
    const totalCount = results.length;
    const validCount = results.filter(r => r.isValid).length;
    const invalidCount = totalCount - validCount;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce(
      (sum, r) => sum + r.warnings.length,
      0
    );
    const validationRate = totalCount > 0 ? (validCount / totalCount) * 100 : 0;

    return {
      totalCount,
      validCount,
      invalidCount,
      totalErrors,
      totalWarnings,
      validationRate,
    };
  }

  /**
   * Create validation rule builder
   */
  createRule<T>(entityType: string): ValidationRuleBuilder<T> {
    return new ValidationRuleBuilder<T>(this, entityType);
  }

  /**
   * Remove all rules for entity type
   */
  clearRules(entityType: string): void {
    this.rules.delete(entityType);
    logger.debug('Validation rules cleared', { entityType });
  }

  /**
   * Get registered rules for entity type
   */
  getRules(entityType: string): ValidationRule<any>[] {
    return this.rules.get(entityType) || [];
  }

  /**
   * Get validation statistics
   */
  getStatistics(): {
    entityTypes: number;
    totalRules: number;
    rulesByLayer: Record<ValidationLayer, number>;
    schemaCount: number;
  } {
    const entityTypes = this.rules.size;
    const totalRules = Array.from(this.rules.values()).reduce(
      (sum, rules) => sum + rules.length,
      0
    );
    const schemaCount = this.schemas.size;

    const rulesByLayer = Object.values(ValidationLayer).reduce(
      (acc, layer) => {
        acc[layer] = Array.from(this.rules.values())
          .flat()
          .filter(rule => rule.layer === layer).length;
        return acc;
      },
      {} as Record<ValidationLayer, number>
    );

    return {
      entityTypes,
      totalRules,
      rulesByLayer,
      schemaCount,
    };
  }
}

/**
 * Validation rule builder for fluent API
 */
export class ValidationRuleBuilder<T> {
  private rule: Partial<ValidationRule<T>> = {};

  constructor(
    private engine: ValidationEngine,
    private entityType: string
  ) {}

  name(name: string): this {
    this.rule.name = name;
    return this;
  }

  priority(priority: number): this {
    this.rule.priority = priority;
    return this;
  }

  layer(layer: ValidationLayer): this {
    this.rule.layer = layer;
    return this;
  }

  validate(
    validator: (
      value: T,
      context?: ValidationContext
    ) => Promise<ValidationResult> | ValidationResult
  ): this {
    this.rule.validate = validator;
    return this;
  }

  register(): void {
    if (!this.rule.name || !this.rule.validate) {
      throw new Error('Rule name and validate function are required');
    }

    const completeRule: ValidationRule<T> = {
      name: this.rule.name,
      validate: this.rule.validate,
      priority: this.rule.priority || 100,
      layer: this.rule.layer || ValidationLayer.DOMAIN,
    };

    this.engine.registerRule(this.entityType, completeRule);
  }
}

/**
 * Common validation rules
 */
export class CommonValidationRules {
  /**
   * Required field validation
   */
  static required<T>(field: keyof T, message?: string): ValidationRule<T> {
    return {
      name: `required-${String(field)}`,
      priority: 10,
      layer: ValidationLayer.DOMAIN,
      validate: (entity: T) => {
        const value = entity[field];
        const isValid = value !== null && value !== undefined && value !== '';

        return {
          isValid,
          errors: isValid
            ? []
            : [
                {
                  field: String(field),
                  message: message || `${String(field)} is required`,
                  code: 'REQUIRED_FIELD_MISSING',
                },
              ],
          warnings: [],
        };
      },
    };
  }

  /**
   * String length validation
   */
  static stringLength<T>(
    field: keyof T,
    min?: number,
    max?: number,
    message?: string
  ): ValidationRule<T> {
    return {
      name: `string-length-${String(field)}`,
      priority: 20,
      layer: ValidationLayer.DOMAIN,
      validate: (entity: T) => {
        const value = entity[field];

        if (typeof value !== 'string') {
          return { isValid: true, errors: [], warnings: [] };
        }

        const length = value.length;
        const isValid =
          (min === undefined || length >= min) &&
          (max === undefined || length <= max);

        return {
          isValid,
          errors: isValid
            ? []
            : [
                {
                  field: String(field),
                  message:
                    message ||
                    `${String(field)} length must be between ${min || 0} and ${max || 'unlimited'} characters`,
                  code: 'INVALID_STRING_LENGTH',
                  value: length,
                  context: { min, max },
                },
              ],
          warnings: [],
        };
      },
    };
  }

  /**
   * Email format validation
   */
  static email<T>(field: keyof T, message?: string): ValidationRule<T> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return {
      name: `email-${String(field)}`,
      priority: 30,
      layer: ValidationLayer.DOMAIN,
      validate: (entity: T) => {
        const value = entity[field];

        if (typeof value !== 'string' || !value) {
          return { isValid: true, errors: [], warnings: [] };
        }

        const isValid = emailRegex.test(value);

        return {
          isValid,
          errors: isValid
            ? []
            : [
                {
                  field: String(field),
                  message:
                    message || `${String(field)} must be a valid email address`,
                  code: 'INVALID_EMAIL_FORMAT',
                  value,
                },
              ],
          warnings: [],
        };
      },
    };
  }

  /**
   * Unique constraint validation
   */
  static unique<T>(
    field: keyof T,
    checkUniqueness: (
      value: any,
      context?: ValidationContext
    ) => Promise<boolean>,
    message?: string
  ): ValidationRule<T> {
    return {
      name: `unique-${String(field)}`,
      priority: 50,
      layer: ValidationLayer.DATABASE,
      validate: async (entity: T, context?: ValidationContext) => {
        const value = entity[field];

        if (value === null || value === undefined) {
          return { isValid: true, errors: [], warnings: [] };
        }

        const isUnique = await checkUniqueness(value, context);

        return {
          isValid: isUnique,
          errors: isUnique
            ? []
            : [
                {
                  field: String(field),
                  message: message || `${String(field)} must be unique`,
                  code: 'DUPLICATE_VALUE',
                  value,
                },
              ],
          warnings: [],
        };
      },
    };
  }
}

// Global validation engine instance
export const validationEngine = new ValidationEngine();
