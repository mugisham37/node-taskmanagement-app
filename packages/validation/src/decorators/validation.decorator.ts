/**
 * Validation decorators for method parameters and return values
 * Enhanced with comprehensive validation capabilities
 */

import { ValidationUtils } from '../validation-utils';

// Simple validator interface for decorators
interface SimpleValidator {
  validate(data: any, schema?: any): { isValid: boolean; errors: string[] };
}

// Default validator using ValidationUtils
const defaultValidator: SimpleValidator = {
  validate: (data: any, schema?: any) => {
    const errors: string[] = [];

    if (schema) {
      // Basic schema validation
      if (schema.required && !data) {
        errors.push('Value is required');
      }

      if (data && schema.type) {
        const actualType = typeof data;
        if (actualType !== schema.type) {
          errors.push(`Expected ${schema.type}, got ${actualType}`);
        }
      }

      if (
        data &&
        schema.minLength &&
        typeof data === 'string' &&
        data.length < schema.minLength
      ) {
        errors.push(`Minimum length is ${schema.minLength}`);
      }

      if (
        data &&
        schema.maxLength &&
        typeof data === 'string' &&
        data.length > schema.maxLength
      ) {
        errors.push(`Maximum length is ${schema.maxLength}`);
      }

      if (data && schema.email && !ValidationUtils.isValidEmail(data)) {
        errors.push('Invalid email format');
      }

      if (data && schema.uuid && !ValidationUtils.isValidUUID(data)) {
        errors.push('Invalid UUID format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Validation decorator for method parameters
 */
export function ValidateParams(
  validator: SimpleValidator = defaultValidator,
  schema?: any
) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validate parameters against schema
      const validation = validator.validate(args, schema);
      if (!validation.isValid) {
        throw new Error(
          `Parameter validation failed: ${validation.errors.join(', ')}`
        );
      }
      return method.apply(this, args);
    };
  };
}

/**
 * Validation decorator for method return values
 */
export function ValidateResult(
  validator: SimpleValidator = defaultValidator,
  schema?: any
) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      // Validate result against schema
      const validation = validator.validate(result, schema);
      if (!validation.isValid) {
        throw new Error(
          `Result validation failed: ${validation.errors.join(', ')}`
        );
      }
      return result;
    };
  };
}

/**
 * Enhanced parameter validation with individual parameter schemas
 */
export function ValidateParameters(
  paramSchemas: Array<{ name: string; schema: any }>
) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const errors: string[] = [];

      paramSchemas.forEach((paramSchema, index) => {
        if (index < args.length) {
          const validation = defaultValidator.validate(
            args[index],
            paramSchema.schema
          );
          if (!validation.isValid) {
            errors.push(
              `Parameter '${paramSchema.name}': ${validation.errors.join(', ')}`
            );
          }
        } else if (paramSchema.schema.required) {
          errors.push(
            `Parameter '${paramSchema.name}' is required but not provided`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(`Parameter validation failed: ${errors.join('; ')}`);
      }

      return method.apply(this, args);
    };
  };
}

/**
 * Validation decorator for object properties
 */
export function ValidateProperty(schema: any) {
  return function (target: any, propertyKey: string) {
    let value = target[propertyKey];

    const getter = () => value;
    const setter = (newValue: any) => {
      const validation = defaultValidator.validate(newValue, schema);
      if (!validation.isValid) {
        throw new Error(
          `Property '${propertyKey}' validation failed: ${validation.errors.join(', ')}`
        );
      }
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Email validation decorator
 */
export function ValidateEmail(target: any, propertyKey: string) {
  let value = target[propertyKey];

  const getter = () => value;
  const setter = (newValue: any) => {
    if (newValue && !ValidationUtils.isValidEmail(newValue)) {
      throw new Error(
        `Property '${propertyKey}' must be a valid email address`
      );
    }
    value = newValue;
  };

  Object.defineProperty(target, propertyKey, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

/**
 * UUID validation decorator
 */
export function ValidateUUID(target: any, propertyKey: string) {
  let value = target[propertyKey];

  const getter = () => value;
  const setter = (newValue: any) => {
    if (newValue && !ValidationUtils.isValidUUID(newValue)) {
      throw new Error(`Property '${propertyKey}' must be a valid UUID`);
    }
    value = newValue;
  };

  Object.defineProperty(target, propertyKey, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Required field validation decorator
 */
export function Required(target: any, propertyKey: string) {
  let value = target[propertyKey];

  const getter = () => value;
  const setter = (newValue: any) => {
    if (newValue === null || newValue === undefined || newValue === '') {
      throw new Error(`Property '${propertyKey}' is required`);
    }
    value = newValue;
  };

  Object.defineProperty(target, propertyKey, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Length validation decorator
 */
export function ValidateLength(minLength?: number, maxLength?: number) {
  return function (target: any, propertyKey: string) {
    let value = target[propertyKey];

    const getter = () => value;
    const setter = (newValue: any) => {
      if (newValue && typeof newValue === 'string') {
        if (minLength !== undefined && newValue.length < minLength) {
          throw new Error(
            `Property '${propertyKey}' must be at least ${minLength} characters long`
          );
        }
        if (maxLength !== undefined && newValue.length > maxLength) {
          throw new Error(
            `Property '${propertyKey}' cannot exceed ${maxLength} characters`
          );
        }
      }
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Range validation decorator for numbers
 */
export function ValidateRange(min?: number, max?: number) {
  return function (target: any, propertyKey: string) {
    let value = target[propertyKey];

    const getter = () => value;
    const setter = (newValue: any) => {
      if (
        newValue !== null &&
        newValue !== undefined &&
        typeof newValue === 'number'
      ) {
        if (min !== undefined && newValue < min) {
          throw new Error(`Property '${propertyKey}' must be at least ${min}`);
        }
        if (max !== undefined && newValue > max) {
          throw new Error(`Property '${propertyKey}' cannot exceed ${max}`);
        }
      }
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Pattern validation decorator
 */
export function ValidatePattern(pattern: RegExp, message?: string) {
  return function (target: any, propertyKey: string) {
    let value = target[propertyKey];

    const getter = () => value;
    const setter = (newValue: any) => {
      if (newValue && typeof newValue === 'string' && !pattern.test(newValue)) {
        throw new Error(
          message || `Property '${propertyKey}' does not match required pattern`
        );
      }
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Array validation decorator
 */
export function ValidateArray(
  itemValidator?: (item: any) => boolean,
  minItems?: number,
  maxItems?: number
) {
  return function (target: any, propertyKey: string) {
    let value = target[propertyKey];

    const getter = () => value;
    const setter = (newValue: any) => {
      if (newValue !== null && newValue !== undefined) {
        if (!Array.isArray(newValue)) {
          throw new Error(`Property '${propertyKey}' must be an array`);
        }

        if (minItems !== undefined && newValue.length < minItems) {
          throw new Error(
            `Property '${propertyKey}' must have at least ${minItems} items`
          );
        }

        if (maxItems !== undefined && newValue.length > maxItems) {
          throw new Error(
            `Property '${propertyKey}' cannot have more than ${maxItems} items`
          );
        }

        if (itemValidator) {
          const invalidItems = newValue.filter(
            (item, _index) => !itemValidator(item)
          );
          if (invalidItems.length > 0) {
            throw new Error(`Property '${propertyKey}' contains invalid items`);
          }
        }
      }
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}
