/**
 * Command Validation Infrastructure
 *
 * This module provides validation capabilities for commands before they are processed.
 */

import { ICommand, CommandValidationError } from '../command';
import { injectable } from '@/application/decorators/injectable';

export interface ICommandValidator {
  validate(command: ICommand): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export interface ValidationRule<T extends ICommand> {
  validate(command: T): Promise<string[]>;
  appliesTo(command: ICommand): boolean;
}

@injectable()
export class CommandValidator implements ICommandValidator {
  private rules = new Map<string, ValidationRule<any>[]>();

  async validate(command: ICommand): Promise<ValidationResult> {
    const commandType = command.constructor.name;
    const rules = this.rules.get(commandType) || [];

    const errors: Record<string, string[]> = {};

    for (const rule of rules) {
      if (rule.appliesTo(command)) {
        const ruleErrors = await rule.validate(command);
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

  addRule<T extends ICommand>(
    commandType: string,
    rule: ValidationRule<T>
  ): void {
    if (!this.rules.has(commandType)) {
      this.rules.set(commandType, []);
    }
    this.rules.get(commandType)!.push(rule);
  }

  removeRule<T extends ICommand>(
    commandType: string,
    rule: ValidationRule<T>
  ): void {
    const rules = this.rules.get(commandType);
    if (rules) {
      const index = rules.indexOf(rule);
      if (index > -1) {
        rules.splice(index, 1);
      }
    }
  }

  clearRules(commandType?: string): void {
    if (commandType) {
      this.rules.delete(commandType);
    } else {
      this.rules.clear();
    }
  }
}

// Base validation rule class
export abstract class BaseValidationRule<T extends ICommand>
  implements ValidationRule<T>
{
  abstract validate(command: T): Promise<string[]>;
  abstract appliesTo(command: ICommand): boolean;

  protected validateRequired(value: any, fieldName: string): string | null {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  }

  protected validateLength(
    value: string,
    fieldName: string,
    min?: number,
    max?: number
  ): string | null {
    if (min !== undefined && value.length < min) {
      return `${fieldName} must be at least ${min} characters long`;
    }
    if (max !== undefined && value.length > max) {
      return `${fieldName} must be no more than ${max} characters long`;
    }
    return null;
  }

  protected validateEmail(email: string, fieldName: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return `${fieldName} must be a valid email address`;
    }
    return null;
  }

  protected validateDate(
    date: Date,
    fieldName: string,
    minDate?: Date,
    maxDate?: Date
  ): string | null {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return `${fieldName} must be a valid date`;
    }

    if (minDate && date < minDate) {
      return `${fieldName} must be after ${minDate.toISOString()}`;
    }

    if (maxDate && date > maxDate) {
      return `${fieldName} must be before ${maxDate.toISOString()}`;
    }

    return null;
  }

  protected validateNumber(
    value: number,
    fieldName: string,
    min?: number,
    max?: number
  ): string | null {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${fieldName} must be a valid number`;
    }

    if (min !== undefined && value < min) {
      return `${fieldName} must be at least ${min}`;
    }

    if (max !== undefined && value > max) {
      return `${fieldName} must be no more than ${max}`;
    }

    return null;
  }
}
