/**
 * CQRS Command Infrastructure
 *
 * This module provides the base infrastructure for implementing Command Query Responsibility Segregation (CQRS)
 * pattern in the application layer. Commands represent write operations that change system state.
 */

export interface ICommand {
  readonly commandId: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly correlationId?: string;
}

export abstract class Command implements ICommand {
  public readonly commandId: string;
  public readonly timestamp: Date;
  public readonly userId?: string;
  public readonly correlationId?: string;

  constructor(userId?: string, correlationId?: string) {
    this.commandId = this.generateId();
    this.timestamp = new Date();
    this.userId = userId;
    this.correlationId = correlationId;
  }

  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
  canHandle(command: ICommand): boolean;
}

export abstract class CommandHandler<TCommand extends ICommand, TResult = void>
  implements ICommandHandler<TCommand, TResult>
{
  abstract handle(command: TCommand): Promise<TResult>;

  canHandle(command: ICommand): boolean {
    return command.constructor.name === this.getCommandType();
  }

  protected abstract getCommandType(): string;
}

export interface ICommandBus {
  send<TResult = void>(command: ICommand): Promise<TResult>;
  register<TCommand extends ICommand, TResult = void>(
    handler: ICommandHandler<TCommand, TResult>
  ): void;
}

export class CommandValidationError extends Error {
  constructor(
    public readonly command: string,
    public readonly errors: Record<string, string[]>
  ) {
    super(`Command validation failed for ${command}`);
    this.name = 'CommandValidationError';
  }
}

export class CommandHandlerNotFoundError extends Error {
  constructor(commandType: string) {
    super(`No handler found for command type: ${commandType}`);
    this.name = 'CommandHandlerNotFoundError';
  }
}
