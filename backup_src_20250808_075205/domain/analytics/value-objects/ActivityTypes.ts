export enum ActivityType {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  API_REQUEST = 'api_request',
  BACKGROUND_JOB = 'background_job',
  WEBHOOK_EVENT = 'webhook_event',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_EXPORT = 'data_export',
  DATA_IMPORT = 'data_import',
  NOTIFICATION = 'notification',
  COLLABORATION = 'collaboration',
  FILE_OPERATION = 'file_operation',
  CALENDAR_EVENT = 'calendar_event',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance',
  ERROR = 'error',
}

export interface ActivityMetadata {
  // Performance metrics
  responseTime?: number;
  memoryUsage?: number;
  cpuUsage?: number;

  // Request details
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestSize?: number;
  responseSize?: number;

  // User context
  deviceType?: string;
  browserType?: string;
  operatingSystem?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };

  // Business context
  featureFlag?: string;
  experimentId?: string;
  cohort?: string;

  // Error details
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;

  // Custom fields
  [key: string]: any;
}

export interface ActivityContext {
  // Workspace context
  workspaceName?: string;
  workspaceSize?: 'small' | 'medium' | 'large' | 'enterprise';
  subscriptionTier?: string;

  // Project context
  projectName?: string;
  projectStatus?: string;
  projectMemberCount?: number;

  // Task context
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
  taskType?: string;

  // User context
  userRole?: string;
  userTier?: string;
  userExperience?: 'new' | 'intermediate' | 'advanced' | 'expert';

  // Session context
  sessionDuration?: number;
  actionsInSession?: number;

  // Collaboration context
  collaboratorCount?: number;
  isRealTimeSession?: boolean;

  // Custom context
  [key: string]: any;
}

