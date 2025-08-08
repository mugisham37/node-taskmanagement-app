// IoC Container exports
export {
  Container,
  IContainer,
  ServiceLifetime,
  ServiceDescriptor,
} from './container';
export {
  Injectable,
  Inject,
  Service,
  Repository,
  Controller,
} from './decorators';
export { ServiceRegistry, IServiceRegistry } from './service-registry';
export { Bootstrap, IBootstrap, bootstrap } from './bootstrap';
export {
  ServiceLocator,
  resolve,
  createScope,
  isRegistered,
} from './service-locator';

// Re-export commonly used types and functions
export type { ServiceDescriptor as IServiceDescriptor } from './container';
