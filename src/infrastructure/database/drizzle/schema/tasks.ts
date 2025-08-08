import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { projects } from './projects';

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('todo'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  tags: jsonb('tags').default([]),
  dueDate: timestamp('due_date'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  attachments: jsonb('attachments').default([]),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  assignedAt: timestamp('assigned_at'),
  version: integer('version').notNull().default(1), // Optimistic locking
  deletedAt: timestamp('deleted_at'), // Soft delete
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  titleIdx: index('tasks_title_idx').on(table.title),
  statusIdx: index('tasks_status_idx').on(table.status),
  priorityIdx: index('tasks_priority_idx').on(table.priority),
  assigneeIdx: index('tasks_assignee_idx').on(table.assigneeId),
  creatorIdx: index('tasks_creator_idx').on(table.creatorId),
  projectIdx: index('tasks_project_idx').on(table.projectId),
  dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
  statusProjectIdx: index('tasks_status_project_idx').on(table.status, table.projectId),
  assigneeStatusIdx: index('tasks_assignee_status_idx').on(table.assigneeId, table.status),
  priorityStatusIdx: index('tasks_priority_status_idx').on(table.priority, table.status),
  deletedAtIdx: index('tasks_deleted_at_idx').on(table.deletedAt),
  createdAtIdx: index('tasks_created_at_idx').on(table.createdAt),
  completedAtIdx: index('tasks_completed_at_idx').on(table.completedAt),
}));

export const taskComments = pgTable('task_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [taskComments.authorId],
    references: [users.id],
  }),
}));

export const insertTaskSchema = createInsertSchema(tasks, {
  title: z.string().min(1).max(200),
  status: z.enum(['todo', 'in-progress', 'review', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
});

export const selectTaskSchema = createSelectSchema(tasks);

export const insertTaskCommentSchema = createInsertSchema(taskComments, {
  content: z.string().min(1),
});

export const selectTaskCommentSchema = createSelectSchema(taskComments);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskComment = typeof taskComments.$inferSelect;
export type NewTaskComment = typeof taskComments.$inferInsert;
