import { vi } from 'vitest';
import { MockServiceFactory } from '../utils/test-helpers';

// Authentication service mock
export const mockAuthService = MockServiceFactory.createMockAuthService();

// Task service mock
export const mockTaskService = MockServiceFactory.createMockTaskService();

// Workspace service mock
export const mockWorkspaceService =
  MockServiceFactory.createMockWorkspaceService();

// Notification service mock
export const mockNotificationService =
  MockServiceFactory.createMockNotificationService();

// Database client mock
export const mockPrismaClient = MockServiceFactory.createMockPrismaClient();

// Email service mock
export const mockEmailService = {
  sendEmail: vi.fn().mockResolvedValue(true),
  sendBulkEmail: vi.fn().mockResolvedValue(true),
  validateEmailAddress: vi.fn().mockReturnValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendTaskAssignmentEmail: vi.fn().mockResolvedValue(true),
  sendTaskUpdateEmail: vi.fn().mockResolvedValue(true),
};

// SMS service mock
export const mockSmsService = {
  sendSms: vi.fn().mockResolvedValue(true),
  validatePhoneNumber: vi.fn().mockReturnValue(true),
  sendMfaCode: vi.fn().mockResolvedValue(true),
  sendTaskNotification: vi.fn().mockResolvedValue(true),
};

// File service mock
export const mockFileService = {
  uploadFile: vi.fn().mockResolvedValue({
    url: 'http://example.com/file.jpg',
    key: 'test-key',
    size: 1024,
    mimeType: 'image/jpeg',
  }),
  deleteFile: vi.fn().mockResolvedValue(true),
  getFileUrl: vi.fn().mockReturnValue('http://example.com/file.jpg'),
  getFileMetadata: vi.fn().mockResolvedValue({
    size: 1024,
    mimeType: 'image/jpeg',
    lastModified: new Date(),
  }),
};

// Cache service mock
export const mockCacheService = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
  del: vi.fn().mockResolvedValue(true),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(true),
  flushall: vi.fn().mockResolvedValue(true),
  keys: vi.fn().mockResolvedValue([]),
};

// WebSocket service mock
export const mockWebSocketService = {
  broadcast: vi.fn().mockResolvedValue(true),
  sendToUser: vi.fn().mockResolvedValue(true),
  sendToWorkspace: vi.fn().mockResolvedValue(true),
  sendToProject: vi.fn().mockResolvedValue(true),
  addConnection: vi.fn().mockResolvedValue(true),
  removeConnection: vi.fn().mockResolvedValue(true),
  getConnectedUsers: vi.fn().mockResolvedValue([]),
};

// Analytics service mock
export const mockAnalyticsService = {
  trackEvent: vi.fn().mockResolvedValue(true),
  trackUserActivity: vi.fn().mockResolvedValue(true),
  getTaskMetrics: vi.fn().mockResolvedValue({
    totalTasks: 100,
    completedTasks: 75,
    overdueTasks: 5,
    averageCompletionTime: 3.5,
  }),
  getProjectMetrics: vi.fn().mockResolvedValue({
    totalProjects: 10,
    activeProjects: 7,
    completedProjects: 3,
    averageProjectDuration: 45,
  }),
  getUserProductivity: vi.fn().mockResolvedValue({
    tasksCompleted: 25,
    averageTaskTime: 2.5,
    productivityScore: 85,
  }),
};

// Audit service mock
export const mockAuditService = {
  logActivity: vi.fn().mockResolvedValue(true),
  logSecurityEvent: vi.fn().mockResolvedValue(true),
  getAuditTrail: vi.fn().mockResolvedValue([]),
  generateComplianceReport: vi.fn().mockResolvedValue({
    reportId: 'test-report-id',
    generatedAt: new Date(),
    entries: [],
  }),
};

// Calendar service mock
export const mockCalendarService = {
  createEvent: vi.fn().mockResolvedValue({
    id: 'test-event-id',
    title: 'Test Event',
    startTime: new Date(),
    endTime: new Date(),
  }),
  updateEvent: vi.fn().mockResolvedValue(true),
  deleteEvent: vi.fn().mockResolvedValue(true),
  getEvents: vi.fn().mockResolvedValue([]),
  syncWithExternalCalendar: vi.fn().mockResolvedValue(true),
};

// Export all mocks for easy importing
export const mockServices = {
  auth: mockAuthService,
  task: mockTaskService,
  workspace: mockWorkspaceService,
  notification: mockNotificationService,
  email: mockEmailService,
  sms: mockSmsService,
  file: mockFileService,
  cache: mockCacheService,
  websocket: mockWebSocketService,
  analytics: mockAnalyticsService,
  audit: mockAuditService,
  calendar: mockCalendarService,
  prisma: mockPrismaClient,
};
