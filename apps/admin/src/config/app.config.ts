import { AppConfig } from '@taskmanagement/config';

export const adminConfig: AppConfig = {
  app: {
    name: 'TaskManagement Admin',
    version: '1.0.0',
    description: 'Admin dashboard for task management system',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    timeout: 30000,
    retries: 3,
  },
  auth: {
    tokenKey: 'admin_auth_token',
    refreshTokenKey: 'admin_refresh_token',
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours for admin sessions
    requireMFA: true,
    adminRoles: ['admin', 'super_admin', 'system_admin'],
  },
  monitoring: {
    prometheus: {
      enabled: true,
      endpoint: process.env.NEXT_PUBLIC_PROMETHEUS_URL || 'http://localhost:9090',
    },
    grafana: {
      enabled: true,
      endpoint: process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3000',
      dashboardIds: {
        system: 'system-overview',
        api: 'api-performance',
        business: 'business-metrics',
      },
    },
    jaeger: {
      enabled: true,
      endpoint: process.env.NEXT_PUBLIC_JAEGER_URL || 'http://localhost:16686',
    },
  },
  features: {
    userManagement: true,
    systemMonitoring: true,
    analytics: true,
    auditLogs: true,
    alertManagement: true,
    configurationManagement: true,
    backupManagement: true,
    securityScanning: true,
  },
  ui: {
    theme: 'admin',
    sidebarCollapsed: false,
    refreshInterval: 30000, // 30 seconds for real-time data
    pagination: {
      defaultPageSize: 25,
      pageSizeOptions: [10, 25, 50, 100],
    },
    charts: {
      defaultColors: [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
      ],
      animationDuration: 750,
    },
  },
  security: {
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    requirePasswordChange: 90 * 24 * 60 * 60 * 1000, // 90 days
    auditAllActions: true,
  },
  notifications: {
    realTime: true,
    websocket: {
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
    },
    toast: {
      position: 'top-right',
      duration: 5000,
      maxVisible: 5,
    },
  },
};