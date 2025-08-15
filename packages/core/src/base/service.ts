/**
 * Service interfaces and base classes
 */

export interface Service {
  readonly name: string;
}

/**
 * Domain service interface
 */
export interface DomainService extends Service {
  // Domain services contain business logic that doesn't naturally fit within an entity or value object
}

/**
 * Application service interface
 */
export interface ApplicationService extends Service {
  // Application services orchestrate the execution of domain logic
}

/**
 * Infrastructure service interface
 */
export interface InfrastructureService extends Service {
  // Infrastructure services provide technical capabilities
  isHealthy(): Promise<boolean>;
}

/**
 * Abstract base class for domain services
 */
export abstract class BaseDomainService implements DomainService {
  abstract readonly name: string;
}

/**
 * Abstract base class for application services
 */
export abstract class BaseApplicationService implements ApplicationService {
  abstract readonly name: string;
}

/**
 * Abstract base class for infrastructure services
 */
export abstract class BaseInfrastructureService implements InfrastructureService {
  abstract readonly name: string;

  abstract isHealthy(): Promise<boolean>;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Override in subclasses if initialization is needed
  }

  /**
   * Cleanup the service
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if cleanup is needed
  }
}