/**
 * Task Management Domain Repository Implementations
 */

export { PrismaTaskRepository } from './task.repository';

// Re-export interfaces for convenience
export type {
  ITaskRepository,
  TaskFilters,
  TaskSimilarityFilters,
} from '../../../domains/task-management/repositories/task.repository.interface';
