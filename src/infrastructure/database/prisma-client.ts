import { PrismaClient } from '@prisma/client';
import { logger } from '../logging/logger';

export interface HealthCheckResult {
  isHealthy: boolean;
  latency?: number;
  error?: string;
}

// Singleton Prisma client with connection pooling and optimization
class PrismaClientSingleton {
  private static instance: PrismaClient | null = null;
  private static isConnected = false;

  public static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      PrismaClientSingleton.instance = new PrismaClient({
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'info', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      // Set up logging
      PrismaClientSingleton.instance.$on('query', e => {
        logger.debug('Prisma Query', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target,
        });
      });

      PrismaClientSingleton.instance.$on('error', e => {
        logger.error('Prisma Error', { error: e });
      });

      PrismaClientSingleton.instance.$on('info', e => {
        logger.info('Prisma Info', { message: e.message, target: e.target });
      });

      PrismaClientSingleton.instance.$on('warn', e => {
        logger.warn('Prisma Warning', { message: e.message, target: e.target });
      });
    }

    return PrismaClientSingleton.instance;
  }

  public static async connect(): Promise<void> {
    if (!PrismaClientSingleton.isConnected) {
      try {
        const client = PrismaClientSingleton.getInstance();
        await client.$connect();
        PrismaClientSingleton.isConnected = true;
        logger.info('Prisma client connected successfully');
      } catch (error) {
        logger.error('Failed to connect Prisma client', { error });
        throw error;
      }
    }
  }

  public static async disconnect(): Promise<void> {
    if (PrismaClientSingleton.instance && PrismaClientSingleton.isConnected) {
      try {
        await PrismaClientSingleton.instance.$disconnect();
        PrismaClientSingleton.isConnected = false;
        logger.info('Prisma client disconnected successfully');
      } catch (error) {
        logger.error('Failed to disconnect Prisma client', { error });
        throw error;
      }
    }
  }

  public static async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const client = PrismaClientSingleton.getInstance();
      await client.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      return {
        isHealthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('Prisma health check failed', { error, latency });

      return {
        isHealthy: false,
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public static isConnected(): boolean {
    return PrismaClientSingleton.isConnected;
  }

  public static async gracefulShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown of Prisma client');

    try {
      await PrismaClientSingleton.disconnect();
      PrismaClientSingleton.instance = null;
      logger.info('Prisma client graceful shutdown completed');
    } catch (error) {
      logger.error('Error during Prisma client graceful shutdown', { error });
      throw error;
    }
  }
}

export const prisma = PrismaClientSingleton.getInstance();
export const connectPrisma = PrismaClientSingleton.connect;
export const disconnectPrisma = PrismaClientSingleton.disconnect;
export const prismaHealthCheck = PrismaClientSingleton.healthCheck;
export const checkDatabaseHealth = PrismaClientSingleton.healthCheck;
export const gracefulShutdown = PrismaClientSingleton.gracefulShutdown;
export const isPrismaConnected = PrismaClientSingleton.isConnected;

export type { PrismaClient };
