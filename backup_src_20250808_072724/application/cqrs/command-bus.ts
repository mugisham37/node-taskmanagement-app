/**
 * Command Bus Implementation
 *
 * The command bus is responsible for routing commands to their appropriate handlers,
 * providing validation, error handling, and transaction coordination.
 */

import {
  ICommand,
  ICommandHandler,
  ICommandBus,
  CommandHandlerNotFoundError,
} from './command';
import { ILogger } from '@/shared/types/logger';
import { injectable } from '@/application/decorators/injectable';

@injectable()
export class CommandBus implements ICommandBus {
  private handlers = new Map<string, ICommandHandler<any, any>>();

  constructor(private readonly logger: ILogger) {}

  async send<TResult = void>(command: ICommand): Promise<TResult> {
    const commandType = command.constructor.name;
    const handler = this.findHandler(command);

    if (!handler) {
      throw new CommandHandlerNotFoundError(commandType);
    }

    this.logger.info('Executing command', {
      commandType,
      commandId: command.commandId,
      userId: command.userId,
      correlationId: command.correlationId,
    });

    try {
      const startTime = Date.now();
      const result = await handler.handle(command);
      const duration = Date.now() - startTime;

      this.logger.info('Command executed successfully', {
        commandType,
        commandId: command.commandId,
        duration,
        userId: command.userId,
        correlationId: command.correlationId,
      });

      return result;
    } catch (error) {
      this.logger.error('Command execution failed', {
        commandType,
        commandId: command.commandId,
        error: error instanceof Error ? error.message : String(error),
        userId: command.userId,
        correlationId: command.correlationId,
      });

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
      throw new Error(
        `Handler for command type '${commandType}' is already registered`
      );
    }

    this.handlers.set(commandType, handler);

    this.logger.debug('Command handler registered', {
      commandType,
      handlerName,
    });
  }

  private findHandler(
    command: ICommand
  ): ICommandHandler<any, any> | undefined {
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
}
