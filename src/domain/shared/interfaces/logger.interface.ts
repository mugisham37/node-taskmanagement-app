export interface LogContext {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  operation?: string;
  [key: string]: any;
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;

  createChildLogger(context: LogContext): ILogger;
}
