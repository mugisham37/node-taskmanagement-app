import { z } from 'zod';
import { BaseDto, BaseQuerySchema } from './base-dto';

// Notification DTOs
export interface NotificationDto extends BaseDto {
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'unread' | 'read';
  userId: string;
  data?: Record<string, any>;
  readAt?: Date;
  expiresAt?: Date;
  scheduledFor?: Date;
  deliveryChannels: string[];
  metadata?: Record<string, any>;
}

export interface NotificationPreferencesDto {
  userId: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
  sms: boolean;
  categories: Record<string, boolean>;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  frequency: {
    immediate: string[];
    daily: string[];
    weekly: string[];
    never: string[];
  };
}

export interface NotificationStatsDto {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recentActivity: Array<{
    date: string;
    sent: number;
    read: number;
    clicked: number;
  }>;
  deliveryStats: {
    email: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    };
    push: {
      sent: number;
      delivered: number;
      opened: number;
    };
    inApp: {
      sent: number;
      read: number;
    };
    sms: {
      sent: number;
      delivered: number;
    };
  };
}

export interface NotificationTemplateDto extends BaseDto {
  name: string;
  description?: string;
  type: string;
  subject?: string;
  bodyTemplate: string;
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: any;
  }>;
  channels: string[];
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface NotificationCampaignDto extends BaseDto {
  name: string;
  description?: string;
  templateId: string;
  targetAudience: {
    userIds?: string[];
    filters?: Record<string, any>;
    segments?: string[];
  };
  scheduledFor?: Date;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  channels: string[];
  deliveryStats: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    opened?: number;
    clicked?: number;
  };
  metadata?: Record<string, any>;
}

export interface NotificationDeliveryDto extends BaseDto {
  notificationId: string;
  campaignId?: string;
  userId: string;
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

// Validation schemas
export const NotificationQuerySchema = BaseQuerySchema.extend({
  status: z.enum(['read', 'unread', 'all']).default('all'),
  type: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const CreateNotificationSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  type: z.string().default('info'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  targetUserId: z.string().optional(),
  data: z.record(z.any()).optional(),
  scheduledFor: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  channels: z.array(z.string()).default(['inApp']),
  metadata: z.record(z.any()).optional(),
});

export const NotificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  inApp: z.boolean().default(true),
  sms: z.boolean().default(false),
  categories: z.record(z.boolean()).optional(),
  quietHours: z
    .object({
      enabled: z.boolean().default(false),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
  frequency: z
    .object({
      immediate: z.array(z.string()).default([]),
      daily: z.array(z.string()).default([]),
      weekly: z.array(z.string()).default([]),
      never: z.array(z.string()).default([]),
    })
    .optional(),
});

export const NotificationTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.string(),
  subject: z.string().optional(),
  bodyTemplate: z.string().min(1),
  variables: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean(),
        defaultValue: z.any().optional(),
      })
    )
    .default([]),
  channels: z.array(z.string()).min(1),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export const NotificationCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  templateId: z.string(),
  targetAudience: z.object({
    userIds: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    segments: z.array(z.string()).optional(),
  }),
  scheduledFor: z.string().datetime().optional(),
  channels: z.array(z.string()).min(1),
  metadata: z.record(z.any()).optional(),
});

export const TestNotificationSchema = z.object({
  channel: z.enum(['email', 'push', 'sms']),
  message: z.string().optional(),
});

export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;
export type CreateNotificationRequest = z.infer<
  typeof CreateNotificationSchema
>;
export type NotificationPreferencesRequest = z.infer<
  typeof NotificationPreferencesSchema
>;
export type NotificationTemplateRequest = z.infer<
  typeof NotificationTemplateSchema
>;
export type NotificationCampaignRequest = z.infer<
  typeof NotificationCampaignSchema
>;
export type TestNotificationRequest = z.infer<typeof TestNotificationSchema>;
