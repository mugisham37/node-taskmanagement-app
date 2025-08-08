import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { projects } from './projects';
import { tasks } from './tasks';

// Recurrence frequency enum
export const recurrenceFrequencyEnum = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export const recurringTasks = pgTable('recurring_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  frequency: varchar('frequency', { length: 20 }).notNull(),
  interval: integer('interval').notNull().default(1),
  daysOfWeek: jsonb('days_of_week').default([]),
  daysOfMonth: jsonb('days_of_month').default([]),
  monthsOfYear: jsonb('months_of_year').default([]),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  active: boolean('active').notNull().default(true),
  nextRunDate: timestamp('next_run_date'),
  lastTaskCreated: timestamp('last_task_created'),
  createdTasksCount: integer('created_tasks_count').notNull().default(0),
  taskTemplate: jsonb('task_template').notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('recurring_tasks_user_idx').on(table.userId),
  projectIdx: index('recurring_tasks_project_idx').on(table.projectId),
  activeNextRunIdx: index('recurring_tasks_active_next_run_idx').on(table.active, table.nextRunDate),
  frequencyIdx: index('recurring_tasks_frequency_idx').on(table.frequency),
  startDateIdx: index('recurring_tasks_start_date_idx').on(table.startDate),
  endDateIdx: index('recurring_tasks_end_date_idx').on(table.endDate),
}));

export const recurringTaskInstances = pgTable('recurring_task_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  recurringTaskId: uuid('recurring_task_id').notNull().references(() => recurringTasks.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  scheduledDate: timestamp('scheduled_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  recurringTaskIdx: index('recurring_task_instances_recurring_task_idx').on(table.recurringTaskId),
  taskIdx: index('recurring_task_instances_task_idx').on(table.taskId),
  scheduledDateIdx: index('recurring_task_instances_scheduled_date_idx').on(table.scheduledDate),
}));

export const recurringTasksRelations = relations(recurringTasks, ({ one, many }) => ({
  user: one(users, {
    fields: [recurringTasks.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [recurringTasks.projectId],
    references: [projects.id],
  }),
  instances: many(recurringTaskInstances),
}));

export const recurringTaskInstancesRelations = relations(recurringTaskInstances, ({ one }) => ({
  recurringTask: one(recurringTasks, {
    fields: [recurringTaskInstances.recurringTaskId],
    references: [recurringTasks.id],
  }),
  task: one(tasks, {
    fields: [recurringTaskInstances.taskId],
    references: [tasks.id],
  }),
}));

export const insertRecurringTaskSchema = createInsertSchema(recurringTasks, {
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  frequency: z.enum(recurrenceFrequencyEnum),
  interval: z.number().min(1).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  daysOfMonth: z.array(z.number().min(1).max(31)).optional(),
  monthsOfYear: z.array(z.number().min(0).max(11)).optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  active: z.boolean().optional(),
  nextRunDate: z.date().optional(),
  lastTaskCreated: z.date().optional(),
  createdTasksCount: z.number().min(0).optional(),
  taskTemplate: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    tags: z.array(z.string()).optional(),
    estimatedHours: z.number().min(0).optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      path: z.string(),
      mimetype: z.string(),
      size: z.number(),
    })).optional(),
  }),
  settings: z.record(z.any()).optional(),
});

export const selectRecurringTaskSchema = createSelectSchema(recurringTasks);

export const insertRecurringTaskInstanceSchema = createInsertSchema(recurringTaskInstances, {
  scheduledDate: z.date(),
});

export const selectRecurringTaskInstanceSchema = createSelectSchema(recurringTaskInstances);

export type RecurringTask = typeof recurringTasks.$inferSelect;
export type NewRecurringTask = typeof recurringTasks.$inferInsert;
export type RecurringTaskInstance = typeof recurringTaskInstances.$inferSelect;
export type NewRecurringTaskInstance = typeof recurringTaskInstances.$inferInsert;
export type RecurrenceFrequency = typeof recurrenceFrequencyEnum[number];
