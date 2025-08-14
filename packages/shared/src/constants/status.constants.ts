// Status and priority constants with display information

import { TaskStatus, TaskPriority, ProjectStatus, ProjectPriority, UserRole } from '../types';

// Task status configurations
export const TASK_STATUS_CONFIG = {
  [TaskStatus.TODO]: {
    label: 'To Do',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: 'circle',
    order: 1,
  },
  [TaskStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: '#3B82F6', // blue-500
    bgColor: '#DBEAFE', // blue-100
    icon: 'play',
    order: 2,
  },
  [TaskStatus.IN_REVIEW]: {
    label: 'In Review',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    icon: 'eye',
    order: 3,
  },
  [TaskStatus.DONE]: {
    label: 'Done',
    color: '#10B981', // emerald-500
    bgColor: '#D1FAE5', // emerald-100
    icon: 'check',
    order: 4,
  },
  [TaskStatus.CANCELLED]: {
    label: 'Cancelled',
    color: '#EF4444', // red-500
    bgColor: '#FEE2E2', // red-100
    icon: 'x',
    order: 5,
  },
} as const;

// Task priority configurations
export const TASK_PRIORITY_CONFIG = {
  [TaskPriority.LOW]: {
    label: 'Low',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: 'arrow-down',
    order: 1,
  },
  [TaskPriority.MEDIUM]: {
    label: 'Medium',
    color: '#3B82F6', // blue-500
    bgColor: '#DBEAFE', // blue-100
    icon: 'minus',
    order: 2,
  },
  [TaskPriority.HIGH]: {
    label: 'High',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    icon: 'arrow-up',
    order: 3,
  },
  [TaskPriority.URGENT]: {
    label: 'Urgent',
    color: '#EF4444', // red-500
    bgColor: '#FEE2E2', // red-100
    icon: 'alert-triangle',
    order: 4,
  },
} as const;

// Project status configurations
export const PROJECT_STATUS_CONFIG = {
  [ProjectStatus.PLANNING]: {
    label: 'Planning',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: 'clipboard',
    order: 1,
  },
  [ProjectStatus.ACTIVE]: {
    label: 'Active',
    color: '#10B981', // emerald-500
    bgColor: '#D1FAE5', // emerald-100
    icon: 'play',
    order: 2,
  },
  [ProjectStatus.ON_HOLD]: {
    label: 'On Hold',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    icon: 'pause',
    order: 3,
  },
  [ProjectStatus.COMPLETED]: {
    label: 'Completed',
    color: '#8B5CF6', // violet-500
    bgColor: '#EDE9FE', // violet-100
    icon: 'check-circle',
    order: 4,
  },
  [ProjectStatus.CANCELLED]: {
    label: 'Cancelled',
    color: '#EF4444', // red-500
    bgColor: '#FEE2E2', // red-100
    icon: 'x-circle',
    order: 5,
  },
} as const;

// Project priority configurations
export const PROJECT_PRIORITY_CONFIG = {
  [ProjectPriority.LOW]: {
    label: 'Low',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: 'arrow-down',
    order: 1,
  },
  [ProjectPriority.MEDIUM]: {
    label: 'Medium',
    color: '#3B82F6', // blue-500
    bgColor: '#DBEAFE', // blue-100
    icon: 'minus',
    order: 2,
  },
  [ProjectPriority.HIGH]: {
    label: 'High',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    icon: 'arrow-up',
    order: 3,
  },
  [ProjectPriority.CRITICAL]: {
    label: 'Critical',
    color: '#EF4444', // red-500
    bgColor: '#FEE2E2', // red-100
    icon: 'alert-triangle',
    order: 4,
  },
} as const;

// User role configurations
export const USER_ROLE_CONFIG = {
  [UserRole.ADMIN]: {
    label: 'Administrator',
    color: '#8B5CF6', // violet-500
    bgColor: '#EDE9FE', // violet-100
    icon: 'shield',
    order: 1,
    permissions: ['*'], // All permissions
  },
  [UserRole.MANAGER]: {
    label: 'Manager',
    color: '#3B82F6', // blue-500
    bgColor: '#DBEAFE', // blue-100
    icon: 'users',
    order: 2,
    permissions: ['project:*', 'task:*', 'user:read'],
  },
  [UserRole.MEMBER]: {
    label: 'Member',
    color: '#10B981', // emerald-500
    bgColor: '#D1FAE5', // emerald-100
    icon: 'user',
    order: 3,
    permissions: ['task:read', 'task:create', 'task:update', 'project:read'],
  },
  [UserRole.VIEWER]: {
    label: 'Viewer',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    icon: 'eye',
    order: 4,
    permissions: ['task:read', 'project:read'],
  },
} as const;

// Status transition rules
export const STATUS_TRANSITIONS = {
  TASK: {
    [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
    [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.DONE, TaskStatus.TODO, TaskStatus.CANCELLED],
    [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
    [TaskStatus.DONE]: [TaskStatus.IN_PROGRESS], // Allow reopening
    [TaskStatus.CANCELLED]: [TaskStatus.TODO], // Allow reactivation
  },
  PROJECT: {
    [ProjectStatus.PLANNING]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
    [ProjectStatus.ACTIVE]: [ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
    [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
    [ProjectStatus.COMPLETED]: [ProjectStatus.ACTIVE], // Allow reopening
    [ProjectStatus.CANCELLED]: [ProjectStatus.PLANNING], // Allow reactivation
  },
} as const;