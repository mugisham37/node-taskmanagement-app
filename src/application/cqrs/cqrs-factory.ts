/**
 * CQRS Factory
 *
 * This module provides a factory for setting up the complete CQRS infrastructure
 * with all handlers, validators, and buses properly configured.
 */

import { IContainer } from '@/infrastructure/ioc/container';
import { CommandBus, ICommandBus } from './command-bus';
import { QueryBus, IQueryBus } from './query-bus';
import {
  CommandValidator,
  ICommandValidator,
} from './validation/command-validator';
import { QueryValidator, IQueryValidator } from './validation/query-validator';

// Import all handlers
import {
  CreateTaskCommandHandler,
  UpdateTaskCommandHandler,
  DeleteTaskCommandHandler,
  AssignTaskCommandHandler,
  CompleteTaskCommandHandler,
  BulkUpdateTasksCommandHandler,
} from './handlers/task-command-handlers';

import {
  GetTaskByIdQueryHandler,
  GetTasksQueryHandler,
  GetTasksByProjectQueryHandler,
  GetTasksByAssigneeQueryHandler,
  GetTaskStatsQueryHandler,
  SearchTasksQueryHandler,
  GetOverdueTasksQueryHandler,
  GetTasksWithUpcomingDueDatesQueryHandler,
  GetTaskHistoryQueryHandler,
  GetTaskDependenciesQueryHandler,
} from './handlers/task-query-handlers';

import { ILogger } from '@/shared/types/logger';

export interface CQRSConfiguration {
  enableValidation?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
}

export class CQRSFactory {
  static create(
    container: IContainer,
    config: CQRSConfiguration = {}
  ): {
    commandBus: ICommandBus;
    queryBus: IQueryBus;
    commandValidator: ICommandValidator;
    queryValidator: IQueryValidator;
  } {
    const logger = container.resolve<ILogger>('ILogger');

    // Create buses
    const commandBus = new CommandBus(logger);
    const queryBus = new QueryBus(logger);

    // Create validators
    const commandValidator = new CommandValidator();
    const queryValidator = new QueryValidator();

    // Register command handlers
    this.registerCommandHandlers(commandBus, container);

    // Register query handlers
    this.registerQueryHandlers(queryBus, container);

    // Setup validation rules if enabled
    if (config.enableValidation) {
      this.setupValidationRules(commandValidator, queryValidator);
    }

    return {
      commandBus,
      queryBus,
      commandValidator,
      queryValidator,
    };
  }

  private static registerCommandHandlers(
    commandBus: ICommandBus,
    container: IContainer
  ): void {
    // Task command handlers
    const createTaskHandler = container.resolve<CreateTaskCommandHandler>(
      'CreateTaskCommandHandler'
    );
    const updateTaskHandler = container.resolve<UpdateTaskCommandHandler>(
      'UpdateTaskCommandHandler'
    );
    const deleteTaskHandler = container.resolve<DeleteTaskCommandHandler>(
      'DeleteTaskCommandHandler'
    );
    const assignTaskHandler = container.resolve<AssignTaskCommandHandler>(
      'AssignTaskCommandHandler'
    );
    const completeTaskHandler = container.resolve<CompleteTaskCommandHandler>(
      'CompleteTaskCommandHandler'
    );
    const bulkUpdateTasksHandler =
      container.resolve<BulkUpdateTasksCommandHandler>(
        'BulkUpdateTasksCommandHandler'
      );

    commandBus.register(createTaskHandler);
    commandBus.register(updateTaskHandler);
    commandBus.register(deleteTaskHandler);
    commandBus.register(assignTaskHandler);
    commandBus.register(completeTaskHandler);
    commandBus.register(bulkUpdateTasksHandler);
  }

