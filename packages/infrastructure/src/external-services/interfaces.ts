/**
 * External service interfaces and types
 */

/**
 * Base external service interface
 */
export interface ExternalService {
  readonly name: string;
  isHealthy(): Promise<boolean>;
  getHealthStatus(): Promise<Record<string, any>>;
}

/**
 * Email service interface
 */
export interface EmailService extends ExternalService {
  sendEmail(data: SendEmailData): Promise<boolean>;
  queueEmail(data: SendEmailData, scheduledAt?: Date): Promise<string>;
  sendTaskAssignmentEmail(
    assigneeEmail: string,
    data: TaskAssignmentTemplateData
  ): Promise<boolean>;
  sendTaskReminderEmail(
    recipientEmail: string,
    data: TaskReminderTemplateData
  ): Promise<boolean>;
  sendUserActivationEmail(
    userEmail: string,
    data: UserActivationTemplateData
  ): Promise<boolean>;
  sendWorkspaceInvitation(data: WorkspaceInvitationData): Promise<boolean>;
  sendTwoFactorCode(
    email: string,
    code: string,
    expirationMinutes?: number
  ): Promise<void>;
}

/**
 * Email data interfaces
 */
export interface SendEmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: any[];
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
  metadata?: Record<string, any>;
  templateId?: string;
}

export interface TaskAssignmentTemplateData {
  assigneeName: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  assignedByName: string;
  dueDate?: Date;
}

export interface TaskReminderTemplateData {
  recipientName: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  creatorName: string;
  dueDate?: Date;
}

export interface UserActivationTemplateData {
  userName: string;
  activationLink?: string;
}

export interface WorkspaceInvitationData {
  recipientEmail: string;
  workspaceName: string;
  inviterName: string;
  invitationLink: string;
}

/**
 * WebSocket service interface
 */
export interface WebSocketService extends ExternalService {
  addConnection(connection: WebSocketConnection): void;
  removeConnection(connectionId: string): void;
  subscribeToChannel(connectionId: string, channel: string): boolean;
  unsubscribeFromChannel(connectionId: string, channel: string): boolean;
  sendToConnection(connectionId: string, message: WebSocketMessage): boolean;
  sendToUser(userId: string, message: WebSocketMessage): number;
  broadcastToChannel(channel: string, message: WebSocketMessage): number;
  broadcastToAll(message: WebSocketMessage): number;
  updatePresence(userId: string, presence: Partial<PresenceInfo>): void;
  getPresence(userId: string): PresenceInfo | null;
  isUserOnline(userId: string): boolean;
  getConnectionStats(): ConnectionStats;
}

export interface WebSocketConnection {
  id: string;
  userId: string;
  userEmail: string;
  socket: any;
  subscriptions: Set<string>;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  messageId: string;
  userId?: string;
  channel?: string;
}

export interface PresenceInfo {
  userId: string;
  userEmail: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentWorkspace?: string;
  currentProject?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  uniqueUsers: number;
  channels: number;
  averageSubscriptionsPerConnection: number;
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getStats(): CircuitBreakerStats;
  reset(): void;
  forceOpen(): void;
  forceClose(): void;
}

export interface CircuitBreakerStats {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
  failureRate: number;
  uptime: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  onStateChange?: (state: string) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

/**
 * Notification service interface
 */
export interface NotificationService extends ExternalService {
  sendNotification(data: NotificationData): Promise<boolean>;
  sendBulkNotifications(notifications: NotificationData[]): Promise<number>;
  scheduleNotification(
    data: NotificationData,
    scheduledAt: Date
  ): Promise<string>;
  cancelNotification(notificationId: string): Promise<boolean>;
}

export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export type NotificationChannel = 'email' | 'push' | 'sms' | 'websocket';

/**
 * SMS service interface
 */
export interface SMSService extends ExternalService {
  sendSMS(phoneNumber: string, message: string): Promise<boolean>;
  sendBulkSMS(
    phoneNumbers: string[],
    message: string
  ): Promise<{ sent: number; failed: number }>;
  sendTwoFactorCode(
    phoneNumber: string,
    code: string,
    expirationMinutes?: number
  ): Promise<void>;
}

/**
 * File storage service interface
 */
export interface FileStorageService extends ExternalService {
  uploadFile(
    key: string,
    data: Buffer | string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<boolean>;
  getFileUrl(key: string, expiresIn?: number): Promise<string>;
  listFiles(prefix?: string): Promise<FileInfo[]>;
}

export interface FileUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write';
}

export interface FileUploadResult {
  key: string;
  url: string;
  size: number;
  etag?: string;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  contentType?: string;
}

/**
 * Push notification service interface
 */
export interface PushNotificationService extends ExternalService {
  sendPushNotification(data: PushNotificationData): Promise<boolean>;
  sendBulkPushNotifications(
    notifications: PushNotificationData[]
  ): Promise<number>;
  subscribeToTopic(token: string, topic: string): Promise<boolean>;
  unsubscribeFromTopic(token: string, topic: string): Promise<boolean>;
}

export interface PushNotificationData {
  token?: string;
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  badge?: number;
  sound?: string;
}

/**
 * Real-time collaboration service interface
 */
export interface CollaborationService extends ExternalService {
  joinRoom(userId: string, roomId: string): Promise<boolean>;
  leaveRoom(userId: string, roomId: string): Promise<boolean>;
  broadcastToRoom(roomId: string, event: CollaborationEvent): Promise<number>;
  getRoomParticipants(roomId: string): Promise<string[]>;
  syncDocument(
    documentId: string,
    operations: DocumentOperation[]
  ): Promise<boolean>;
}

export interface CollaborationEvent {
  type: string;
  userId: string;
  data: any;
  timestamp: Date;
}

export interface DocumentOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
}