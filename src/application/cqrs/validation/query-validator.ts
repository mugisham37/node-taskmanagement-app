/**
 * Enhanced Query Validation Infrastructure
 *
 * This module provides comprehensive validation capabilities for queries before they are processed.
 */

import { IQuery } from '../query';
import { injectable } from '../../../shared/decorators/injectable.decorator';
import { LoggingService } from '../../../infrastructure/monitoring/logging-service';

export interface IQueryValidator {
  validate(query: IQuery): Promise<ValidationResult>;
  addRule<T extends IQuery>(queryType: string, rule: ValidationRule<T>): void;
  removeRule<T extends IQuery>(
    queryType: string,
    rule: ValidationRule<T>
  ): void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
}

export interface ValidationRule<T extends IQuery> {
  validate(query: T): Promise<string[]>;
  appliesTo(query: IQuery): boolean;
  priority?: number; // Higher priority rules run first
}

@injectable()
export class QueryValidator implements IQueryValidator {
  private rules = new Map<string, ValidationRule<any>[]>();

  constructor(private readonly logger: LoggingService) {}

  async validate(query: IQuery): Promise<ValidationResult> {
    const queryType = query.constructor.name;
    const rules = this.rules.get(queryType) || [];

    // Sort rules by priority (higher first)
    const sortedRules = rules.sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    const errors: Record<string, string[]> = {};
    const warnings: Record<string, string[]> = {};

    this.logger.debug('Validating query', {
      queryType,
      queryId: query.queryId,
      rulesCount: sortedRules.length,
    });

    for (const rule of sortedRules) {
      if (rule.appliesTo(query)) {
        try {
          const ruleErrors = await rule.validate(query);
          if (ruleErrors.length > 0) {
            const ruleName = rule.constructor.name;
            errors[ruleName] = ruleErrors;
          }
        } catch (error) {
          this.logger.error('Validation rule failed', error as Error, {
            queryType,
            queryId: query.queryId,
            ruleName: rule.constructor.name,
          });

          const ruleName = rule.constructor.name;
          warnings[ruleName] = [
            `Validation rule failed: ${(error as Error).message}`,
          ];
        }
      }
    }

    const isValid = Object.keys(errors).length === 0;

    this.logger.debug('Query validation completed', {
      queryType,
      queryId: query.queryId,
      isValid,
      errorCount: Object.keys(errors).length,
      warningCount: Object.keys(warnings).length,
    });

    const result: ValidationResult = {
      isValid,
      errors,
    };
    
    if (Object.keys(warnings).length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  addRule<T extends IQuery>(queryType: string, rule: ValidationRule<T>): void {
    if (!this.rules.has(queryType)) {
      this.rules.set(queryType, []);
    }
    this.rules.get(queryType)!.push(rule);

    this.logger.debug('Validation rule added', {
      queryType,
      ruleName: rule.constructor.name,
      priority: rule.priority || 0,
    });
  }

  removeRule<T extends IQuery>(
    queryType: string,
    rule: ValidationRule<T>
  ): void {
    const rules = this.rules.get(queryType);
    if (rules) {
      const index = rules.indexOf(rule);
      if (index > -1) {
        rules.splice(index, 1);
        this.logger.debug('Validation rule removed', {
          queryType,
          ruleName: rule.constructor.name,
        });
      }
    }
  }

  clearRules(queryType?: string): void {
    if (queryType) {
      this.rules.delete(queryType);
      this.logger.debug('Validation rules cleared for query type', {
        queryType,
      });
    } else {
      this.rules.clear();
      this.logger.debug('All validation rules cleared');
    }
  }

  getRulesCount(queryType?: string): number {
    if (queryType) {
      return this.rules.get(queryType)?.length || 0;
    }
    return Array.from(this.rules.values()).reduce(
      (total, rules) => total + rules.length,
      0
    );
  }
}

// Base validation rule class with enhanced validation methods
export abstract class BaseQueryValidationRule<T extends IQuery>
  implements ValidationRule<T>
{
  public priority: number = 0;

  abstract validate(query: T): Promise<string[]>;
  abstract appliesTo(query: IQuery): boolean;

  protected validatePagination(page?: number, limit?: number): string[] {
    const errors: string[] = [];

    if (page !== undefined) {
      if (typeof page !== 'number' || page < 1) {
        errors.push('Page must be a positive number');
      }
      if (page > 10000) {
        errors.push('Page number is too large (maximum 10000)');
      }
    }

    if (limit !== undefined) {
      if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
        errors.push('Limit must be a number between 1 and 1000');
      }
    }

    return errors;
  }

  protected validateSortOrder(sortOrder?: string): string | null {
    if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
      return 'Sort order must be either "asc" or "desc"';
    }
    return null;
  }

