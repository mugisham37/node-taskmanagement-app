import { Injectable } from '../decorators/injectable';
import { WebhookEntity } from '../../domain/webhook/entities/webhook.entity';
import { WebhookDeliveryEntity } from '../../domain/webhook/entities/webhook-delivery.entity';
import { WebhookId } from '../../domain/webhook/value-objects/webhook-id';
import { WebhookDeliveryId } from '../../domain/webhook/value-objects/webhook-delivery-id';
import { WebhookEvent } from '../../domain/webhook/value-objects/webhook-event';
import { WebhookUrl } from '../../domain/webhook/value-objects/webhook-url';
import { WebhookRepository } from '../../domain/webhook/repositories/webhook.repository';
import { WebhookDeliveryRepository } from '../../domain/webhook/repositories/webhook-delivery.repository';
import { WebhookManagementService } from '../../domain/webhook/services/webhook-management.service';
import { WebhookDeliveryService } from '../../domain/webhook/services/webhook-delivery.service';
import { Logger } from '../../infrastructure/logging/logger';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

export interface WebhookTestSuite {
  id: string;
  name: string;
  description: string;
  tests: WebhookTest[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookTest {
  id: string;
  name: string;
  description: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  expectedStatusCodes: number[];
  expectedResponsePatterns?: string[];
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface WebhookTestResult {
  testId: string;
  webhookId: string;
  success: boolean;
  httpStatusCode?: number;
  responseTime: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  assertions: WebhookAssertion[];
  timestamp: Date;
}

export interface WebhookAssertion {
  type: 'status_code' | 'response_pattern' | 'response_time' | 'header_present';
  expected: any;
  actual: any;
  passed: boolean;
  message: string;
}

export interface WebhookDebugInfo {
  webhookId: string;
  url: string;
  configuration: {
    events: string[];
    headers: Record<string, string>;
    httpMethod: string;
    contentType: string;
    timeout: number;
    maxRetries: number;
    signatureAlgorithm?: string;
    hasSecret: boolean;
  };
  connectivity: {
    isReachable: boolean;
    responseTime?: number;
    sslValid?: boolean;
    redirects?: number;
    finalUrl?: string;
    errorMessage?: string;
  };
  recentDeliveries: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    lastDeliveryAt?: Date;
    commonErrors: string[];
  };
  recommendations: string[];
  healthScore: number; // 0-100
}

export interface WebhookLoadTestConfig {
  webhookId: string;
  concurrency: number;
  totalRequests: number;
  rampUpTime: number; // seconds
  testDuration?: number; // seconds
  payload?: Record<string, any>;
  event?: WebhookEvent;
}

export interface WebhookLoadTestResult {
  config: WebhookLoadTestConfig;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  timeline: Array<{
    timestamp: Date;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
  errors: Array<{
    message: string;
    count: number;
    percentage: number;
  }>;
  startTime: Date;
  endTime: Date;
  duration: number;
}

@Injectable()
export class WebhookTestingService {
  private httpClient: AxiosInstance;
  private testSuites = new Map<string, WebhookTestSuite>();

  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly webhookDeliveryRepository: WebhookDeliveryRepository,
    private readonly webhookManagementService: WebhookManagementService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly logger: Logger
  ) {
    this.httpClient = axios.create({
      timeout: 30000,
      maxRedirects: 10,
      validateStatus: () => true, // Accept all status codes for testing
    });
  }

  // Test Suite Management
  async createTestSuite(
    name: string,
    description: string,
    tests: Omit<WebhookTest, 'id'>[]
  ): Promise<WebhookTestSuite> {
    const testSuite: WebhookTestSuite = {
      id: this.generateId(),
      name,
      description,
      tests: tests.map(test => ({
        ...test,
        id: this.generateId(),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.testSuites.set(testSuite.id, testSuite);

    this.logger.info('Created webhook test suite', {
      testSuiteId: testSuite.id,
      name,
      testCount: tests.length,
    });

    return testSuite;
  }

  async getTestSuite(testSuiteId: string): Promise<WebhookTestSuite | null> {
    return this.testSuites.get(testSuiteId) || null;
  }

  async getAllTestSuites(): Promise<WebhookTestSuite[]> {
    return Array.from(this.testSuites.values());
  }

  async updateTestSuite(
    testSuiteId: string,
    updates: Partial<Pick<WebhookTestSuite, 'name' | 'description' | 'tests'>>
  ): Promise<WebhookTestSuite> {
    const testSuite = this.testSuites.get(testSuiteId);
    if (!testSuite) {
      throw new Error(`Test suite not found: ${testSuiteId}`);
    }

    Object.assign(testSuite, updates, { updatedAt: new Date() });

    this.logger.info('Updated webhook test suite', {
      testSuiteId,
      updates: Object.keys(updates),
    });

    return testSuite;
  }

  async deleteTestSuite(testSuiteId: string): Promise<void> {
    const deleted = this.testSuites.delete(testSuiteId);
    if (!deleted) {
      throw new Error(`Test suite not found: ${testSuiteId}`);
    }

    this.logger.info('Deleted webhook test suite', { testSuiteId });
  }

  // Individual Webhook Testing
  async testWebhookWithSuite(
    webhookId: WebhookId,
    testSuiteId: string
  ): Promise<WebhookTestResult[]> {
    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId.value}`);
    }

    const testSuite = this.testSuites.get(testSuiteId);
    if (!testSuite) {
      throw new Error(`Test suite not found: ${testSuiteId}`);
    }

    this.logger.info('Running webhook test suite', {
      webhookId: webhookId.value,
      testSuiteId,
      testCount: testSuite.tests.length,
    });

    const results: WebhookTestResult[] = [];

    for (const test of testSuite.tests) {
      try {
        const result = await this.runSingleTest(webhook, test);
        results.push(result);
      } catch (error) {
        this.logger.error('Test execution failed', {
          testId: test.id,
          webhookId: webhookId.value,
          error: error.message,
        });

        results.push({
          testId: test.id,
          webhookId: webhookId.value,
          success: false,
          responseTime: 0,
          errorMessage: error.message,
          assertions: [],
          timestamp: new Date(),
        });
      }
    }

    const successfulTests = results.filter(r => r.success).length;
    this.logger.info('Webhook test suite completed', {
      webhookId: webhookId.value,
      testSuiteId,
      totalTests: results.length,
      successfulTests,
      failedTests: results.length - successfulTests,
    });

    return results;
  }

  async testWebhookConnectivity(
    webhookId: WebhookId
  ): Promise<WebhookDebugInfo> {
    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId.value}`);
    }

    this.logger.info('Testing webhook connectivity', {
      webhookId: webhookId.value,
      url: webhook.url.value,
    });

    // Test basic connectivity
    const connectivity = await this.testConnectivity(webhook.url);

    // Get recent delivery statistics
    const recentDeliveries = await this.getRecentDeliveryStats(webhookId);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      webhook,
      connectivity,
      recentDeliveries
    );

    // Calculate health score
    const healthScore = this.calculateHealthScore(
      webhook,
      connectivity,
      recentDeliveries
    );

    const debugInfo: WebhookDebugInfo = {
      webhookId: webhookId.value,
      url: webhook.url.value,
      configuration: {
        events: webhook.events.map(e => e.value),
        headers: webhook.headers,
        httpMethod: webhook.httpMethod,
        contentType: webhook.contentType,
        timeout: webhook.timeout,
        maxRetries: webhook.maxRetries,
        signatureAlgorithm: webhook.signatureAlgorithm,
        hasSecret: !!webhook.secret,
      },
      connectivity,
      recentDeliveries,
      recommendations,
      healthScore,
    };

    this.logger.info('Webhook connectivity test completed', {
      webhookId: webhookId.value,
      isReachable: connectivity.isReachable,
      healthScore,
    });

    return debugInfo;
  }

  // Load Testing
  async runLoadTest(
    config: WebhookLoadTestConfig
  ): Promise<WebhookLoadTestResult> {
    const webhook = await this.webhookRepository.findById(
      WebhookId.fromString(config.webhookId)
    );
    if (!webhook) {
      throw new Error(`Webhook not found: ${config.webhookId}`);
    }

    this.logger.info('Starting webhook load test', {
      webhookId: config.webhookId,
      concurrency: config.concurrency,
      totalRequests: config.totalRequests,
    });

    const startTime = new Date();
    const results: Array<{
      success: boolean;
      responseTime: number;
      statusCode?: number;
      error?: string;
      timestamp: Date;
    }> = [];

    const timeline: Array<{
      timestamp: Date;
      requestsPerSecond: number;
      averageResponseTime: number;
      errorRate: number;
    }> = [];

    // Calculate request intervals
    const rampUpInterval = (config.rampUpTime * 1000) / config.totalRequests;
    const testPayload = config.payload || {
      id: `load-test-${Date.now()}`,
      event: config.event?.value || 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Load test payload' },
    };

    // Execute requests with ramp-up
    const requestPromises: Promise<void>[] = [];

    for (let i = 0; i < config.totalRequests; i++) {
      const delay = i * rampUpInterval;

      const requestPromise = new Promise<void>(resolve => {
        setTimeout(async () => {
          const requestStart = Date.now();

          try {
            const response = await this.sendTestRequest(webhook, testPayload);
            const responseTime = Date.now() - requestStart;

            results.push({
              success: response.status >= 200 && response.status < 300,
              responseTime,
              statusCode: response.status,
              timestamp: new Date(),
            });
          } catch (error) {
            const responseTime = Date.now() - requestStart;

            results.push({
              success: false,
              responseTime,
              error: error.message,
              timestamp: new Date(),
            });
          }

          resolve();
        }, delay);
      });

      requestPromises.push(requestPromise);
    }

    // Monitor progress and collect timeline data
    const monitoringInterval = setInterval(() => {
      const now = new Date();
      const recentResults = results.filter(
        r => now.getTime() - r.timestamp.getTime() < 1000
      );

      if (recentResults.length > 0) {
        const requestsPerSecond = recentResults.length;
        const averageResponseTime =
          recentResults.reduce((sum, r) => sum + r.responseTime, 0) /
          recentResults.length;
        const errorRate =
          (recentResults.filter(r => !r.success).length /
            recentResults.length) *
          100;

        timeline.push({
          timestamp: now,
          requestsPerSecond,
          averageResponseTime,
          errorRate,
        });
      }
    }, 1000);

    // Wait for all requests to complete
    await Promise.all(requestPromises);
    clearInterval(monitoringInterval);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Calculate summary statistics
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.length - successfulRequests;
    const responseTimes = results.map(r => r.responseTime);
    const averageResponseTime =
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = (results.length / duration) * 1000;
    const errorRate = (failedRequests / results.length) * 100;

    // Analyze errors
    const errorCounts = new Map<string, number>();
    results
      .filter(r => !r.success)
      .forEach(r => {
        const errorKey = r.error || `HTTP ${r.statusCode}`;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
      });

    const errors = Array.from(errorCounts.entries()).map(
      ([message, count]) => ({
        message,
        count,
        percentage: (count / failedRequests) * 100,
      })
    );

    const loadTestResult: WebhookLoadTestResult = {
      config,
      summary: {
        totalRequests: results.length,
        successfulRequests,
        failedRequests,
        averageResponseTime,
        minResponseTime,
        maxResponseTime,
        requestsPerSecond,
        errorRate,
      },
      timeline,
      errors,
      startTime,
      endTime,
      duration,
    };

    this.logger.info('Webhook load test completed', {
      webhookId: config.webhookId,
      duration,
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      requestsPerSecond,
    });

    return loadTestResult;
  }

  // Webhook Debugging Tools
  async traceWebhookDelivery(deliveryId: WebhookDeliveryId): Promise<{
    delivery: WebhookDeliveryEntity;
    webhook: WebhookEntity;
    attempts: Array<{
      attemptNumber: number;
      timestamp: Date;
      httpStatusCode?: number;
      responseTime?: number;
      errorMessage?: string;
    }>;
    timeline: Array<{
      timestamp: Date;
      event: string;
      details: Record<string, any>;
    }>;
  }> {
    const delivery = await this.webhookDeliveryRepository.findById(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId.value}`);
    }

    const webhook = await this.webhookRepository.findById(delivery.webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${delivery.webhookId.value}`);
    }

    // For now, return basic information
    // In a full implementation, this would include detailed attempt history
    const attempts = [
      {
        attemptNumber: delivery.attemptCount,
        timestamp: delivery.createdAt,
        httpStatusCode: delivery.httpStatusCode,
        responseTime: delivery.duration,
        errorMessage: delivery.errorMessage,
      },
    ];

    const timeline = [
      {
        timestamp: delivery.createdAt,
        event: 'delivery_created',
        details: { event: delivery.event.value },
      },
    ];

    if (delivery.deliveredAt) {
      timeline.push({
        timestamp: delivery.deliveredAt,
        event: 'delivery_completed',
        details: {
          status: delivery.status.value,
          httpStatusCode: delivery.httpStatusCode,
          duration: delivery.duration,
        },
      });
    }

    return {
      delivery,
      webhook,
      attempts,
      timeline,
    };
  }

