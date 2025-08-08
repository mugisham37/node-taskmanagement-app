import { ILogger } from '../types/logger.interface';

/**
 * Logging decorator for methods
 */
export function LogMethod(logger: ILogger) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;

      logger.debug(`Entering ${className}.${methodName}`, { args });

      try {
        const result = await method.apply(this, args);
        logger.debug(`Exiting ${className}.${methodName}`, { result });
        return result;
      } catch (error) {
        logger.error(`Error in ${className}.${methodName}`, { error, args });
        throw error;
      }
    };
  };
}

/**
 * Performance logging decorator
 */
export function LogPerformance(logger: ILogger) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const className = target.constructor.name;
      const methodName = propertyName;
      const startTime = Date.now();

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        logger.info(`${className}.${methodName} completed`, { duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`${className}.${methodName} failed`, { duration, error });
        throw error;
      }
    };
  };
}
