// Export all shared utilities, constants, errors, types, enums, decorators, and guards
export * from './constants';
export * from './enums';
export * from './errors';
export * from './guards';
// export * from './types'; // Types moved to @taskmanagement/types package
// export * from './utils'; // Utils moved to @taskmanagement/utils package

export * from './services';

// Export decorators (excluding Container to avoid conflict)
export {
  getInjectableMetadata,
  getInjectionTokens,
  inject,
  injectable,
  INJECTABLE_METADATA_KEY,
  InjectableContainer,
  injectableContainer,
  isInjectable,
} from './decorators';

// Export container (with explicit Container interface)
export type {
  Container,
  ServiceDescriptor,
  ServiceFactory, // This is the Container interface from container module
  ServiceLifetime,
  ServiceToken,
} from './container';

export { ContainerHealthChecker, DIContainer, SERVICE_TOKENS } from './container';
