/**
 * Task-related constants and enums
 */

import { Priority, TaskStatus } from '../enums/common.enums';

// Re-export enums for convenience
export { TaskStatus };
export const TaskPriority = Priority;

/**
 * Task status transitions - defines which status transitions are allowed
 */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [
    TaskStatus.IN_REVIEW,
    TaskStatus.TODO,
    TaskStatus.CANCELLED,
    TaskStatus.ON_HOLD,
  ],
  [TaskStatus.IN_REVIEW]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.REVIEW]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.COMPLETED]: [], // Completed tasks cannot transition to other states
  [TaskStatus.CANCELLED]: [TaskStatus.TODO], // Cancelled tasks can be reopened
  [TaskStatus.ON_HOLD]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
};

/**
 * Task priority weights for sorting
 */
export const TASK_PRIORITY_WEIGHTS: Record<Priority, number> = {
  [TaskPriority.LOW]: 1,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.URGENT]: 4,
  [TaskPriority.CRITICAL]: 5,
};

/**
 * Task validation constants
 */
export const TASK_VALIDATION = {
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 5000,
  MIN_ESTIMATED_HOURS: 0.25, // 15 minutes
  MAX_ESTIMATED_HOURS: 999,
  MIN_ACTUAL_HOURS: 0,
  MAX_ACTUAL_HOURS: 999,
} as const;

/**
 * Task business rules
 */
export const TASK_BUSINESS_RULES = {
  MAX_DEPENDENCIES_PER_TASK: 10,
  MAX_TASKS_PER_PROJECT: 1000,
  OVERDUE_THRESHOLD_DAYS: 1,
} as const;