  protected validateId(id: string, fieldName: string): string | null {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return `${fieldName} is required and must be a non-empty string`;
    }
    return null;
  }

  protected validateDateRange(fromDate?: Date, toDate?: Date): string[] {
    const errors: string[] = [];

    if (
      (fromDate && !(fromDate instanceof Date)) ||
      (fromDate && isNaN(fromDate.getTime()))
    ) {
      errors.push('From date must be a valid date');
    }

    if (
      (toDate && !(toDate instanceof Date)) ||
      (toDate && isNaN(toDate.getTime()))
    ) {
      errors.push('To date must be a valid date');
    }

    if (fromDate && toDate && fromDate > toDate) {
      errors.push('From date must be before to date');
    }

    // Validate date range is not too large (e.g., more than 1 year)
    if (fromDate && toDate) {
      const daysDiff =
        Math.abs(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        errors.push('Date range cannot exceed 365 days');
      }
    }

    return errors;
  }

  protected validateSearchTerm(
    searchTerm?: string,
    minLength: number = 2,
    maxLength: number = 100
  ): string[] {
    const errors: string[] = [];

    if (searchTerm !== undefined) {
      if (typeof searchTerm !== 'string') {
        errors.push('Search term must be a string');
      } else if (searchTerm.length < minLength) {
        errors.push(
          `Search term must be at least ${minLength} characters long`
        );
      } else if (searchTerm.length > maxLength) {
        errors.push(
          `Search term must be no more than ${maxLength} characters long`
        );
      } else if (searchTerm.trim().length === 0) {
        errors.push('Search term cannot be empty or only whitespace');
      }
    }

    return errors;
  }

  protected validateFilters(filters?: Record<string, any>): string[] {
    const errors: string[] = [];

    if (filters) {
      if (typeof filters !== 'object' || Array.isArray(filters)) {
        errors.push('Filters must be an object');
      } else {
        const filterCount = Object.keys(filters).length;
        if (filterCount > 20) {
          errors.push('Too many filters (maximum 20 allowed)');
        }
      }
    }

    return errors;
  }

  protected validateSortFields(sortFields?: string[]): string[] {
    const errors: string[] = [];

    if (sortFields) {
      if (!Array.isArray(sortFields)) {
        errors.push('Sort fields must be an array');
      } else if (sortFields.length > 5) {
        errors.push('Too many sort fields (maximum 5 allowed)');
      } else {
        for (const field of sortFields) {
          if (typeof field !== 'string' || field.trim().length === 0) {
            errors.push('Sort field names must be non-empty strings');
            break;
          }
        }
      }
    }

    return errors;
  }

  protected validateUuid(uuid: string, fieldName: string): string | null {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return `${fieldName} must be a valid UUID`;
    }
    return null;
  }

  protected validateEnum<T>(
    value: T,
    enumValues: T[],
    fieldName: string
  ): string | null {
    if (!enumValues.includes(value)) {
      return `${fieldName} must be one of: ${enumValues.join(', ')}`;
    }
    return null;
  }
}
