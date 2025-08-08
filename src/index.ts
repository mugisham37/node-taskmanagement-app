import { bootstrap as iocBootstrap } from '@/infrastructure/ioc/bootstrap';
import { ServiceLocator } from '@/infrastructure/ioc/service-locator';
import { createServer } from '@/infrastructure/server/fastify-server';
import { config } from '../shared/config/environment';
import { logger } from '@/infrastructure/logging/logger';

async function bootstrap(): Promise<void> {
  try {
    // Initialize IoC container and services
    logger.info('🔧 Initializing dependency injection container...');
    const container = await iocBootstrap.initialize();
    ServiceLocator.setContainer(container);

    // Create and start server
    const server = await createServer();

    const address = await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`🚀 Unified Enterprise Platform started successfully`);
    logger.info(`📡 Server listening at ${address}`);
    logger.info(`🌍 Environment: ${config.app.environment}`);
    logger.info(`📊 API Documentation: ${address}/docs`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`📴 Received ${signal}, shutting down gracefully...`);

      try {
        // Shutdown IoC container first
        await iocBootstrap.shutdown();
        ServiceLocator.clear();

        // Then close server
        await server.close();
        logger.info('✅ Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrap().catch(error => {
  logger.error('Bootstrap failed:', error);
  process.exit(1);
});
