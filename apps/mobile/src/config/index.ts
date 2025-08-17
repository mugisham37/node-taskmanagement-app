import Constants from 'expo-constants';

// Environment configuration
export const config = {
  // API Configuration
  api: {
    baseUrl: Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  // WebSocket Configuration
  websocket: {
    url: Constants.expoConfig?.extra?.websocketUrl || 'ws://localhost:3000',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  },

  // Authentication Configuration
  auth: {
    tokenStorageKey: 'auth_token',
    refreshTokenStorageKey: 'refresh_token',
    biometricStorageKey: 'biometric_enabled',
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
  },

  // Offline Configuration
  offline: {
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    syncInterval: 5 * 60 * 1000, // 5 minutes
    maxRetryAttempts: 5,
  },

  // Notification Configuration
  notifications: {
    channelId: 'taskmanagement-notifications',
    channelName: 'Task Management',
    channelDescription: 'Notifications for task updates and reminders',
  },

  // Feature Flags
  features: {
    biometricAuth: true,
    offlineMode: true,
    pushNotifications: true,
    cameraIntegration: true,
    locationServices: false,
    analytics: true,
  },

  // App Configuration
  app: {
    name: 'Task Management',
    version: Constants.expoConfig?.version || '1.0.0',
    buildNumber: Constants.expoConfig?.ios?.buildNumber || '1',
    environment: Constants.expoConfig?.extra?.environment || 'development',
  },

  // Storage Configuration
  storage: {
    encryptionKey: 'taskmanagement_encryption_key',
    maxStorageSize: 100 * 1024 * 1024, // 100MB
  },

  // Performance Configuration
  performance: {
    enableHermes: true,
    enableFlipper: __DEV__,
    enableReduxDevTools: __DEV__,
  },
};

export default config;