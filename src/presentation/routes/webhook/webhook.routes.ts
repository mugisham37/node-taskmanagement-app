import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { WebhookController } from '../controllers/webhook.controller';

export async function webhookRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  const webhookController =
    fastify.container.resolve<WebhookController>('WebhookController');

  // Webhook Management Routes
  fastify.post(
    '/workspaces/:workspaceId/webhooks',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Create a new webhook',
        description: 'Create a new webhook for the specified workspace',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['workspaceId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Webhook name' },
            url: { type: 'string', format: 'uri', description: 'Webhook URL' },
            events: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of events to subscribe to',
            },
            secret: {
              type: 'string',
              description: 'Webhook secret for signature verification',
            },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Custom headers to send with webhook requests',
            },
            httpMethod: {
              type: 'string',
              enum: ['POST', 'PUT', 'PATCH'],
              default: 'POST',
              description: 'HTTP method to use for webhook requests',
            },
            contentType: {
              type: 'string',
              enum: ['application/json', 'application/x-www-form-urlencoded'],
              default: 'application/json',
              description: 'Content type for webhook requests',
            },
            signatureHeader: {
              type: 'string',
              description: 'Header name for webhook signature',
            },
            signatureAlgorithm: {
              type: 'string',
              enum: ['sha256', 'sha1', 'md5'],
              default: 'sha256',
              description: 'Algorithm for webhook signature',
            },
            timeout: {
              type: 'integer',
              minimum: 1000,
              maximum: 60000,
              default: 30000,
              description: 'Request timeout in milliseconds',
            },
            maxRetries: {
              type: 'integer',
              minimum: 0,
              maximum: 10,
              default: 3,
              description: 'Maximum number of retry attempts',
            },
            retryDelay: {
              type: 'integer',
              minimum: 100,
              maximum: 60000,
              default: 1000,
              description: 'Delay between retry attempts in milliseconds',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata for the webhook',
            },
          },
          required: ['name', 'url', 'events'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  url: { type: 'string' },
                  status: { type: 'string' },
                  events: { type: 'array', items: { type: 'string' } },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.createWebhook.bind(webhookController)
  );

  fastify.get(
    '/workspaces/:workspaceId/webhooks',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Get webhooks for workspace',
        description: 'Retrieve all webhooks for the specified workspace',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['workspaceId'],
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'FAILED'],
            },
            event: { type: 'string', description: 'Filter by event type' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    url: { type: 'string' },
                    status: { type: 'string' },
                    events: { type: 'array', items: { type: 'string' } },
                    deliveryRate: { type: 'number' },
                    lastDeliveryAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.getWebhooks.bind(webhookController)
  );

  fastify.get(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Get webhook details',
        description: 'Retrieve detailed information about a specific webhook',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  url: { type: 'string' },
                  status: { type: 'string' },
                  events: { type: 'array', items: { type: 'string' } },
                  headers: { type: 'object' },
                  httpMethod: { type: 'string' },
                  contentType: { type: 'string' },
                  timeout: { type: 'integer' },
                  maxRetries: { type: 'integer' },
                  successCount: { type: 'integer' },
                  failureCount: { type: 'integer' },
                  deliveryRate: { type: 'number' },
                  lastDeliveryAt: { type: 'string', format: 'date-time' },
                  lastDeliveryStatus: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.getWebhook.bind(webhookController)
  );

  fastify.put(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Update webhook',
        description: 'Update an existing webhook configuration',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            secret: { type: 'string' },
            headers: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            httpMethod: { type: 'string', enum: ['POST', 'PUT', 'PATCH'] },
            contentType: {
              type: 'string',
              enum: ['application/json', 'application/x-www-form-urlencoded'],
            },
            signatureHeader: { type: 'string' },
            signatureAlgorithm: {
              type: 'string',
              enum: ['sha256', 'sha1', 'md5'],
            },
            timeout: { type: 'integer', minimum: 1000, maximum: 60000 },
            maxRetries: { type: 'integer', minimum: 0, maximum: 10 },
            retryDelay: { type: 'integer', minimum: 100, maximum: 60000 },
            metadata: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  url: { type: 'string' },
                  status: { type: 'string' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.updateWebhook.bind(webhookController)
  );

  fastify.delete(
    '/workspaces/:workspaceId/webhooks/:webhookId',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Delete webhook',
        description: 'Delete an existing webhook',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Webhook deleted successfully',
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.deleteWebhook.bind(webhookController)
  );

  // Webhook Testing and Debugging Routes
  fastify.post(
    '/workspaces/:workspaceId/webhooks/:webhookId/test',
    {
      schema: {
        tags: ['Webhooks', 'Testing'],
        summary: 'Test webhook',
        description: 'Send a test payload to the webhook endpoint',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        body: {
          type: 'object',
          properties: {
            payload: {
              type: 'object',
              description: 'Custom test payload (optional)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  httpStatusCode: { type: 'integer' },
                  responseTime: { type: 'integer' },
                  responseBody: { type: 'string' },
                  errorMessage: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.testWebhook.bind(webhookController)
  );

  fastify.get(
    '/workspaces/:workspaceId/webhooks/:webhookId/validate',
    {
      schema: {
        tags: ['Webhooks', 'Validation'],
        summary: 'Validate webhook configuration',
        description: 'Validate the webhook configuration and endpoint',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  isValid: { type: 'boolean' },
                  errors: { type: 'array', items: { type: 'string' } },
                  warnings: { type: 'array', items: { type: 'string' } },
                  recommendations: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.validateWebhook.bind(webhookController)
  );

  // Webhook Analytics Routes
  fastify.get(
    '/workspaces/:workspaceId/webhooks/:webhookId/stats',
    {
      schema: {
        tags: ['Webhooks', 'Analytics'],
        summary: 'Get webhook statistics',
        description: 'Retrieve delivery statistics for a specific webhook',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        querystring: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              format: 'date-time',
              description: 'Start date for statistics',
            },
            to: {
              type: 'string',
              format: 'date-time',
              description: 'End date for statistics',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalDeliveries: { type: 'integer' },
                  successfulDeliveries: { type: 'integer' },
                  failedDeliveries: { type: 'integer' },
                  successRate: { type: 'number' },
                  averageResponseTime: { type: 'number' },
                  lastDeliveryAt: { type: 'string', format: 'date-time' },
                  healthStatus: {
                    type: 'string',
                    enum: ['healthy', 'degraded', 'unhealthy'],
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.getWebhookStats.bind(webhookController)
  );

  fastify.get(
    '/workspaces/:workspaceId/webhooks/stats',
    {
      schema: {
        tags: ['Webhooks', 'Analytics'],
        summary: 'Get workspace webhook statistics',
        description: 'Retrieve overall webhook statistics for a workspace',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
          },
          required: ['workspaceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalWebhooks: { type: 'integer' },
                  activeWebhooks: { type: 'integer' },
                  totalDeliveries: { type: 'integer' },
                  overallSuccessRate: { type: 'number' },
                  webhooksByEvent: { type: 'object' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.getWorkspaceWebhookStats.bind(webhookController)
  );

  // Webhook Delivery Routes
  fastify.get(
    '/workspaces/:workspaceId/webhooks/:webhookId/deliveries',
    {
      schema: {
        tags: ['Webhooks', 'Deliveries'],
        summary: 'Get webhook deliveries',
        description: 'Retrieve delivery history for a specific webhook',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: {
              type: 'string',
              enum: ['PENDING', 'DELIVERED', 'FAILED', 'CANCELLED'],
            },
            sortBy: {
              type: 'string',
              enum: ['createdAt', 'deliveredAt', 'attemptCount', 'duration'],
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    event: { type: 'string' },
                    status: { type: 'string' },
                    httpStatusCode: { type: 'integer' },
                    attemptCount: { type: 'integer' },
                    duration: { type: 'integer' },
                    deliveredAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.getWebhookDeliveries.bind(webhookController)
  );

  fastify.post(
    '/workspaces/:workspaceId/webhooks/:webhookId/deliveries/:deliveryId/retry',
    {
      schema: {
        tags: ['Webhooks', 'Deliveries'],
        summary: 'Retry webhook delivery',
        description: 'Retry a failed webhook delivery',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
            deliveryId: { type: 'string', description: 'Delivery ID' },
          },
          required: ['workspaceId', 'webhookId', 'deliveryId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  deliveryId: { type: 'string' },
                  httpStatusCode: { type: 'integer' },
                  duration: { type: 'integer' },
                  willRetry: { type: 'boolean' },
                  nextRetryAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.retryWebhookDelivery.bind(webhookController)
  );

  // Webhook Configuration Routes
  fastify.get(
    '/webhooks/events',
    {
      schema: {
        tags: ['Webhooks', 'Configuration'],
        summary: 'Get supported webhook events',
        description: 'Retrieve list of all supported webhook events',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  events: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        value: { type: 'string' },
                        category: { type: 'string' },
                        action: { type: 'string' },
                      },
                    },
                  },
                  eventsByCategory: { type: 'object' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.getSupportedEvents.bind(webhookController)
  );

  fastify.post(
    '/webhooks/secret/generate',
    {
      schema: {
        tags: ['Webhooks', 'Security'],
        summary: 'Generate webhook secret',
        description: 'Generate a new webhook secret for signature verification',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  secret: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.generateWebhookSecret.bind(webhookController)
  );

  fastify.post(
    '/workspaces/:workspaceId/webhooks/:webhookId/secret/rotate',
    {
      schema: {
        tags: ['Webhooks', 'Security'],
        summary: 'Rotate webhook secret',
        description: 'Generate a new secret for an existing webhook',
        params: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            webhookId: { type: 'string', description: 'Webhook ID' },
          },
          required: ['workspaceId', 'webhookId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  secret: { type: 'string' },
                  webhook: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [fastify.authenticate],
    },
    webhookController.rotateWebhookSecret.bind(webhookController)
  );
}
