import { NotificationTemplateEntity } from '../entities/notification-template.entity';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';
import { DomainService } from '../../shared/base/domain-service';

export interface TemplateRenderContext {
  variables: Record<string, any>;
  locale?: string;
  timezone?: string;
  userPreferences?: Record<string, any>;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
  metadata: Record<string, any>;
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingVariables: string[];
  unusedVariables: string[];
}

export interface NotificationTemplateService extends DomainService {
  // Template rendering
  renderTemplate(
    type: NotificationType,
    channel: NotificationChannel,
    context: TemplateRenderContext
  ): Promise<RenderedTemplate>;

  renderTemplateById(
    templateId: string,
    context: TemplateRenderContext
  ): Promise<RenderedTemplate>;

  // Template management
  createTemplate(
    name: string,
    type: NotificationType,
    channel: NotificationChannel,
    subject: string,
    bodyTemplate: string,
    variables?: string[],
    metadata?: Record<string, any>
  ): Promise<NotificationTemplateEntity>;

  updateTemplate(
    templateId: string,
    subject: string,
    bodyTemplate: string,
    variables?: string[]
  ): Promise<NotificationTemplateEntity>;

  activateTemplate(templateId: string): Promise<void>;
  deactivateTemplate(templateId: string): Promise<void>;
  deleteTemplate(templateId: string): Promise<void>;

  // Template discovery
  getActiveTemplate(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity | null>;

  getTemplatesByType(
    type: NotificationType
  ): Promise<NotificationTemplateEntity[]>;
  getTemplatesByChannel(
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity[]>;
  getAllActiveTemplates(): Promise<NotificationTemplateEntity[]>;

  // Template validation
  validateTemplate(
    subject: string,
    bodyTemplate: string,
    variables: string[],
    testContext?: TemplateRenderContext
  ): Promise<TemplateValidationResult>;

  validateTemplateById(
    templateId: string,
    testContext?: TemplateRenderContext
  ): Promise<TemplateValidationResult>;

  // Template versioning
  createTemplateVersion(
    templateId: string,
    subject: string,
    bodyTemplate: string,
    variables?: string[]
  ): Promise<NotificationTemplateEntity>;

  getTemplateVersions(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity[]>;

  rollbackToVersion(
    templateId: string,
    version: number
  ): Promise<NotificationTemplateEntity>;

  // Template analytics
  getTemplateUsageStats(
    templateId?: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalUsage: number;
    successfulRenders: number;
    failedRenders: number;
    renderRate: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    popularVariables: Record<string, number>;
  }>;

  // Bulk operations
  importTemplates(
    templates: Array<{
      name: string;
      type: NotificationType;
      channel: NotificationChannel;
      subject: string;
      bodyTemplate: string;
      variables?: string[];
      metadata?: Record<string, any>;
    }>
  ): Promise<NotificationTemplateEntity[]>;

  exportTemplates(filters?: {
    type?: NotificationType;
    channel?: NotificationChannel;
    isActive?: boolean;
  }): Promise<
    Array<{
      name: string;
      type: string;
      channel: string;
      subject: string;
      bodyTemplate: string;
      variables: string[];
      metadata: Record<string, any>;
    }>
  >;

  // Template optimization
  optimizeTemplate(templateId: string): Promise<{
    optimized: boolean;
    changes: string[];
    performance: {
      renderTimeBefore: number;
      renderTimeAfter: number;
      improvement: number;
    };
  }>;

  // Default templates
  createDefaultTemplates(): Promise<NotificationTemplateEntity[]>;
  resetToDefaultTemplates(type?: NotificationType): Promise<void>;
}
