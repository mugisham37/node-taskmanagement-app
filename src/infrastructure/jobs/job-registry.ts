import { Logger } from '../monitoring/logging-service';
import { JobHandler } from './job-types';

export class JobRegistry {
  private handlers = new Map<string, JobHandler>();

  constructor(private logger: Logger) {}

  /**
   * Register a job handler
   */
  register(handler: JobHandler): void {
    if (this.handlers.has(handler.name)) {
      this.logger.warn('Overwriting existing job handler', {
        handlerName: handler.name,
      });
    }

    this.handlers.set(handler.name, handler);

    this.logger.debug('Job handler registered', {
      handlerName: handler.name,
      totalHandlers: this.handlers.size,
    });
  }

  /**
   * Unregister a job handler
   */
  unregister(name: string): boolean {
    const removed = this.handlers.delete(name);

    if (removed) {
      this.logger.debug('Job handler unregistered', {
        handlerName: name,
        totalHandlers: this.handlers.size,
      });
    } else {
      this.logger.warn('Attempted to unregister non-existent handler', {
        handlerName: name,
      });
    }

    return removed;
  }

  /**
   * Get a job handler
   */
  getHandler(name: string): JobHandler | null {
    return this.handlers.get(name) || null;
  }

  /**
   * Check if handler exists
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Get all registered handler names
   */
  getHandlerNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get all handlers
   */
  getAllHandlers(): JobHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalHandlers: number;
    handlerNames: string[];
  } {
    return {
      totalHandlers: this.handlers.size,
      handlerNames: this.getHandlerNames(),
    };
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    const count = this.handlers.size;
    this.handlers.clear();

    this.logger.info('All job handlers cleared', {
      clearedHandlers: count,
    });
  }

  /**
   * Validate handler before registration
   */
  validateHandler(handler: JobHandler): void {
    if (!handler.name) {
      throw new Error('Job handler must have a name');
    }

    if (typeof handler.execute !== 'function') {
      throw new Error('Job handler must have an execute function');
    }

    if (handler.validate && typeof handler.validate !== 'function') {
      throw new Error('Job handler validate must be a function');
    }

    if (handler.onSuccess && typeof handler.onSuccess !== 'function') {
      throw new Error('Job handler onSuccess must be a function');
    }

    if (handler.onFailure && typeof handler.onFailure !== 'function') {
      throw new Error('Job handler onFailure must be a function');
    }

    if (handler.onRetry && typeof handler.onRetry !== 'function') {
      throw new Error('Job handler onRetry must be a function');
    }
  }

  /**
   * Register multiple handlers at once
   */
  registerMultiple(handlers: JobHandler[]): void {
    for (const handler of handlers) {
      try {
        this.validateHandler(handler);
        this.register(handler);
      } catch (error) {
        this.logger.error('Failed to register job handler', {
          handlerName: handler.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    this.logger.info('Multiple job handlers registered', {
      count: handlers.length,
      handlerNames: handlers.map(h => h.name),
    });
  }
}
