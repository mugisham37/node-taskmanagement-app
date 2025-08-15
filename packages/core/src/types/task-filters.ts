import { TaskStatus } from '../constants/task-constants';
import { Priority } from '../enums/common.enums';

/**
 * User ID type - simplified for core package
 */
export type UserId = string;

/**
 * Unified task filters interface used across application and domain layers
 * This interface resolves type conflicts between application queries and domain repositories
 */
export interface UnifiedTaskFilters {
  status?: TaskStatus[];
  priority?: Priority[];
  assigneeId?: UserId;
  createdById?: UserId;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  isOverdue?: boolean;
  hasAssignee?: boolean;
  hasEstimatedHours?: boolean;
  search?: string;
}

/**
 * Type alias for backward compatibility
 */
export type CommonTaskFilters = UnifiedTaskFilters;