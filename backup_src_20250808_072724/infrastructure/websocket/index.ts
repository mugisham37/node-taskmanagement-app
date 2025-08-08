// WebSocket Infrastructure Exports
export { WebSocketServer } from './websocket-server';
export { WebSocketConnection } from './websocket-connection';
export { WebSocketConnectionManager } from './websocket-connection-manager';
export { WebSocketAuthenticator } from './websocket-authenticator';
export { WebSocketMessageHandler } from './websocket-message-handler';
export { WebSocketHealthMonitor } from './websocket-health-monitor';
export { WebSocketMetrics } from './websocket-metrics';
export { EventBroadcaster } from './event-broadcaster';
export { EventAggregator } from './event-aggregator';
export { CollaborativeEditor } from './collaborative-editor';
export { VersionControl } from './version-control';
export { PresenceTracker } from './presence-tracker';

// Type exports
export type {
  WebSocketUser,
  WebSocketMessage,
  WebSocketConnectionMetadata,
} from './websocket-connection';
export type {
  ConnectionInfo,
  WebSocketServerConfig,
} from './websocket-connection-manager';
export type { AuthenticationResult } from './websocket-authenticator';
export type { MessageHandler } from './websocket-message-handler';
export type { HealthStatus } from './websocket-health-monitor';
export type { WebSocketMetricsData } from './websocket-metrics';
export type {
  BroadcastEvent,
  EventFilter,
  BroadcastResult,
} from './event-broadcaster';
export type { AggregatedEvent, AggregationRule } from './event-aggregator';
export type {
  EditOperation,
  DocumentState,
  CursorPosition,
  ConflictResolution,
} from './collaborative-editor';
export type {
  DocumentVersion,
  VersionBranch,
  VersionDiff,
  UndoRedoState,
} from './version-control';
export type {
  UserPresence,
  ActivityEvent,
  TypingIndicator,
  ActivityFeed,
} from './presence-tracker';
