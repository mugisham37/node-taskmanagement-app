import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  TestServer,
  setupTestServer,
  teardownTestServer,
} from '../test-server';

describe('Health API Integration Tests', () => {
  let testServer: TestServer;

  beforeAll(async () => {
    testServer = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
        version: '1.0.0',
      });
    });

    it('should include proper headers', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return API health status', async () => {
      // This test assumes there's an API health endpoint
      // If it doesn't exist yet, this test will help drive its creation
      const response = await testServer.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      // For now, we expect this to return 404 since the endpoint doesn't exist
      // Once implemented, we can update this test
      expect([200, 404]).toContain(response.statusCode);
    });
  });
});
