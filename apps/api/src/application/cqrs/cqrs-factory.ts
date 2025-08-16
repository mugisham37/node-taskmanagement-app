/**
 * Enhanced CQRS Factory
 *
 * This module provides a factory for setting up the complete CQRS infrastructure
 * with all handlers, validators, and buses properly configured for the current architecture.
 */

import { CommandBus } from './command-bus';
import { QueryBus } from './query-bus';
import {
  CommandValidator,
  ICommandValidator,
} from './validation/command-validator';
import { QueryValidator, IQueryValidator } from './validation/query-validator';
import { ICommandBus } from './command';
import { IQueryBus } from './query';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';

export interface CQRSConfiguration {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export interface CQRSComponents {
  commandBus: ICommandBus;
  queryBus: IQueryBus;
  commandValidator: ICommandValidator;
  queryValidator: IQueryValidator;
}

export class CQRSFactory {
  static create(
    logger: LoggingService,
    config: CQRSConfiguration = {}
  ): CQRSComponents {
    // Create buses
    const commandBus = new CommandBus(logger);
    const queryBus = new QueryBus(logger);

    // Create validators
    const commandValidator = new CommandValidator(logger);
    const queryValidator = new QueryValidator(logger);

    // Setup validation rules if enabled
    if (config.enableValidation) {
      this.setupValidationRules(commandValidator, queryValidator);
    }

    logger.info('CQRS infrastructure created', {
      enableValidation: config.enableValidation,
      enableMetrics: config.enableMetrics,
      enableCaching: config.enableCaching,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring,
    });

    return {
      commandBus,
      queryBus,
      commandValidator,
      queryValidator,
    };
  }

  static registerHandlers(
    commandBus: ICommandBus,
    queryBus: IQueryBus,
    handlers: {
      commandHandlers?: any[];
      queryHandlers?: any[];
    }
  ): void {
    // Register command handlers
    if (handlers.commandHandlers) {
      handlers.commandHandlers.forEach(handler => {
        commandBus.register(handler);
      });
    }

    // Register query handlers
    if (handlers.queryHandlers) {
      handlers.queryHandlers.forEach(handler => {
        queryBus.register(handler);
      });
    }
  }

  private static setupValidationRules(
    _commandValidator: ICommandValidator,
    _queryValidator: IQueryValidator
  ): void {
    // Add common validation rules here
    // This would include specific validation rules for each command and query type
    // For now, we'll set up basic rules that can be extended
    // Example: Add validation rules for task commands
    // commandValidator.addRule('CreateTaskCommand', new CreateTaskValidationRule());
    // commandValidator.addRule('UpdateTaskCommand', new UpdateTaskValidationRule());
    // Example: Add validation rules for task queries
    // queryValidator.addRule('GetTaskByIdQuery', new GetTaskByIdValidationRule());
    // queryValidator.addRule('GetTasksQuery', new GetTasksValidationRule());
  }

  static createWithDefaults(logger: LoggingService): CQRSComponents {
    return this.create(logger, {
      enableValidation: true,
      enableMetrics: true,
      enableCaching: true,
      enablePerformanceMonitoring: true,
    });
  }

  static getPerformanceMetrics(
    components: CQRSComponents
  ): Record<string, any> {
    const commandMetrics = (
      components.commandBus as CommandBus
    ).getPerformanceMetrics();
    const queryMetrics = (
      components.queryBus as QueryBus
    ).getPerformanceMetrics();

    return {
      commands: commandMetrics,
      queries: queryMetrics,
      validation: {
        commandRules: (
          components.commandValidator as CommandValidator
        ).getRulesCount(),
        queryRules: (
          components.queryValidator as QueryValidator
        ).getRulesCount(),
      },
    };
  }

  static clearCaches(components: CQRSComponents): Promise<void> {
    return (components.queryBus as QueryBus).invalidateCache();
  }

  static reset(components: CQRSComponents): void {
    (components.commandBus as CommandBus).clear();
    (components.queryBus as QueryBus).clear();
    (components.commandValidator as CommandValidator).clearRules();
    (components.queryValidator as QueryValidator).clearRules();
  }
}
