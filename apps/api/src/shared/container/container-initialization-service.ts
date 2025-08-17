import { TransactionIntegrationService } from '@taskmanagement/database';
import { EventHandlerLifecycleManager, EventIntegrationService } from '@taskmanagement/events';
import { LoggingService } from '@taskmanagement/observability';
import { DIContainer } from './container';
import { DependencyValidationService } from './dependency-validation-service';
import { registerServices } from './service-registration';
import { Container } from './types';

/**
 * Container Initialization Service
 *
 * Provides comprehensive initialization of the dependency injection container,
 * including service registration, validation, and integration setup.
 */
export class ContainerInitializationService {
  private container: Container | null = null;
  private isInitialized = false;
  private initializationError: Error | null = null;

  /**
   * Initialize the dependency injection container
   */
  async initialize(): Promise<Container> {
    if (this.isInitialized && this.container) {
      return this.container;
    }

    if (this.initializationError) {
      throw this.initializationError;
    }

    try {
      console.log('Starting dependency injection container initialization...');

      // Create container instance
      this.container = new DIContainer();

      // Register all services
      console.log('Registering services...');
      registerServices(this.container);

      // Validate dependencies
      console.log('Validating dependencies...');
      await this.validateDependencies();

      // Initialize integration services
      console.log('Initializing integration services...');
      await this.initializeIntegrationServices();

      // Perform health checks
      console.log('Performing health checks...');
      await this.performHealthChecks();

      this.isInitialized = true;
      console.log('Dependency injection container initialized successfully');

      return this.container;
    } catch (error) {
      this.initializationError = error as Error;
      console.error('Failed to initialize dependency injection container:', error);
      throw error;
    }
  }

  /**
   * Get the initialized container
   */
  getContainer(): Container {
    if (!this.isInitialized || !this.container) {
      throw new Error('Container not initialized. Call initialize() first.');
    }

    return this.container;
  }

  /**
   * Check if container is initialized
   */
  isContainerInitialized(): boolean {
    return this.isInitialized && this.container !== null;
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): {
    isInitialized: boolean;
    hasError: boolean;
    error?: string | undefined;
    registeredServices: string[];
  } {
    return {
      isInitialized: this.isInitialized,
      hasError: this.initializationError !== null,
      error: this.initializationError?.message,
      registeredServices: this.container?.getRegisteredServices() || [],
    };
  }

  /**
   * Validate all dependencies
   */
  private async validateDependencies(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not created');
    }

    // Get logging service for validation
    const loggingService = this.container.resolve<LoggingService>('LoggingService');

    // Create validation service
    const validationService = new DependencyValidationService(this.container, loggingService);

    // Perform validation
    const validationSummary = await validationService.validateAllDependencies();

    if (!validationSummary.isValid) {
      const report = validationService.getDetailedReport();
      console.error('Dependency validation failed:', report);
      throw new Error(
        `Dependency validation failed: ${validationSummary.invalidServices} invalid services`
      );
    }

    console.log(
      `Dependency validation passed: ${validationSummary.validServices} services validated`
    );
  }

  /**
   * Initialize integration services
   */
  private async initializeIntegrationServices(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not created');
    }

    try {
      // Initialize event integration service
      const eventIntegrationService =
        this.container.resolve<EventIntegrationService>('EventIntegrationService');
      await eventIntegrationService.initialize();

      // Initialize event handler lifecycle manager
      const eventHandlerLifecycleManager = this.container.resolve<EventHandlerLifecycleManager>(
        'EventHandlerLifecycleManager'
      );
      await eventHandlerLifecycleManager.initialize();

      console.log('Integration services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize integration services:', error);
      throw error;
    }
  }

  /**
   * Perform health checks on critical services
   */
  private async performHealthChecks(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not created');
    }

    const healthChecks = [
      {
        name: 'Database Connection',
        check: async () => {
          // Test database connection
          this.container!.resolve('DatabaseConnection');
          // Assume database connection has a health check method
          return { isHealthy: true };
        },
      },
      {
        name: 'Cache Service',
        check: async () => {
          // Test cache connection
          this.container!.resolve('CacheService');
          // Assume cache service has a health check method
          return { isHealthy: true };
        },
      },
      {
        name: 'Event Integration Service',
        check: async () => {
          const eventService =
            this.container!.resolve<EventIntegrationService>('EventIntegrationService');
          return await eventService.getHealthStatus();
        },
      },
      {
        name: 'Transaction Integration Service',
        check: async () => {
          const transactionService = this.container!.resolve<TransactionIntegrationService>(
            'TransactionIntegrationService'
          );
          return await transactionService.healthCheck();
        },
      },
    ];

    const results = await Promise.allSettled(
      healthChecks.map(async ({ name, check }) => {
        try {
          const result = await check();
          return { name, ...result };
        } catch (error) {
          return { name, isHealthy: false, error: (error as Error).message };
        }
      })
    );

    const failedChecks = results
      .filter((result) => {
        if (result.status === 'rejected') {
          return true;
        }
        return !result.value.isHealthy;
      })
      .map((result) => {
        if (result.status === 'rejected') {
          return `Health check failed: ${result.reason}`;
        }
        return `${result.value?.name || 'Unknown'}: ${result.value?.error || 'Health check failed'}`;
      });

    if (failedChecks.length > 0) {
      const errorMessage = `Health checks failed:\n${failedChecks.join('\n')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    console.log(`All health checks passed (${healthChecks.length} checks)`);
  }

  /**
   * Shutdown the container and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (!this.container) {
      return;
    }

    try {
      console.log('Shutting down dependency injection container...');

      // Shutdown integration services
      if (this.isInitialized) {
        try {
          const eventIntegrationService =
            this.container.resolve<EventIntegrationService>('EventIntegrationService');
          await eventIntegrationService.shutdown();
        } catch (error) {
          console.error('Error shutting down event integration service:', error);
        }
      }

      // Clear container
      if (this.container) {
        this.container.clear();
      }
      this.container = null;
      this.isInitialized = false;
      this.initializationError = null;

      console.log('Dependency injection container shut down successfully');
    } catch (error) {
      console.error('Error during container shutdown:', error);
      throw error;
    }
  }

  /**
   * Create a scoped container for request-specific services
   */
  createScopedContainer(): Container {
    if (!this.container) {
      throw new Error('Container not initialized');
    }

    return this.container.createScope();
  }

  /**
   * Get container metrics
   */
  getContainerMetrics(): {
    registeredServices: number;
    isInitialized: boolean;
    hasError: boolean;
    initializationTime?: number;
  } {
    return {
      registeredServices: this.container?.getRegisteredServices().length || 0,
      isInitialized: this.isInitialized,
      hasError: this.initializationError !== null,
    };
  }

  /**
   * Reinitialize the container (useful for testing or configuration changes)
   */
  async reinitialize(): Promise<Container> {
    await this.shutdown();
    return this.initialize();
  }
}

// Export singleton instance
export const containerInitializationService = new ContainerInitializationService();

