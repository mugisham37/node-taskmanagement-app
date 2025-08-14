import { FastifyInstance } from 'fastify';

export class ApiHelpers {
  static async authenticateUser(
    app: FastifyInstance,
    email: string,
    password: string
  ): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    if (response.statusCode !== 200) {
      throw new Error(`Authentication failed: ${response.body}`);
    }

    const data = JSON.parse(response.body);
    return data.data.accessToken;
  }

  static async registerUser(app: FastifyInstance, userData: any): Promise<any> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: userData,
    });

    if (response.statusCode !== 201) {
      throw new Error(`Registration failed: ${response.body}`);
    }

    return JSON.parse(response.body).data;
  }

  static async createWorkspace(
    app: FastifyInstance,
    token: string,
    workspaceData: any
  ): Promise<any> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { authorization: `Bearer ${token}` },
      payload: workspaceData,
    });

    if (response.statusCode !== 201) {
      throw new Error(`Workspace creation failed: ${response.body}`);
    }

    return JSON.parse(response.body).data;
  }

  static async createProject(
    app: FastifyInstance,
    token: string,
    projectData: any
  ): Promise<any> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: projectData,
    });

    if (response.statusCode !== 201) {
      throw new Error(`Project creation failed: ${response.body}`);
    }

    return JSON.parse(response.body).data;
  }

  static async createTask(
    app: FastifyInstance,
    token: string,
    taskData: any
  ): Promise<any> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: taskData,
    });

    if (response.statusCode !== 201) {
      throw new Error(`Task creation failed: ${response.body}`);
    }

    return JSON.parse(response.body).data;
  }

  static createAuthHeaders(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  static expectSuccessResponse(
    response: any,
    expectedStatusCode: number = 200
  ) {
    expect(response.statusCode).toBe(expectedStatusCode);

    const data = JSON.parse(response.body);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();

    return data.data;
  }

  static expectErrorResponse(response: any, expectedStatusCode: number) {
    expect(response.statusCode).toBe(expectedStatusCode);

    const data = JSON.parse(response.body);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
    expect(data.error.message).toBeDefined();

    return data.error;
  }

  static async makeAuthenticatedRequest(
    app: FastifyInstance,
    method: string,
    url: string,
    token: string,
    payload?: any
  ) {
    return app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
  }

  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static generateRandomEmail(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
  }

  static generateRandomString(length: number = 10): string {
    return Math.random().toString(36).substr(2, length);
  }
}
