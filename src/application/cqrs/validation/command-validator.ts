/**
 * Enhanced Command Validation Infrastructure
 *
 * This module provides comprehensive validation capabilities for commands before they are processed.
 */

import { ICommand } from '../command';
import { injectable } from '../../../shared/decorators/injectable.decorator';
import { LoggingService } from '../../../infrastructure/monitoring/logging-service';

export interface ICommandValidator {
  validate(command: ICommand): Promise<ValidationResult>;
  addRule<T extends ICommand>(
    commandType: string,
    rule: ValidationRule<T>
  ): void;
  removeRule<T extends ICommand>(
    commandType: string,
    rule: ValidationRule<T>
  ): void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
}

export interface ValidationRule<T extends ICommand> {
  validate(command: T): Promise<string[]>;
  appliesTo(command: ICommand): boolean;
  priority?: number; // Higher priority rules run first
}

@injectable()
export class CommandValidator implements ICommandValidator {
  private rules = new Map<string, ValidationRule<any>[]>();

  constructor(private readonly logger: LoggingService) {}

  async validate(command: ICommand): Promise<ValidationResult> {
    const commandType = command.constructor.name;
    const rules = this.rules.get(commandType) || [];

    // Sort rules by priority (higher first)
    const sortedRules = rules.sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    const errors: Record<string, string[]> = {};
    const warnings: Record<string, string[]> = {};

    this.logger.debug('Validating command', {
      commandType,
      commandId: command.commandId,
      rulesCount: sortedRules.length,
    });

    for (const rule of sortedRules) {
      if (rule.appliesTo(command)) {
        try {
          const ruleErrors = await rule.validate(command);
          if (ruleErrors.length > 0) {
            const ruleName = rule.constructor.name;
            errors[ruleName] = ruleErrors;
          }
        } catch (error) {
          this.logger.error('Validation rule failed', error as Error, {
            commandType,
            commandId: command.commandId,
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

    this.logger.debug('Command validation completed', {
      commandType,
      commandId: command.commandId,
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

  addRule<T extends ICommand>(
    commandType: string,
    rule: ValidationRule<T>
  ): void {
    if (!this.rules.has(commandType)) {
      this.rules.set(commandType, []);
    }
    this.rules.get(commandType)!.push(rule);

    this.logger.debug('Validation rule added', {
      commandType,
      ruleName: rule.constructor.name,
      priority: rule.priority || 0,
    });
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
        this.logger.debug('Validation rule removed', {
          commandType,
          ruleName: rule.constructor.name,
        });
      }
    }
  }

  clearRules(commandType?: string): void {
    if (commandType) {
      this.rules.delete(commandType);
      this.logger.debug('Validation rules cleared for command type', {
        commandType,
      });
    } else {
      this.rules.clear();
      this.logger.debug('All validation rules cleared');
    }
  }

  getRulesCount(commandType?: string): number {
    if (commandType) {
      return this.rules.get(commandType)?.length || 0;
    }
    return Array.from(this.rules.values()).reduce(
      (total, rules) => total + rules.length,
      0
    );
  }
}

// Base validation rule class with enhanced validation methods
export abstract class BaseCommandValidationRule<T extends ICommand>
  implements ValidationRule<T>
{
  public priority: number = 0;

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

  protected validateUrl(url: string, fieldName: string): string | null {
    try {
      new URL(url);
      return null;
    } catch {
      return `${fieldName} must be a valid URL`;
    }
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

  protected validateArray(
    array: any[],
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): string | null {
    if (!Array.isArray(array)) {
      return `${fieldName} must be an array`;
    }

    if (minLength !== undefined && array.length < minLength) {
      return `${fieldName} must contain at least ${minLength} items`;
    }

    if (maxLength !== undefined && array.length > maxLength) {
      return `${fieldName} must contain no more than ${maxLength} items`;
    }

    return null;
  }

  protected validateUuid(uuid: string, fieldName: string): string | null {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return `${fieldName} must be a valid UUID`;
    }
    return null;
  }
}
