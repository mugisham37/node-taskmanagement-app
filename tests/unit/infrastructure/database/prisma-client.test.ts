import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  checkDatabaseHealth,
} from '@/infrastructure/database/prisma-client';

describe('Prisma Client', () => {
  beforeAll(async () => {
    // Ensure we can connect to the database
    const health = await checkDatabaseHealth();
    if (!health.isHealthy) {
      throw new Error(`Database is not healthy: ${health.error}`);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to database successfully', async () => {
    const health = await checkDatabaseHealth();
    expect(health.isHealthy).toBe(true);
    expect(health.latency).toBeTypeOf('number');
  });

  it('should perform health check', async () => {
    const isHealthy = await prisma.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it('should execute raw queries', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