  async simulateWebhookDelivery(
    webhook: WebhookEntity,
    event: WebhookEvent,
    payload: Record<string, any>
  ): Promise<{
    wouldSucceed: boolean;
    estimatedDuration: number;
    potentialIssues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if webhook can receive this event
    if (!webhook.canReceiveEvent(event)) {
      issues.push(`Webhook does not subscribe to event: ${event.value}`);
    }

    // Check webhook status
    if (!webhook.isActive) {
      issues.push('Webhook is not active');
      recommendations.push('Activate the webhook to receive events');
    }

    // Test connectivity
    const connectivity = await this.testConnectivity(webhook.url);
    if (!connectivity.isReachable) {
      issues.push('Webhook endpoint is not reachable');
      recommendations.push('Verify the webhook URL is correct and accessible');
    }

    // Estimate duration based on timeout and recent performance
    const estimatedDuration = connectivity.responseTime || webhook.timeout;

    // Check for potential SSL issues
    if (webhook.url.value.startsWith('http://')) {
      issues.push('Using HTTP instead of HTTPS');
      recommendations.push('Use HTTPS for better security');
    }

    // Check payload size
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 1000000) {
      // 1MB
      issues.push('Payload is very large (>1MB)');
      recommendations.push(
        'Consider reducing payload size for better performance'
      );
    }

