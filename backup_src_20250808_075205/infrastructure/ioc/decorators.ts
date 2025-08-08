import 'reflect-metadata';

// Metadata keys
const INJECTABLE_METADATA_KEY = Symbol('injectable');
const INJECT_METADATA_KEY = Symbol('inject');

/**
 * Marks a class as injectable
 */
export function Injectable(token?: string): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(
      INJECTABLE_METADATA_KEY,
      token || target.name,
      target
    );
    return target;
  };
}

/**
 * Marks a parameter for dependency injection
 */
export function Inject(token: string): ParameterDecorator {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    const existingTokens =
      Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingTokens, target);

    // Also store parameter names for easier resolution
    const existingParamNames =
      Reflect.getMetadata('custom:paramnames', target) || [];
    existingParamNames[parameterIndex] = token;
    Reflect.defineMetadata('custom:paramnames', existingParamNames, target);
  };
}

/**
 * Gets the injectable token for a class
 */
export function getInjectableToken(target: any): string | undefined {
  return Reflect.getMetadata(INJECTABLE_METADATA_KEY, target);
}

/**
 * Gets the injection tokens for constructor parameters
 */
export function getInjectionTokens(target: any): string[] {
  return Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
}

/**
 * Service registration decorator
 */
export function Service(token?: string): ClassDecorator {
  return Injectable(token);
}

/**
 * Repository registration decorator
 */
export function Repository(token?: string): ClassDecorator {
  return Injectable(token);
}

/**
 * Controller registration decorator
 */
export function Controller(token?: string): ClassDecorator {
  return Injectable(token);
}
