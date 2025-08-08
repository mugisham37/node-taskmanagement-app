import { IValidator } from '../types/validator.interface';

/**
 * Validation decorator for method parameters
 */
export function ValidateParams(validator: IValidator, schema: any) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validate parameters against schema
      await validator.validate(args, schema);
      return method.apply(this, args);
    };
  };
}

/**
 * Validation decorator for method return values
 */
export function ValidateResult(validator: IValidator, schema: any) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      // Validate result against schema
      await validator.validate(result, schema);
      return result;
    };
  };
}
