import { TaskStatus } from '../constants/task-constants';
import { Priority } from '../enums/common.enums';
import { UserId } from '../../domain/value-objects/user-id';

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
