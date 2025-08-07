import { PrismaClient } from '@prisma/client';
import { config } from '@/infrastructure/config/environment';
import { logger } from '@/infrastructure/logging/logger';

// Extend PrismaClient with custom functionality
class ExtendedPrismaClient extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: config.app.isTest
            ? config.database.testUrl
            : config.database.url,
        },
      },
      log: config.app.isDevelopment
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
    });

    // Log database queries in development
    if (config.app.isDevelopment) {
      this.$on('query', e => {
        logger.debug('Database Query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });
    }

    // Log database errors
    this.$on('error', e => {
      logger.error('Database Error', {
        message: e.message,
        target: e.target,
      });
    });

    // Log database info and warnings
    this.$on('info', e => {
      logger.info('Database Info', { message: e.message });
    });

    this.$on('warn', e => {
      logger.warn('Database Warning', { message: e.message });
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }
}

// Create singleton instance
let prisma: ExtendedPrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ExtendedPrismaClient | undefined;
}

if (config.app.isProduction) {
  prisma = new ExtendedPrismaClient();
} else {
  // In development, use a global variable to preserve the connection across hot reloads
  if (!globalThis.__prisma) {
    globalThis.__prisma = new ExtendedPrismaClient();
  }
  prisma = globalThis.__prisma;
}

export { prisma };
export type { PrismaClient } from '@prisma/client';

// Connection pool configuration
export const connectionPoolConfig = {
  // Maximum number of connections in the pool
  connectionLimit: config.app.isProduction ? 20 : 5,

  // Connection timeout in milliseconds
  connectTimeout: 30000,

  // Query timeout in milliseconds
  queryTimeout: 30000,

  // Pool timeout in milliseconds
  poolTimeout: 30000,
};

// Database health check utility
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const isHealthy = await prisma.healthCheck();
    const latency = Date.now() - startTime;

    return {
      isHealthy,
      latency,
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown handler
export async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down database connections...');
  await prisma.disconnect();
}
