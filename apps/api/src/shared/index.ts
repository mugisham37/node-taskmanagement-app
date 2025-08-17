// Export all shared utilities, constants, errors, types, enums, decorators, and guards
export * from './constants';
export * from './enums';
export * from './errors';
export * from './guards';
export * from './types';
export * from './utils';

export * from './services';

// Export decorators (excluding Container to avoid conflict)
export {
  INJECTABLE_METADATA_KEY,
  InjectableContainer,
  getInjectableMetadata,
  getInjectionTokens,
  inject,
  injectable,
  injectableContainer,
  isInjectable,
} from './decorators';

// Export container (with explicit Container interface)
export {
  Container,
  ContainerHealthChecker,
  DIContainer,
  SERVICE_TOKENS,
  ServiceDescriptor,
  ServiceFactory, // This is the Container interface from container module
  ServiceLifetime,
  ServiceToken,
} from './container';

