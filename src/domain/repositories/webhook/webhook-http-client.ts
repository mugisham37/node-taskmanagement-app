import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { WebhookEntity } from '../../domain/webhook/entities/webhook.entity';
import { WebhookPayload } from '../../domain/webhook/services/webhook-delivery.service';
import { Logger } from '../logging/logger';
import * as crypto from 'crypto';

export interface WebhookHttpConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxRedirects: number;
  validateSSL: boolean;
  userAgent: string;
  defaultHeaders: Record<string, string>;
  maxPayloadSize: number; // in bytes
  connectionTimeout: number;
  keepAlive: boolean;
}

export interface WebhookDeliveryResult {
  success: boolean;
  httpStatusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  duration: number;
  errorMessage?: string;
  retryable: boolean;
  metadata: Record<string, any>;
}

export class WebhookHttpClient {
  private httpClient: AxiosInstance;
  private config: WebhookHttpConfig;
  private logger: Logger;

  constructor(config: Partial<WebhookHttpConfig>, logger: Logger) {
    this.logger = logger;
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRedirects: 5,
      validateSSL: true,
      userAgent: 'Unified-Enterprise-Platform-Webhook/1.0',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'User-Agent': 'Unified-Enterprise-Platform-Webhook/1.0',
      },
      maxPayloadSize: 1024 * 1024, // 1MB
      connectionTimeout: 10000,
      keepAlive: true,
      ...config,
    };

    this.httpClient = this.createHttpClient();
    this.setupInterceptors();
  }

  async deliverWebhook(
    webhook: WebhookEntity,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      // Validate payload size
      const payloadString = JSON.stringify(payload);
      if (
        Buffer.byteLength(payloadString, 'utf8') > this.config.maxPayloadSize
      ) {
        throw new Error(
          `Payload size exceeds maximum allowed size of ${this.config.maxPayloadSize} bytes`
        );
      }

      // Prepare request configuration
      const requestConfig = this.buildRequestConfig(webhook, payload);

      this.logger.debug('Sending webhook request', {
        webhookId: webhook.id.value,
        url: webhook.url.value,
        method: webhook.httpMethod,
        payloadSize: Buffer.byteLength(payloadString, 'utf8'),
      });

      // Send request with retry logic
      const response = await this.sendWithRetry(
        requestConfig,
        webhook.maxRetries
      );
      const duration = Date.now() - startTime;

      this.logger.info('Webhook delivered successfully', {
        webhookId: webhook.id.value,
        url: webhook.url.value,
        statusCode: response.status,
        duration,
      });

      return {
        success: true,
        httpStatusCode: response.status,
        responseBody: this.truncateResponseBody(response.data),
        responseHeaders: this.sanitizeHeaders(response.headers),
        duration,
        retryable: false,
        metadata: {
          requestSize: Buffer.byteLength(payloadString, 'utf8'),
          responseSize: response.headers['content-length'] || 0,
          userAgent: this.config.userAgent,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const isRetryable = this.isRetryableError(error);

      this.logger.error('Webhook delivery failed', {
        webhookId: webhook.id.value,
        url: webhook.url.value,
        error: error.message,
        statusCode: error.response?.status,
        duration,
        retryable: isRetryable,
      });

      return {
        success: false,
        httpStatusCode: error.response?.status,
        responseBody: error.response?.data
          ? this.truncateResponseBody(error.response.data)
          : undefined,
        responseHeaders: error.response?.headers
          ? this.sanitizeHeaders(error.response.headers)
          : undefined,
        duration,
        errorMessage: error.message,
        retryable: isRetryable,
        metadata: {
          errorType: error.code || 'UNKNOWN',
          isTimeout: error.code === 'ECONNABORTED',
          isNetworkError: !error.response,
        },
      };
    }
  }

  async testWebhookConnection(
    webhook: WebhookEntity,
    testPayload?: Record<string, any>
  ): Promise<{
    success: boolean;
    responseTime: number;
    statusCode?: number;
    errorMessage?: string;
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      const payload = testPayload || this.createTestPayload();
      const requestConfig = this.buildRequestConfig(webhook, payload);

      // Use shorter timeout for testing
      requestConfig.timeout = Math.min(requestConfig.timeout || 30000, 10000);

      const response = await this.httpClient.request(requestConfig);
      const responseTime = Date.now() - startTime;

      // Analyze response for recommendations
      if (responseTime > 5000) {
        recommendations.push(
          'Response time is slow (>5s). Consider optimizing your webhook endpoint.'
        );
      }

      if (response.status === 200 && !response.data) {
        recommendations.push(
          'Consider returning a response body to confirm successful processing.'
        );
      }

      if (!response.headers['content-type']) {
        recommendations.push(
          'Consider setting a Content-Type header in your response.'
        );
      }

      return {
        success: true,
        responseTime,
        statusCode: response.status,
        recommendations,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Provide specific recommendations based on error type
      if (error.code === 'ECONNREFUSED') {
        recommendations.push(
          'Connection refused. Check if your webhook endpoint is running and accessible.'
        );
      } else if (error.code === 'ENOTFOUND') {
        recommendations.push(
          'DNS resolution failed. Check if the webhook URL is correct.'
        );
      } else if (error.code === 'ECONNABORTED') {
        recommendations.push(
          'Request timed out. Consider increasing timeout or optimizing your endpoint.'
        );
      } else if (error.response?.status === 404) {
        recommendations.push(
          'Endpoint not found. Verify the webhook URL path is correct.'
        );
      } else if (
        error.response?.status === 401 ||
        error.response?.status === 403
      ) {
        recommendations.push(
          'Authentication failed. Check your webhook secret and signature validation.'
        );
      } else if (error.response?.status >= 500) {
        recommendations.push(
          'Server error. Check your webhook endpoint logs for issues.'
        );
      }

      return {
        success: false,
        responseTime,
        statusCode: error.response?.status,
        errorMessage: error.message,
        recommendations,
      };
    }
  }

  private createHttpClient(): AxiosInstance {
    return axios.create({
      timeout: this.config.timeout,
      maxRedirects: this.config.maxRedirects,
      validateStatus: status => status >= 200 && status < 300,
      headers: this.config.defaultHeaders,
      httpsAgent: this.config.validateSSL
        ? undefined
        : new (require('https').Agent)({
            rejectUnauthorized: false,
          }),
    });
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      config => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      error => {
        this.logger.error('Webhook request interceptor error', {
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      response => {
        const duration =
          Date.now() - (response.config.metadata?.startTime || 0);
        this.logger.debug('Webhook response received', {
          url: response.config.url,
          status: response.status,
          duration,
        });
        return response;
      },
      error => {
        const duration = Date.now() - (error.config?.metadata?.startTime || 0);
        this.logger.debug('Webhook response error', {
          url: error.config?.url,
          status: error.response?.status,
          duration,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  private buildRequestConfig(
    webhook: WebhookEntity,
    payload: WebhookPayload | Record<string, any>
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      method: webhook.httpMethod,
      url: webhook.url.value,
      timeout: webhook.timeout,
      headers: {
        ...this.config.defaultHeaders,
        ...webhook.headers,
      },
    };

    // Add signature if secret is provided
    if (webhook.secret) {
      const payloadString = JSON.stringify(payload);
      const signature = webhook.secret.generateSignature(
        payloadString,
        webhook.signatureAlgorithm
      );
      const signatureHeader = webhook.signatureHeader || 'X-Webhook-Signature';
      config.headers![signatureHeader] =
        `${webhook.signatureAlgorithm}=${signature}`;
    }

    // Set content type and prepare data
    if (webhook.contentType === 'application/json') {
      config.data = payload;
      config.headers!['Content-Type'] = 'application/json';
    } else {
      // URL-encoded form data
      const formData = new URLSearchParams();
      formData.append('payload', JSON.stringify(payload));
      config.data = formData.toString();
      config.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return config;
  }

  private async sendWithRetry(
    config: AxiosRequestConfig,
    maxRetries: number
  ): Promise<AxiosResponse> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.httpClient.request(config);
      } catch (error: any) {
        lastError = error;

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
        const totalDelay = delay + jitter;

        this.logger.debug('Retrying webhook request', {
          url: config.url,
          attempt: attempt + 1,
          maxRetries,
          delay: totalDelay,
          error: error.message,
        });

        await this.sleep(totalDelay);
      }
    }

    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Retry on server errors (5xx) and some client errors
    if (status >= 500) {
      return true;
    }

    // Retry on specific client errors
    if ([408, 429].includes(status)) {
      return true;
    }

    return false;
  }

  private truncateResponseBody(data: any): string {
    const maxLength = 1000; // Maximum response body length to store
    let body = '';

    if (typeof data === 'string') {
      body = data;
    } else if (typeof data === 'object') {
      body = JSON.stringify(data);
    } else {
      body = String(data);
    }

    if (body.length > maxLength) {
      return body.substring(0, maxLength) + '... [truncated]';
    }

    return body;
  }

  private sanitizeHeaders(
    headers: Record<string, any>
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
    ];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  private createTestPayload(): WebhookPayload {
    return {
      id: `test-${Date.now()}`,
      event: 'webhook.test' as any,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        test: true,
      },
      metadata: {
        version: '1.0',
        source: 'unified-enterprise-platform',
        deliveryAttempt: 1,
        webhookId: 'test',
        workspaceId: 'test',
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check method
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    try {
      // Test basic HTTP functionality
      const testUrl = 'https://httpbin.org/status/200';
      const startTime = Date.now();

      await this.httpClient.get(testUrl, { timeout: 5000 });

      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        details: {
          responseTime,
          userAgent: this.config.userAgent,
          timeout: this.config.timeout,
          maxRetries: this.config.maxRetries,
          validateSSL: this.config.validateSSL,
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: {
          error: error.message,
          code: error.code,
          config: {
            timeout: this.config.timeout,
            maxRetries: this.config.maxRetries,
            validateSSL: this.config.validateSSL,
          },
        },
      };
    }
  }

  // Configuration methods
  updateConfig(updates: Partial<WebhookHttpConfig>): void {
    this.config = { ...this.config, ...updates };

    // Recreate HTTP client if necessary
    if (
      updates.timeout ||
      updates.maxRedirects ||
      updates.validateSSL ||
      updates.defaultHeaders
    ) {
      this.httpClient = this.createHttpClient();
      this.setupInterceptors();
    }
  }

  getConfig(): WebhookHttpConfig {
    return { ...this.config };
  }
}
