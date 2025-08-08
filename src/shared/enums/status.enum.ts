export enum EntityStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    PENDING = 'pending'
}

export enum Priority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum TaskStatus {
    TODO = 'todo',
    IN_PROGRESS = 'in_progress',
    REVIEW = 'review',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum ProjectStatus {
    PLANNING = 'planning',
    ACTIVE = 'active',
    ON_HOLD = 'on_hold',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    MEMBER = 'member',
    VIEWER = 'viewer'
}

export enum NotificationType {
    EMAIL = 'email',
    PUSH = 'push',
    SMS = 'sms',
    IN_APP = 'in_app'
}
