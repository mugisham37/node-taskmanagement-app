import Redis, { RedisOptions } from 'ioredis';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: number;
  keyPrefix?: string;
}

export class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor(config: RedisConfig) {
    const redisOptions: RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      enableReadyCheck: config.enableReadyCheck ?? true,
      lazyConnect: config.lazyConnect ?? true,
      keepAlive: config.keepAlive || 30000,
      family: config.family || 4,
      keyPrefix: config.keyPrefix || 'task-mgmt:',
      // Connection pool settings
      maxLoadingTimeout: 5000,
      // Retry strategy
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Reconnect on error
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    };

    this.client = new Redis(redisOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
    });

    this.client.on('error', (error: Error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis client reconnecting');
    });

    this.client.on('end', () => {
      console.log('Redis client connection ended');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to disconnect from Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  getClient(): Redis {
    if (!this.isConnected) {
      throw new InfrastructureError('Redis client is not connected');
    }
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      throw new InfrastructureError(
        `Redis ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
    } catch (error) {
      throw new InfrastructureError(
        `Failed to flush Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