  private static registerQueryHandlers(
    queryBus: IQueryBus,
    container: IContainer
  ): void {
    // Task query handlers
    const getTaskByIdHandler = container.resolve<GetTaskByIdQueryHandler>(
      'GetTaskByIdQueryHandler'
    );
    const getTasksHandler = container.resolve<GetTasksQueryHandler>(
      'GetTasksQueryHandler'
    );
    const getTasksByProjectHandler =
      container.resolve<GetTasksByProjectQueryHandler>(
        'GetTasksByProjectQueryHandler'
      );
    const getTasksByAssigneeHandler =
      container.resolve<GetTasksByAssigneeQueryHandler>(
        'GetTasksByAssigneeQueryHandler'
      );
    const getTaskStatsHandler = container.resolve<GetTaskStatsQueryHandler>(
      'GetTaskStatsQueryHandler'
    );
    const searchTasksHandler = container.resolve<SearchTasksQueryHandler>(
      'SearchTasksQueryHandler'
    );
    const getOverdueTasksHandler =
      container.resolve<GetOverdueTasksQueryHandler>(
        'GetOverdueTasksQueryHandler'
      );
    const getTasksWithUpcomingDueDatesHandler =
      container.resolve<GetTasksWithUpcomingDueDatesQueryHandler>(
        'GetTasksWithUpcomingDueDatesQueryHandler'
      );
    const getTaskHistoryHandler = container.resolve<GetTaskHistoryQueryHandler>(
      'GetTaskHistoryQueryHandler'
    );
    const getTaskDependenciesHandler =
      container.resolve<GetTaskDependenciesQueryHandler>(
        'GetTaskDependenciesQueryHandler'
      );

    queryBus.register(getTaskByIdHandler);
    queryBus.register(getTasksHandler);
    queryBus.register(getTasksByProjectHandler);
    queryBus.register(getTasksByAssigneeHandler);
    queryBus.register(getTaskStatsHandler);
    queryBus.register(searchTasksHandler);
    queryBus.register(getOverdueTasksHandler);
    queryBus.register(getTasksWithUpcomingDueDatesHandler);
    queryBus.register(getTaskHistoryHandler);
    queryBus.register(getTaskDependenciesHandler);
  }

  private static setupValidationRules(
    commandValidator: ICommandValidator,
    queryValidator: IQueryValidator
  ): void {
    // Add validation rules here
    // This would include specific validation rules for each command and query type
    // For brevity, we'll add them as needed
  }

  static registerWithContainer(
    container: IContainer,
    config: CQRSConfiguration = {}
  ): void {
    const cqrs = this.create(container, config);

    // Register CQRS components in the container
    container.registerFactory(
      'ICommandBus',
      () => cqrs.commandBus,
      'singleton' as any
    );
    container.registerFactory(
      'IQueryBus',
      () => cqrs.queryBus,
      'singleton' as any
    );
    container.registerFactory(
      'ICommandValidator',
      () => cqrs.commandValidator,
      'singleton' as any
    );
    container.registerFactory(
      'IQueryValidator',
      () => cqrs.queryValidator,
      'singleton' as any
    );

    // Register all command handlers
    container.registerTransient(
      'CreateTaskCommandHandler',
      CreateTaskCommandHandler
    );
    container.registerTransient(
      'UpdateTaskCommandHandler',
      UpdateTaskCommandHandler
    );
    container.registerTransient(
      'DeleteTaskCommandHandler',
      DeleteTaskCommandHandler
    );
    container.registerTransient(
      'AssignTaskCommandHandler',
      AssignTaskCommandHandler
    );
    container.registerTransient(
      'CompleteTaskCommandHandler',
      CompleteTaskCommandHandler
    );
    container.registerTransient(
      'BulkUpdateTasksCommandHandler',
      BulkUpdateTasksCommandHandler
    );

    // Register all query handlers
    container.registerTransient(
      'GetTaskByIdQueryHandler',
      GetTaskByIdQueryHandler
    );
    container.registerTransient('GetTasksQueryHandler', GetTasksQueryHandler);
    container.registerTransient(
      'GetTasksByProjectQueryHandler',
      GetTasksByProjectQueryHandler
    );
    container.registerTransient(
      'GetTasksByAssigneeQueryHandler',
      GetTasksByAssigneeQueryHandler
    );
    container.registerTransient(
      'GetTaskStatsQueryHandler',
      GetTaskStatsQueryHandler
    );
    container.registerTransient(
      'SearchTasksQueryHandler',
      SearchTasksQueryHandler
    );
    container.registerTransient(
      'GetOverdueTasksQueryHandler',
      GetOverdueTasksQueryHandler
    );
    container.registerTransient(
      'GetTasksWithUpcomingDueDatesQueryHandler',
      GetTasksWithUpcomingDueDatesQueryHandler
    );
    container.registerTransient(
      'GetTaskHistoryQueryHandler',
      GetTaskHistoryQueryHandler
    );
    container.registerTransient(
      'GetTaskDependenciesQueryHandler',
      GetTaskDependenciesQueryHandler
    );
  }
}
