export const ADMIN_ROUTES = {
  // Authentication routes
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    MFA_SETUP: '/auth/mfa-setup',
    MFA_VERIFY: '/auth/mfa-verify',
  },

  // Dashboard routes
  DASHBOARD: {
    OVERVIEW: '/dashboard',
    ANALYTICS: '/dashboard/analytics',
    SYSTEM_HEALTH: '/dashboard/system-health',
    QUICK_ACTIONS: '/dashboard/quick-actions',
  },

  // User management routes
  USERS: {
    LIST: '/users',
    CREATE: '/users/create',
    EDIT: '/users/[id]/edit',
    VIEW: '/users/[id]',
    ROLES: '/users/roles',
    PERMISSIONS: '/users/permissions',
    BULK_ACTIONS: '/users/bulk-actions',
    IMPORT: '/users/import',
    EXPORT: '/users/export',
  },

  // System monitoring routes
  MONITORING: {
    OVERVIEW: '/monitoring',
    SYSTEM_HEALTH: '/monitoring/system-health',
    METRICS: '/monitoring/metrics',
    LOGS: '/monitoring/logs',
    TRACES: '/monitoring/traces',
    HEALTH_CHECKS: '/monitoring/health-checks',
    PERFORMANCE: '/monitoring/performance',
    INFRASTRUCTURE: '/monitoring/infrastructure',
    ALERTS: '/monitoring/alerts',
  },

  // Analytics routes
  ANALYTICS: {
    OVERVIEW: '/analytics',
    USER_ENGAGEMENT: '/analytics/user-engagement',
    FEATURE_USAGE: '/analytics/feature-usage',
    PERFORMANCE_METRICS: '/analytics/performance',
    BUSINESS_METRICS: '/analytics/business',
    CUSTOM_REPORTS: '/analytics/reports',
    DATA_EXPORT: '/analytics/export',
  },

  // System settings routes
  SETTINGS: {
    SYSTEM: '/settings',
    GENERAL: '/settings',
    SECURITY: '/settings/security',
    INTEGRATIONS: '/settings/integrations',
    NOTIFICATIONS: '/settings/notifications',
    BACKUP: '/settings/backup',
    MAINTENANCE: '/settings/maintenance',
    FEATURE_FLAGS: '/settings/feature-flags',
    EMAIL_TEMPLATES: '/settings/email-templates',
    API_KEYS: '/settings/api-keys',
    PROFILE: '/settings/profile',
  },

  // Audit and compliance routes
  AUDIT: {
    LOGS: '/audit/logs',
    SECURITY_EVENTS: '/audit/security-events',
    USER_ACTIVITY: '/audit/user-activity',
    SYSTEM_CHANGES: '/audit/system-changes',
    COMPLIANCE_REPORTS: '/audit/compliance',
    DATA_RETENTION: '/audit/data-retention',
  },

  // Alert management routes
  ALERTS: {
    LIST: '/alerts',
    ACTIVE: '/alerts',
    HISTORY: '/alerts/history',
    RULES: '/alerts/rules',
    CHANNELS: '/alerts/channels',
    ESCALATION: '/alerts/escalation',
    TEMPLATES: '/alerts/templates',
  },

  // System administration routes
  SYSTEM: {
    DATABASE: '/system/database',
    CACHE: '/system/cache',
    JOBS: '/system/jobs',
    MIGRATIONS: '/system/migrations',
    BACKUPS: '/system/backups',
    LOGS: '/system/logs',
    CONFIGURATION: '/system/configuration',
  },
} as const;

export const PUBLIC_ROUTES = [
  ADMIN_ROUTES.AUTH.LOGIN,
  ADMIN_ROUTES.AUTH.FORGOT_PASSWORD,
  ADMIN_ROUTES.AUTH.RESET_PASSWORD,
];

export const PROTECTED_ROUTES = [
  ADMIN_ROUTES.DASHBOARD.OVERVIEW,
  ADMIN_ROUTES.USERS.LIST,
  ADMIN_ROUTES.MONITORING.OVERVIEW,
  ADMIN_ROUTES.ANALYTICS.OVERVIEW,
  ADMIN_ROUTES.SETTINGS.GENERAL,
  ADMIN_ROUTES.AUDIT.LOGS,
  ADMIN_ROUTES.ALERTS.ACTIVE,
];

export const ADMIN_ONLY_ROUTES = [
  ADMIN_ROUTES.USERS.ROLES,
  ADMIN_ROUTES.USERS.PERMISSIONS,
  ADMIN_ROUTES.SETTINGS.SECURITY,
  ADMIN_ROUTES.SYSTEM.DATABASE,
  ADMIN_ROUTES.SYSTEM.CONFIGURATION,
];

export type AdminRoute = typeof ADMIN_ROUTES[keyof typeof ADMIN_ROUTES][keyof typeof ADMIN_ROUTES[keyof typeof ADMIN_ROUTES]];