export class ActivityTypeValidator {
  private static readonly VALID_ACTIONS_BY_TYPE: Record<
    ActivityType,
    string[]
  > = {
    [ActivityType.USER_ACTION]: [
      'login',
      'logout',
      'register',
      'profile_update',
      'password_change',
      'task_create',
      'task_update',
      'task_delete',
      'task_complete',
      'task_assign',
      'project_create',
      'project_update',
      'project_delete',
      'project_archive',
      'comment_add',
      'comment_update',
      'comment_delete',
      'file_upload',
      'file_download',
      'file_delete',
      'workspace_create',
      'workspace_update',
      'workspace_switch',
      'team_create',
      'team_join',
      'team_leave',
      'notification_read',
      'notification_dismiss',
      'search',
      'filter',
      'sort',
      'export',
      'import',
    ],
    [ActivityType.SYSTEM_EVENT]: [
      'user_created',
      'user_deleted',
      'user_suspended',
      'workspace_created',
      'workspace_deleted',
      'workspace_suspended',
      'project_archived',
      'project_restored',
      'task_auto_assigned',
      'task_auto_completed',
      'task_overdue',
      'notification_sent',
      'notification_failed',
      'backup_created',
      'backup_restored',
      'maintenance_started',
      'maintenance_completed',
      'security_scan',
      'compliance_check',
    ],
    [ActivityType.API_REQUEST]: [
      'get_tasks',
      'create_task',
      'update_task',
      'delete_task',
      'get_projects',
      'create_project',
      'update_project',
      'delete_project',
      'get_users',
      'create_user',
      'update_user',
      'delete_user',
      'get_analytics',
      'get_reports',
      'export_data',
      'import_data',
      'webhook_create',
      'webhook_update',
      'webhook_delete',
    ],
    [ActivityType.BACKGROUND_JOB]: [
      'email_send',
      'notification_process',
      'report_generate',
      'data_cleanup',
      'index_rebuild',
      'cache_warm',
      'recurring_task_create',
      'reminder_send',
      'analytics_aggregate',
      'metrics_collect',
      'backup_create',
      'log_archive',
    ],
    [ActivityType.WEBHOOK_EVENT]: [
      'webhook_received',
      'webhook_processed',
      'webhook_failed',
      'webhook_retry',
      'webhook_delivered',
    ],
    [ActivityType.AUTHENTICATION]: [
      'login_attempt',
      'login_success',
      'login_failed',
      'logout',
      'session_expired',
      'token_refresh',
      'mfa_setup',
      'mfa_verify',
      'mfa_failed',
      'password_reset',
      'email_verify',
    ],
    [ActivityType.AUTHORIZATION]: [
      'permission_check',
      'access_granted',
      'access_denied',
      'role_assigned',
      'role_removed',
      'permission_updated',
    ],
    [ActivityType.DATA_EXPORT]: [
      'export_requested',
      'export_started',
      'export_completed',
      'export_failed',
      'gdpr_export',
      'backup_export',
      'analytics_export',
    ],
    [ActivityType.DATA_IMPORT]: [
      'import_requested',
      'import_started',
      'import_completed',
      'import_failed',
      'data_migration',
      'bulk_import',
      'csv_import',
    ],
    [ActivityType.NOTIFICATION]: [
      'notification_created',
      'notification_sent',
      'notification_delivered',
      'notification_failed',
      'notification_read',
      'notification_clicked',
      'email_sent',
      'push_sent',
      'sms_sent',
    ],
    [ActivityType.COLLABORATION]: [
      'comment_added',
      'mention_created',
      'file_shared',
      'real_time_edit',
      'presence_update',
      'typing_indicator',
      'collaboration_started',
      'collaboration_ended',
    ],
    [ActivityType.FILE_OPERATION]: [
      'file_uploaded',
      'file_downloaded',
      'file_deleted',
      'file_shared',
      'file_version_created',
      'file_restored',
      'folder_created',
      'folder_deleted',
      'folder_shared',
    ],
    [ActivityType.CALENDAR_EVENT]: [
      'event_created',
      'event_updated',
      'event_deleted',
      'reminder_sent',
      'sync_started',
      'sync_completed',
      'conflict_detected',
      'conflict_resolved',
    ],
    [ActivityType.INTEGRATION]: [
      'integration_connected',
      'integration_disconnected',
      'sync_started',
      'sync_completed',
      'sync_failed',
      'api_call_made',
      'webhook_received',
    ],
    [ActivityType.PERFORMANCE]: [
      'page_load',
      'api_response',
      'database_query',
      'cache_hit',
      'cache_miss',
      'memory_usage',
      'cpu_usage',
      'disk_usage',
      'network_latency',
    ],
    [ActivityType.ERROR]: [
      'application_error',
      'database_error',
      'network_error',
      'validation_error',
      'authentication_error',
      'authorization_error',
      'rate_limit_exceeded',
      'quota_exceeded',
      'service_unavailable',
    ],
  };

  public static isValidAction(type: ActivityType, action: string): boolean {
    const validActions = this.VALID_ACTIONS_BY_TYPE[type];
    return validActions ? validActions.includes(action) : false;
  }

  public static getValidActions(type: ActivityType): string[] {
    return this.VALID_ACTIONS_BY_TYPE[type] || [];
  }

  public static getAllValidActions(): Record<ActivityType, string[]> {
    return { ...this.VALID_ACTIONS_BY_TYPE };
  }

  public static validateActivityData(
    type: ActivityType,
    action: string,
    metadata?: ActivityMetadata,
    context?: ActivityContext
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate action
    if (!this.isValidAction(type, action)) {
      errors.push(`Invalid action '${action}' for activity type '${type}'`);
    }

    // Validate metadata based on type
    if (metadata) {
      switch (type) {
        case ActivityType.API_REQUEST:
          if (!metadata.endpoint) {
            errors.push(
              'API request activities must include endpoint in metadata'
            );
          }
          if (!metadata.method) {
            errors.push(
              'API request activities must include method in metadata'
            );
          }
          break;
        case ActivityType.PERFORMANCE:
          if (
            metadata.responseTime !== undefined &&
            metadata.responseTime < 0
          ) {
            errors.push('Response time must be non-negative');
          }
          break;
        case ActivityType.ERROR:
          if (!metadata.errorCode && !metadata.errorMessage) {
            errors.push(
              'Error activities must include errorCode or errorMessage in metadata'
            );
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
