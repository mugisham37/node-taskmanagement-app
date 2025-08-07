import { FastifyInstance } from 'fastify';
import { presenceController } from '../../controllers/presence.controller';

export async function presenceRoutes(fastify: FastifyInstance): Promise<void> {
  // Presence management routes
  fastify.put(
    '/status',
    {
      schema: {
        description: 'Update user presence status',
        tags: ['Presence'],
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['online', 'away', 'busy', 'offline'],
              description: 'User presence status',
            },
            workspaceId: {
              type: 'string',
              format: 'uuid',
              description: 'Optional workspace context',
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
                  presence: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      status: { type: 'string' },
                      lastSeen: { type: 'string', format: 'date-time' },
                      workspaceId: { type: 'string' },
                      currentActivity: { type: 'object' },
                      deviceInfo: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    presenceController.updatePresence.bind(presenceController)
  );

  // Activity management routes
  fastify.put(
    '/activity',
    {
      schema: {
        description: 'Update user activity',
        tags: ['Presence'],
        body: {
          type: 'object',
          required: ['type', 'resourceType', 'resourceId'],
          properties: {
            type: {
              type: 'string',
              enum: ['viewing', 'editing', 'commenting'],
              description: 'Type of activity',
            },
            resourceType: {
              type: 'string',
              enum: ['task', 'project', 'workspace'],
              description: 'Type of resource being accessed',
            },
            resourceId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the resource',
            },
            resourceTitle: {
              type: 'string',
              description: 'Optional title of the resource',
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
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.updateActivity.bind(presenceController)
  );

  fastify.delete(
    '/activity',
    {
      schema: {
        description: 'Clear user activity',
        tags: ['Presence'],
        body: {
          type: 'object',
          properties: {
            resourceId: {
              type: 'string',
              format: 'uuid',
              description: 'Optional specific resource to clear activity for',
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
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.clearActivity.bind(presenceController)
  );

  // Typing indicator routes
  fastify.post(
    '/typing/start',
    {
      schema: {
        description: 'Start typing indicator',
        tags: ['Presence'],
        body: {
          type: 'object',
          required: ['resourceType', 'resourceId'],
          properties: {
            resourceType: {
              type: 'string',
              enum: ['task', 'comment'],
              description: 'Type of resource being typed in',
            },
            resourceId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the resource',
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
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.startTyping.bind(presenceController)
  );

  fastify.post(
    '/typing/stop',
    {
      schema: {
        description: 'Stop typing indicator',
        tags: ['Presence'],
        body: {
          type: 'object',
          required: ['resourceId'],
          properties: {
            resourceId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the resource',
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
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.stopTyping.bind(presenceController)
  );

  // Query routes
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get presence information',
        tags: ['Presence'],
        querystring: {
          type: 'object',
          properties: {
            userIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              description: 'Array of user IDs to get presence for',
            },
            workspaceId: {
              type: 'string',
              format: 'uuid',
              description: 'Workspace ID to get all online users for',
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
                  presence: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.getPresence.bind(presenceController)
  );

  fastify.get(
    '/activity',
    {
      schema: {
        description: 'Get activity indicators for a resource',
        tags: ['Presence'],
        querystring: {
          type: 'object',
          required: ['resourceId'],
          properties: {
            resourceId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the resource to get activity for',
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
                  resourceId: { type: 'string' },
                  activities: { type: 'array' },
                  typing: { type: 'array' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.getActivity.bind(presenceController)
  );

  fastify.get(
    '/feed',
    {
      schema: {
        description: 'Get activity feed for a workspace',
        tags: ['Presence'],
        querystring: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: {
              type: 'string',
              format: 'uuid',
              description: 'Workspace ID to get activity feed for',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of activities to return',
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0,
              description: 'Number of activities to skip',
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
                  workspaceId: { type: 'string' },
                  activities: { type: 'array' },
                  pagination: {
                    type: 'object',
                    properties: {
                      limit: { type: 'integer' },
                      offset: { type: 'integer' },
                      total: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    presenceController.getActivityFeed.bind(presenceController)
  );

  fastify.get(
    '/stats',
    {
      schema: {
        description: 'Get presence statistics (admin only)',
        tags: ['Presence'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  presence: { type: 'object' },
                  websocket: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    presenceController.getPresenceStats.bind(presenceController)
  );
}
