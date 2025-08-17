import { DomainEventPublisher } from "@taskmanagement/domain";
import { LoggingService } from '@taskmanagement/observability';

export interface ICommandHandler<TCommand, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
}

export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

export abstract class BaseHandler {
  constructor(
    protected readonly eventPublisher: DomainEventPublisher,
    protected readonly logger: LoggingService
  ) {}

  protected async publishEvents(): Promise<void> {
    await this.eventPublisher.publishAll();
  }

  protected logInfo(message: string, context?: any): void {
    this.logger.info(message, context);
  }

  protected logError(message: string, error: Error, context?: any): void {
    this.logger.error(message, error, context);
  }

  protected logWarning(message: string, context?: any): void {
    this.logger.warn(message, context);
  }

  protected logDebug(message: string, context?: any): void {
    this.logger.debug(message, context);
  }
}

