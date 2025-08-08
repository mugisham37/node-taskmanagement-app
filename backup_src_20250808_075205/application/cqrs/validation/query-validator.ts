/**
 * Query Validation Infrastructure
 *
 * This module provides validation capabilities for queries before they are processed.
 */

import { IQuery, QueryValidationError } from '../query';
import { injectable } from '@/application/decorators/injectable';

export interface IQueryValidator {
  validate(query: IQuery): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export interface ValidationRule<T extends IQuery> {
  validate(query: T): Promise<string[]>;
  appliesTo(query: IQuery): boolean;
}

@injectable()
export class QueryValidator implements IQueryValidator {
  private rules = new Map<string, ValidationRule<any>[]>();

  async validate(query: IQuery): Promise<ValidationResult> {
    const queryType = query.constructor.name;
    const rules = this.rules.get(queryType) || [];

    const errors: Record<string, string[]> = {};

    for (const rule of rules) {
      if (rule.appliesTo(query)) {
        const ruleErrors = await rule.validate(query);
        if (ruleErrors.length > 0) {
          const ruleName = rule.constructor.name;
          errors[ruleName] = ruleErrors;
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  addRule<T extends IQuery>(queryType: string, rule: ValidationRule<T>): void {
    if (!this.rules.has(queryType)) {
      this.rules.set(queryType, []);
    }
    this.rules.get(queryType)!.push(rule);
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
      }
    }
  }

  clearRules(queryType?: string): void {
    if (queryType) {
      this.rules.delete(queryType);
    } else {
      this.rules.clear();
    }
  }
}

// Base validation rule class
export abstract class BaseValidationRule<T extends IQuery>
  implements ValidationRule<T>
{
  abstract validate(query: T): Promise<string[]>;
  abstract appliesTo(query: IQuery): boolean;

  protected validatePagination(page?: number, limit?: number): string[] {
    const errors: string[] = [];

    if (page !== undefined) {
      if (typeof page !== 'number' || page < 1) {
        errors.push('Page must be a positive number');
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
      }
    }

    return errors;
  }
}
