import { DIContainer } from '../../shared/container';
import { FastifyInstance } from 'fastify';
import { MigrationController } from './fastify-migration.controller';
import { setupMigrationRoutes } from './migration-routes';

/**
 * Migration Module
 * Registers migration services and routes with the application
 */
export class MigrationModule {
  private migrationController: MigrationController;

  constructor(private readonly container: DIContainer) {
    this.migrationController = new MigrationController(container);
  }

  /**
   * Register migration routes and services
   */
  async register(app: FastifyInstance): Promise<void> {
    // Register controller routes
    await this.migrationController.registerRoutes(app);
    
    // Register additional migration routes
    await setupMigrationRoutes(app, this.container);
  }

  /**
   * Get migration controller instance
   */
  getController(): MigrationController {
    return this.migrationController;
  }
}

/**
 * Factory function to create and configure migration module
 */
export function createMigrationModule(container: DIContainer): MigrationModule {
  return new MigrationModule(container);
}

/**
 * Setup migration module with Fastify app
 */
export async function setupMigrationModule(
  app: FastifyInstance,
  container: DIContainer
): Promise<MigrationModule> {
  const migrationModule = createMigrationModule(container);
  await migrationModule.register(app);
  return migrationModule;
}
