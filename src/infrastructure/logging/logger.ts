export interface LogContext {
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
}

export class ConsoleLogger implements Logger {
  debug(message: string, context?: LogContext): void {
    console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '');
  }

  info(message: string, context?: LogContext): void {
    console.info(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  }

  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  }

  error(message: string, context?: LogContext): void {
    console.error(`[ERROR] ${message}`, context ? JSON.stringify(context) : '');
  }

  fatal(message: string, context?: LogContext): void {
    console.error(`[FATAL] ${message}`, context ? JSON.stringify(context) : '');
  }
}
