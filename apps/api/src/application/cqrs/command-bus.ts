/**
 * Enhanced Command Bus Implementation
 *
 * The command bus is responsible for routing commands to their appropriate handlers,
 * providing validation, error handling, transaction coordination, and performance monitoring.
 */

import { PerformanceMonitor } from '@taskmanagement/utils';
import { LoggingService } from '@taskmanagement/observability';
import { injectable } from '../shared/decorators/injectable.decorator';
import { CommandHandlerNotFoundError, ICommand, ICommandBus, ICommandHandler } from './command';

@injectable()
export class CommandBus implements ICommandBus {
  private handlers = new Map<string, ICommandHandler<any, any>>();
  private performanceMonitor = new PerformanceMonitor();

  constructor(private readonly logger: LoggingService) {}

  async send<TResult = void>(command: ICommand): Promise<TResult> {
    const commandType = command.constructor.name;
    const handler = this.findHandler(command);

    if (!handler) {
      throw new CommandHandlerNotFoundError(commandType);
    }

    this.logger.info('Executing command', {
      commandType,
      commandId: command.commandId,
      userId: command.userId?.value,
      ...(command.correlationId && { correlationId: command.correlationId }),
    });

    const timer = this.performanceMonitor.startTimer(`command.${commandType}`);

    try {
      const result = await handler.handle(command);
      const duration = timer.end();

      this.logger.info('Command executed successfully', {
        commandType,
        commandId: command.commandId,
        duration,
        userId: command.userId?.value,
        ...(command.correlationId && { correlationId: command.correlationId }),
      });

      // Record performance metrics
      this.performanceMonitor.recordMetric(`command.${commandType}.success`, 1);
      this.performanceMonitor.recordMetric(`command.${commandType}.duration`, duration);

      return result;
    } catch (error) {
      const duration = timer.end();

      this.logger.error('Command execution failed', error as Error, {
        commandType,
        commandId: command.commandId,
        duration,
        userId: command.userId?.value,
        ...(command.correlationId && { correlationId: command.correlationId }),
      });

      // Record error metrics
      this.performanceMonitor.recordMetric(`command.${commandType}.error`, 1);

      throw error;
    }
  }

  register<TCommand extends ICommand, TResult = void>(
    handler: ICommandHandler<TCommand, TResult>
  ): void {
    const handlerName = handler.constructor.name;

    // Extract command type from handler name (e.g., CreateTaskCommandHandler -> CreateTaskCommand)
    const commandType = handlerName.replace('Handler', '');

    if (this.handlers.has(commandType)) {
      throw new Error(`Handler for command type '${commandType}' is already registered`);
    }

    this.handlers.set(commandType, handler);

    this.logger.info('Command handler registered', {
      commandType,
      handlerName,
    });
  }

  private findHandler(command: ICommand): ICommandHandler<any, any> | undefined {
    const commandType = command.constructor.name;
    const handler = this.handlers.get(commandType);

    if (handler && handler.canHandle(command)) {
      return handler;
    }

    // Fallback: search through all handlers
    for (const [, registeredHandler] of this.handlers) {
      if (registeredHandler.canHandle(command)) {
        return registeredHandler;
      }
    }

    return undefined;
  }

  // For testing and debugging
  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  clear(): void {
    this.handlers.clear();
  }

  // Performance monitoring
  getPerformanceMetrics(): Record<string, any> {
    return this.performanceMonitor.getMetrics();
  }
}