    const wouldSucceed = issues.length === 0 && connectivity.isReachable;

    return {
      wouldSucceed,
      estimatedDuration,
      potentialIssues: issues,
      recommendations,
    };
  }

  // Private helper methods
  private async runSingleTest(
    webhook: WebhookEntity,
    test: WebhookTest
  ): Promise<WebhookTestResult> {
    const startTime = Date.now();
    const assertions: WebhookAssertion[] = [];

    try {
      const response = await this.sendTestRequest(
        webhook,
        test.payload,
        test.timeout
      );
      const responseTime = Date.now() - startTime;

      // Assert status code
      const statusCodePassed = test.expectedStatusCodes.includes(
        response.status
      );
      assertions.push({
        type: 'status_code',
        expected: test.expectedStatusCodes,
        actual: response.status,
        passed: statusCodePassed,
        message: statusCodePassed
          ? `Status code ${response.status} is expected`
          : `Expected status codes ${test.expectedStatusCodes.join(', ')}, got ${response.status}`,
      });

      // Assert response patterns
      if (test.expectedResponsePatterns) {
        const responseBody =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);

        for (const pattern of test.expectedResponsePatterns) {
          const regex = new RegExp(pattern, 'i');
          const patternPassed = regex.test(responseBody);

          assertions.push({
            type: 'response_pattern',
            expected: pattern,
            actual: responseBody.substring(0, 100),
            passed: patternPassed,
            message: patternPassed
              ? `Response matches pattern: ${pattern}`
              : `Response does not match pattern: ${pattern}`,
          });
        }
      }

      // Assert response time
      if (test.timeout) {
        const responseTimePassed = responseTime <= test.timeout;
        assertions.push({
          type: 'response_time',
          expected: `<= ${test.timeout}ms`,
          actual: `${responseTime}ms`,
          passed: responseTimePassed,
          message: responseTimePassed
            ? `Response time ${responseTime}ms is within timeout`
            : `Response time ${responseTime}ms exceeds timeout ${test.timeout}ms`,
        });
      }

      const allAssertionsPassed = assertions.every(a => a.passed);

      return {
        testId: test.id,
        webhookId: webhook.id.value,
        success: allAssertionsPassed,
        httpStatusCode: response.status,
        responseTime,
        responseBody:
          typeof response.data === 'string'
            ? response.data.substring(0, 1000)
            : JSON.stringify(response.data).substring(0, 1000),
        responseHeaders: response.headers,
        assertions,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        testId: test.id,
        webhookId: webhook.id.value,
        success: false,
        responseTime,
        errorMessage: error.message,
        assertions,
        timestamp: new Date(),
      };
    }
  }

  private async sendTestRequest(
    webhook: WebhookEntity,
    payload: Record<string, any>,
    timeout?: number
  ): Promise<any> {
    const requestConfig: AxiosRequestConfig = {
      method: webhook.httpMethod,
      url: webhook.url.value,
      headers: {
        'Content-Type': webhook.contentType,
        'User-Agent': 'Unified-Enterprise-Platform-Webhook-Test/1.0',
        ...webhook.headers,
      },
      timeout: timeout || webhook.timeout,
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = crypto
        .createHmac(webhook.signatureAlgorithm, webhook.secret.value)
        .update(JSON.stringify(payload))
        .digest('hex');

      const signatureHeader = webhook.signatureHeader || 'X-Webhook-Signature';
      requestConfig.headers![signatureHeader] =
        `${webhook.signatureAlgorithm}=${signature}`;
    }

    // Prepare request data
    if (webhook.contentType === 'application/json') {
      requestConfig.data = payload;
    } else {
      const formData = new URLSearchParams();
      formData.append('payload', JSON.stringify(payload));
      requestConfig.data = formData.toString();
    }

    return await this.httpClient.request(requestConfig);
  }

  private async testConnectivity(url: WebhookUrl): Promise<{
    isReachable: boolean;
    responseTime?: number;
    sslValid?: boolean;
    redirects?: number;
    finalUrl?: string;
    errorMessage?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.httpClient.head(url.value, {
        timeout: 10000,
        maxRedirects: 5,
      });

      const responseTime = Date.now() - startTime;

      return {
        isReachable: true,
        responseTime,
        sslValid: url.value.startsWith('https://'),
        redirects: response.request?.res?.responseUrl !== url.value ? 1 : 0,
        finalUrl: response.request?.res?.responseUrl || url.value,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isReachable: false,
        responseTime,
        errorMessage: error.message,
      };
    }
  }

  private async getRecentDeliveryStats(webhookId: WebhookId): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    lastDeliveryAt?: Date;
    commonErrors: string[];
  }> {
    const dateRange = {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      to: new Date(),
    };

    const stats = await this.webhookDeliveryService.getDeliveryStats(
      webhookId,
      undefined,
      dateRange
    );

    // Get common errors (simplified)
    const commonErrors: string[] = [];

    return {
      total: stats.totalDeliveries,
      successful: stats.successfulDeliveries,
      failed: stats.failedDeliveries,
      averageResponseTime: stats.averageResponseTime,
      commonErrors,
    };
  }

  private generateRecommendations(
    webhook: WebhookEntity,
    connectivity: any,
    recentDeliveries: any
  ): string[] {
    const recommendations: string[] = [];

    if (!connectivity.isReachable) {
      recommendations.push('Verify the webhook URL is correct and accessible');
    }

    if (webhook.url.value.startsWith('http://')) {
      recommendations.push('Use HTTPS for better security');
    }

    if (!webhook.secret) {
      recommendations.push('Add a secret for webhook signature verification');
    }

    if (webhook.timeout > 30000) {
      recommendations.push('Consider reducing timeout for better performance');
    }

    if (recentDeliveries.failed > recentDeliveries.successful) {
      recommendations.push(
        'High failure rate detected - check endpoint implementation'
      );
    }

    if (recentDeliveries.averageResponseTime > 5000) {
      recommendations.push(
        'Slow response times detected - optimize endpoint performance'
      );
    }

    return recommendations;
  }

  private calculateHealthScore(
    webhook: WebhookEntity,
    connectivity: any,
    recentDeliveries: any
  ): number {
    let score = 100;

    // Connectivity issues
    if (!connectivity.isReachable) {
      score -= 50;
    }

    // Security issues
    if (webhook.url.value.startsWith('http://')) {
      score -= 10;
    }

    if (!webhook.secret) {
      score -= 10;
    }

    // Performance issues
    if (recentDeliveries.averageResponseTime > 5000) {
      score -= 15;
    }

    // Reliability issues
    const failureRate =
      recentDeliveries.total > 0
        ? (recentDeliveries.failed / recentDeliveries.total) * 100
        : 0;

    if (failureRate > 50) {
      score -= 20;
    } else if (failureRate > 20) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  private generateId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
