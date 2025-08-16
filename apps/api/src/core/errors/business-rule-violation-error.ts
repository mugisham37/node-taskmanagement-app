import { AppError } from './app-error';

/**
 * Error thrown when business rules are violated
 */
export class BusinessRuleViolationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
  public readonly violations: any[];

  constructor(
    message: string,
    violations: any[] = [],
    context?: Record<string, any>
  ) {
    super(message, 'BUSINESS_RULE_VIOLATION', context);
    this.violations = violations;
  }

  static forViolations(violations: any[]): BusinessRuleViolationError {
    const message = violations.length === 1 
      ? violations[0].message 
      : `${violations.length} business rule violations detected`;
    
    return new BusinessRuleViolationError(message, violations, { violations });
  }
}