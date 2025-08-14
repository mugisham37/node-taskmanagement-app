import { z } from 'zod';
import { TaskStatus, TaskPriority } from '../types/tasks';

// Task attachment schema
export const taskAttachmentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.date(),
});

// Task comment schema
export const taskCommentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  authorId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Main task schema
export const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  projectId: z.string().uuid('Invalid project ID'),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  reporterId: z.string().uuid('Invalid reporter ID'),
  parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
  tags: z.array(z.string().min(1).max(50)).default([]),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  completedAt: z.date().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
  attachments: z.array(taskAttachmentSchema).default([]),
  comments: z.array(taskCommentSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Create task request schema
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  projectId: z.string().uuid('Invalid project ID'),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  priority: z.nativeEnum(TaskPriority),
  tags: z.array(z.string().min(1).max(50)).default([]),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  estimatedHours: z.number().positive().optional(),
  parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
});

// Update task request schema
export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
});

// Task filter schema
export const taskFilterSchema = z.object({
  status: z.array(z.nativeEnum(TaskStatus)).optional(),
  priority: z.array(z.nativeEnum(TaskPriority)).optional(),
  assigneeId: z.array(z.string().uuid()).optional(),
  reporterId: z.array(z.string().uuid()).optional(),
  projectId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  dueDateFrom: z.date().optional(),
  dueDateTo: z.date().optional(),
  search: z.string().max(255).optional(),
});

// Task stats schema
export const taskStatsSchema = z.object({
  total: z.number().nonnegative(),
  byStatus: z.record(z.nativeEnum(TaskStatus), z.number().nonnegative()),
  byPriority: z.record(z.nativeEnum(TaskPriority), z.number().nonnegative()),
  overdue: z.number().nonnegative(),
  completedThisWeek: z.number().nonnegative(),
  completedThisMonth: z.number().nonnegative(),
});

// Validation for date ranges
export const taskDateRangeSchema = createTaskSchema.refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return data.startDate <= data.dueDate;
    }
    return true;
  },
  {
    message: 'Start date must be before due date',
    path: ['startDate'],
  }
);