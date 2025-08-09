import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';
import { taskDependencies } from './task-dependencies';

export const taskStatusEnum = pgEnum('task_status', [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'COMPLETED',
  'CANCELLED',
]);

export const priorityEnum = pgEnum('priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('TODO').notNull(),
  priority: priorityEnum('priority').default('MEDIUM').notNull(),
  assigneeId: varchar('assignee_id', { length: 36 }).references(() => users.id),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id)
    .notNull(),
  createdById: varchar('created_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  dueDate: timestamp('due_date'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'taskCreator',
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  dependencies: many(taskDependencies, { relationName: 'taskDependencies' }),
  dependents: many(taskDependencies, { relationName: 'taskDependents' }),
}));
