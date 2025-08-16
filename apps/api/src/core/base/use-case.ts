/**
 * Use Case interfaces and base classes
 */

export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

/**
 * Abstract base class for use cases
 */
export abstract class BaseUseCase<TRequest, TResponse> implements UseCase<TRequest, TResponse> {
  abstract execute(request: TRequest): Promise<TResponse>;

  /**
   * Validate the request before execution
   */
  protected async validateRequest(request: TRequest): Promise<void> {
    // Override in subclasses to add validation logic
  }

  /**
   * Execute the use case with validation
   */
  async executeWithValidation(request: TRequest): Promise<TResponse> {
    await this.validateRequest(request);
    return this.execute(request);
  }
}

/**
 * Command interface
 */
export interface Command {
  readonly commandId: string;
  readonly timestamp: Date;
}

/**
 * Query interface
 */
export interface Query<TResponse> {
  readonly queryId: string;
}

/**
 * Command handler interface
 */
export interface CommandHandler<TCommand extends Command> {
  handle(command: TCommand): Promise<void>;
}

/**
 * Query handler interface
 */
export interface QueryHandler<TQuery extends Query<TResponse>, TResponse> {
  handle(query: TQuery): Promise<TResponse>;
}

/**
 * Abstract base class for command handlers
 */
export abstract class BaseCommandHandler<TCommand extends Command> implements CommandHandler<TCommand> {
  abstract handle(command: TCommand): Promise<void>;

  /**
   * Validate the command before handling
   */
  protected async validateCommand(command: TCommand): Promise<void> {
    // Override in subclasses to add validation logic
  }

  /**
   * Handle the command with validation
   */
  async handleWithValidation(command: TCommand): Promise<void> {
    await this.validateCommand(command);
    return this.handle(command);
  }
}

/**
 * Abstract base class for query handlers
 */
export abstract class BaseQueryHandler<TQuery extends Query<TResponse>, TResponse> implements QueryHandler<TQuery, TResponse> {
  abstract handle(query: TQuery): Promise<TResponse>;

  /**
   * Validate the query before handling
   */
  protected async validateQuery(query: TQuery): Promise<void> {
    // Override in subclasses to add validation logic
  }

  /**
   * Handle the query with validation
   */
  async handleWithValidation(query: TQuery): Promise<TResponse> {
    await this.validateQuery(query);
    return this.handle(query);
  }
}