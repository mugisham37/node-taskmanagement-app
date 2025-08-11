/**
 * Enhanced CQRS Command Infrastructure
 *
 * This module provides the enhanced infrastructure for implementing Command Query Responsibility Segregation (CQRS)
 * pattern in the application layer. Commands represent write operations that change system state.
 */

import { UserId } from '../../domain/value-objects/user-id';

export interface ICommand {
  readonly commandId: string;
  readonly timestamp: Date;
  readonly userId: UserId;
  readonly correlationId?: string;
}

export abstract class Command implements ICommand {
  public readonly commandId: string;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    public readonly userId: UserId,
    correlationId?: string
  ) {
    this.commandId = this.generateId();
    this.timestamp = new Date();
    if (correlationId) {
      this.correlationId = correlationId;
    }
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

export class CommandExecutionError extends Error {
  constructor(
    public readonly command: string,
    public readonly originalError: Error,
    public readonly context?: Record<string, any>
  ) {
    super(`Command execution failed for ${command}: ${originalError.message}`);
    this.name = 'CommandExecutionError';
  }
}
