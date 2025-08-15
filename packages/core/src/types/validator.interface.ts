/**
 * Validator interfaces for consistent validation across the application
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
  context?: Record<string, any>;
}

export interface Validator<T = any> {
  validate(data: T): ValidationResult;
  validateAsync?(data: T): Promise<ValidationResult>;
}

export interface ValidationRule<T = any> {
  name: string;
  message: string;
  validate(value: T, context?: any): boolean;
  validateAsync?(value: T, context?: any): Promise<boolean>;
}

export interface ValidationSchema {
  [field: string]: ValidationRule[] | ValidationSchema;
}

export interface ValidationContext {
  path: string[];
  root: any;
  parent: any;
  field: string;
  value: any;
  [key: string]: any;
}

export interface ValidatorOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  context?: Record<string, any>;
}

export interface FieldValidator {
  required(message?: string): FieldValidator;
  optional(): FieldValidator;
  type(
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
    message?: string
  ): FieldValidator;
  min(value: number, message?: string): FieldValidator;
  max(value: number, message?: string): FieldValidator;
  length(value: number, message?: string): FieldValidator;
  pattern(regex: RegExp, message?: string): FieldValidator;
  email(message?: string): FieldValidator;
  url(message?: string): FieldValidator;
  uuid(message?: string): FieldValidator;
  enum(values: any[], message?: string): FieldValidator;
  custom(
    validator: (value: any, context?: ValidationContext) => boolean | string,
    message?: string
  ): FieldValidator;
  when(
    condition: string | ((context: ValidationContext) => boolean),
    then: FieldValidator,
    otherwise?: FieldValidator
  ): FieldValidator;
}

export interface SchemaBuilder {
  object(schema: Record<string, FieldValidator>): Validator;
  array(itemValidator: FieldValidator): FieldValidator;
  string(): FieldValidator;
  number(): FieldValidator;
  boolean(): FieldValidator;
  date(): FieldValidator;
  any(): FieldValidator;
}

export interface ValidationMiddleware {
  body(validator: Validator): (req: any, res: any, next: any) => void;
  query(validator: Validator): (req: any, res: any, next: any) => void;
  params(validator: Validator): (req: any, res: any, next: any) => void;
  headers(validator: Validator): (req: any, res: any, next: any) => void;
}

export interface ValidationDecorator {
  validate(validator: Validator): MethodDecorator;
  validateBody(validator: Validator): MethodDecorator;
  validateQuery(validator: Validator): MethodDecorator;
  validateParams(validator: Validator): MethodDecorator;
}

export interface ValidationCache {
  get(key: string): ValidationResult | undefined;
  set(key: string, result: ValidationResult, ttl?: number): void;
  clear(): void;
}

export interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  validationsByField: Record<string, number>;
  commonErrors: Array<{
    field: string;
    message: string;
    count: number;
  }>;
}

export interface ValidationProfile {
  name: string;
  rules: ValidationRule[];
  enabled: boolean;
  priority: number;
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt';
    value: any;
  }>;
}

export interface ValidationReport {
  profileName: string;
  totalFields: number;
  validFields: number;
  invalidFields: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  executionTime: number;
  timestamp: Date;
}