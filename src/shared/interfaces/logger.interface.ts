export interface ILogger {
    info(message: string, meta?: any): void;
    error(message: string, error?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    trace(message: string, meta?: any): void;
}
