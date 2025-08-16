/**
 * Task status enumeration
 */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';

/**
 * Priority enumeration
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * User ID type
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
