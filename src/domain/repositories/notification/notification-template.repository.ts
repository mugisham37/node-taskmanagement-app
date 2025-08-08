import { NotificationTemplateEntity } from '../entities/notification-template.entity';
import { NotificationTemplateId } from '../value-objects/notification-template-id';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationChannel } from '../value-objects/notification-channel';

export interface NotificationTemplateFilters {
  name?: string;
  type?: NotificationType;
  types?: NotificationType[];
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  isActive?: boolean;
  version?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface NotificationTemplateSortOptions {
  field: 'name' | 'type' | 'channel' | 'version' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

export interface NotificationTemplatePaginationOptions {
  page: number;
  limit: number;
  sort?: NotificationTemplateSortOptions;
}

export interface NotificationTemplateRepository {
  // Basic CRUD operations
  save(template: NotificationTemplateEntity): Promise<void>;
  findById(
    id: NotificationTemplateId
  ): Promise<NotificationTemplateEntity | null>;
  findMany(
    filters: NotificationTemplateFilters,
    pagination?: NotificationTemplatePaginationOptions
  ): Promise<{
    templates: NotificationTemplateEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  update(template: NotificationTemplateEntity): Promise<void>;
  delete(id: NotificationTemplateId): Promise<void>;

  // Specialized queries
  findByTypeAndChannel(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity | null>;

  findActiveByTypeAndChannel(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity | null>;

  findByType(type: NotificationType): Promise<NotificationTemplateEntity[]>;
  findByChannel(
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity[]>;
  findActiveTemplates(): Promise<NotificationTemplateEntity[]>;

  // Template management
  findLatestVersionByTypeAndChannel(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity | null>;

  findAllVersionsByTypeAndChannel(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<NotificationTemplateEntity[]>;

  // Bulk operations
  deactivateAllByType(type: NotificationType): Promise<number>;
  deactivateAllByChannel(channel: NotificationChannel): Promise<number>;
  deleteInactiveTemplates(inactiveSince: Date): Promise<number>;

  // Validation
  existsByName(name: string): Promise<boolean>;
  existsByTypeAndChannel(
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<boolean>;
}
