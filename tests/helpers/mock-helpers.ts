import { vi } from 'vitest';

export class MockHelpers {
  static createMockRepository<T>() {
    return {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByProjectId: vi.fn(),
      findByAssigneeId: vi.fn(),
      findByCreatorId: vi.fn(),
      findByStatus: vi.fn(),
      findByWorkspaceId: vi.fn(),
      findOverdueTasks: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      count: vi.fn(),
    };
  }

  static createMockService<T>() {
    return {
      execute: vi.fn(),
      validate: vi.fn(),
      process: vi.fn(),
      canAssignTask: vi.fn(),
      canDeleteTask: vi.fn(),
      calculateTaskPriority: vi.fn(),
      validateTaskDependencies: vi.fn(),
      getTaskWorkload: vi.fn(),
    };
  }

  static createMockEventBus() {
    return {
      publish: vi.fn(),
      publishAsync: vi.fn(),
      publishSync: vi.fn(),
      subscribe: vi.fn(),
      subscribeToPattern: vi.fn(),
      unsubscribe: vi.fn(),
    };
  }

  static createMockLogger() {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
  }

  static createMockTransactionManager() {
    return {
      executeInTransaction: vi
        .fn()
        .mockImplementation(async (callback: Function) => {
          return await callback();
        }),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    };
  }

  static createMockCacheService() {
    return {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      exists: vi.fn(),
      ttl: vi.fn(),
      expire: vi.fn(),
    };
  }

  static createMockEmailService() {
    return {
      sendEmail: vi.fn(),
      sendTaskAssignmentEmail: vi.fn(),
      sendTaskCompletionEmail: vi.fn(),
      sendProjectInvitationEmail: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
      validateEmailAddress: vi.fn(),
    };
  }

  static createMockNotificationService() {
    return {
      sendNotification: vi.fn(),
      createNotification: vi.fn(),
      markAsRead: vi.fn(),
      getUnreadCount: vi.fn(),
      getUserNotifications: vi.fn(),
    };
  }

  static createMockWebSocketService() {
    return {
      broadcast: vi.fn(),
      sendToUser: vi.fn(),
      sendToRoom: vi.fn(),
      joinRoom: vi.fn(),
      leaveRoom: vi.fn(),
      isConnected: vi.fn(),
    };
  }

  static createMockMetricsService() {
    return {
      incrementCounter: vi.fn(),
      recordHistogram: vi.fn(),
      recordGauge: vi.fn(),
      recordTimer: vi.fn(),
      getMetrics: vi.fn(),
    };
  }

  static createMockHealthService() {
    return {
      checkHealth: vi.fn(),
      getDatabaseHealth: vi.fn(),
      getCacheHealth: vi.fn(),
      getExternalServiceHealth: vi.fn(),
      getOverallHealth: vi.fn(),
    };
  }

  static createMockAuthService() {
    return {
      authenticate: vi.fn(),
      authorize: vi.fn(),
      generateToken: vi.fn(),
      validateToken: vi.fn(),
      refreshToken: vi.fn(),
      revokeToken: vi.fn(),
      hashPassword: vi.fn(),
      verifyPassword: vi.fn(),
    };
  }

  static createMockValidationService() {
    return {
      validate: vi.fn(),
      validateEmail: vi.fn(),
      validatePassword: vi.fn(),
      validateRequired: vi.fn(),
      validateLength: vi.fn(),
      validateFormat: vi.fn(),
      sanitizeInput: vi.fn(),
    };
  }

  static createMockFileService() {
    return {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      deleteFile: vi.fn(),
      getFileInfo: vi.fn(),
      validateFile: vi.fn(),
      generatePresignedUrl: vi.fn(),
    };
  }

  static createMockSearchService() {
    return {
      search: vi.fn(),
      indexDocument: vi.fn(),
      updateDocument: vi.fn(),
      deleteDocument: vi.fn(),
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
    };
  }

  static createMockAuditService() {
    return {
      logEvent: vi.fn(),
      logUserAction: vi.fn(),
      logSystemEvent: vi.fn(),
      logSecurityEvent: vi.fn(),
      getAuditLogs: vi.fn(),
      searchAuditLogs: vi.fn(),
    };
  }

  static createMockRateLimitService() {
    return {
      checkLimit: vi.fn(),
      incrementCounter: vi.fn(),
      resetCounter: vi.fn(),
      getRemaining: vi.fn(),
      getResetTime: vi.fn(),
    };
  }

  static createMockEncryptionService() {
    return {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      hash: vi.fn(),
      verify: vi.fn(),
      generateKey: vi.fn(),
      generateSalt: vi.fn(),
    };
  }

  static createMockBackupService() {
    return {
      createBackup: vi.fn(),
      restoreBackup: vi.fn(),
      listBackups: vi.fn(),
      deleteBackup: vi.fn(),
      validateBackup: vi.fn(),
      scheduleBackup: vi.fn(),
    };
  }

  static resetAllMocks() {
    vi.clearAllMocks();
  }

  static mockImplementation<T>(mockFn: any, implementation: T) {
    mockFn.mockImplementation(implementation);
    return mockFn;
  }

  static mockResolvedValue<T>(mockFn: any, value: T) {
    mockFn.mockResolvedValue(value);
    return mockFn;
  }

  static mockRejectedValue(mockFn: any, error: Error) {
    mockFn.mockRejectedValue(error);
    return mockFn;
  }

  static mockReturnValue<T>(mockFn: any, value: T) {
    mockFn.mockReturnValue(value);
    return mockFn;
  }

  static expectCalled(mockFn: any, times?: number) {
    if (times !== undefined) {
      expect(mockFn).toHaveBeenCalledTimes(times);
    } else {
      expect(mockFn).toHaveBeenCalled();
    }
  }

  static expectCalledWith(mockFn: any, ...args: any[]) {
    expect(mockFn).toHaveBeenCalledWith(...args);
  }

  static expectNotCalled(mockFn: any) {
    expect(mockFn).not.toHaveBeenCalled();
  }
}
