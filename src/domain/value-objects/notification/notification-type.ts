import { ValueObject } from '../../../shared/domain/value-object';

export enum NotificationTypeEnum {
  // Task Management
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  TASK_COMPLETED = 'task_completed',
  TASK_COMMENTED = 'task_commented',
  TASK_MENTIONED = 'task_mentioned',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_PRIORITY_CHANGED = 'task_priority_changed',

  // Project Management
  PROJECT_CREATED = 'project_created',
  PROJECT_SHARED = 'project_shared',
  PROJECT_MEMBER_ADDED = 'project_member_added',
  PROJECT_DEADLINE_APPROACHING = 'project_deadline_approaching',

  // Team & Collaboration
  TEAM_INVITATION = 'team_invitation',
  WORKSPACE_INVITATION = 'workspace_invitation',
  MENTION_IN_COMMENT = 'mention_in_comment',
  COMMENT_REPLY = 'comment_reply',

  // Calendar & Reminders
  CALENDAR_REMINDER = 'calendar_reminder',
  MEETING_REMINDER = 'meeting_reminder',
  DEADLINE_REMINDER = 'deadline_reminder',

  // System & Admin
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SECURITY_ALERT = 'security_alert',
  ACCOUNT_VERIFICATION = 'account_verification',
  PASSWORD_RESET = 'password_reset',

  // Analytics & Reports
  WEEKLY_REPORT = 'weekly_report',
  MONTHLY_REPORT = 'monthly_report',
  GOAL_ACHIEVED = 'goal_achieved',
  MILESTONE_REACHED = 'milestone_reached',

  // General
  CUSTOM = 'custom',
  REMINDER = 'reminder',
}

export class NotificationType extends ValueObject<NotificationTypeEnum> {
  private constructor(value: NotificationTypeEnum) {
    super(value);
  }

  public static create(value: string): NotificationType {
    const enumValue = Object.values(NotificationTypeEnum).find(
      type => type === value
    );

    if (!enumValue) {
      throw new Error(`Invalid notification type: ${value}`);
    }

    return new NotificationType(enumValue);
  }

  public static fromEnum(value: NotificationTypeEnum): NotificationType {
    return new NotificationType(value);
  }

  // Predefined types
  public static TASK_ASSIGNED = new NotificationType(
    NotificationTypeEnum.TASK_ASSIGNED
  );
  public static TASK_DUE_SOON = new NotificationType(
    NotificationTypeEnum.TASK_DUE_SOON
  );
  public static TASK_OVERDUE = new NotificationType(
    NotificationTypeEnum.TASK_OVERDUE
  );
  public static TASK_COMPLETED = new NotificationType(
    NotificationTypeEnum.TASK_COMPLETED
  );
  public static TASK_COMMENTED = new NotificationType(
    NotificationTypeEnum.TASK_COMMENTED
  );
  public static TASK_MENTIONED = new NotificationType(
    NotificationTypeEnum.TASK_MENTIONED
  );
  public static PROJECT_SHARED = new NotificationType(
    NotificationTypeEnum.PROJECT_SHARED
  );
  public static TEAM_INVITATION = new NotificationType(
    NotificationTypeEnum.TEAM_INVITATION
  );
  public static WORKSPACE_INVITATION = new NotificationType(
    NotificationTypeEnum.WORKSPACE_INVITATION
  );
  public static CALENDAR_REMINDER = new NotificationType(
    NotificationTypeEnum.CALENDAR_REMINDER
  );
  public static SYSTEM_ANNOUNCEMENT = new NotificationType(
    NotificationTypeEnum.SYSTEM_ANNOUNCEMENT
  );
  public static SECURITY_ALERT = new NotificationType(
    NotificationTypeEnum.SECURITY_ALERT
  );

  public get value(): NotificationTypeEnum {
    return this.props;
  }

  public equals(other: NotificationType): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  // Helper methods
  public isTaskRelated(): boolean {
    return this.value.startsWith('task_');
  }

  public isProjectRelated(): boolean {
    return this.value.startsWith('project_');
  }

  public isSystemRelated(): boolean {
    return (
      this.value.startsWith('system_') ||
      this.value === NotificationTypeEnum.SECURITY_ALERT
    );
  }

  public isUrgent(): boolean {
    return [
      NotificationTypeEnum.TASK_OVERDUE,
      NotificationTypeEnum.SECURITY_ALERT,
      NotificationTypeEnum.SYSTEM_MAINTENANCE,
    ].includes(this.value);
  }

  public getCategory(): string {
    if (this.isTaskRelated()) return 'task';
    if (this.isProjectRelated()) return 'project';
    if (this.isSystemRelated()) return 'system';
    if (this.value.includes('calendar') || this.value.includes('reminder'))
      return 'calendar';
    if (this.value.includes('team') || this.value.includes('workspace'))
      return 'collaboration';
    return 'general';
  }
}
