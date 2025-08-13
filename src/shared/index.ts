// Export all shared utilities, constants, errors, types, enums, decorators, and guards
export * from './constants';
export * from './enums';
export * from './errors';
export * from './guards';
export * from './types';
export * from './utils';
export * from './config';
export * from './services';

// Export decorators (excluding Container to avoid conflict)
export {
  injectable,
  inject,
  getInjectableMetadata,
  isInjectable,
  getInjectionTokens,
  InjectableContainer,
  injectableContainer,
  INJECTABLE_METADATA_KEY
} from './decorators';

// Export container (with explicit Container interface)
export {
  DIContainer,
  ServiceDescriptor,
  ServiceFactory,
  ContainerHealthChecker,
  Container, // This is the Container interface from container module
  ServiceLifetime,
  SERVICE_TOKENS,
  ServiceToken
} from './container';
