import { pgTable, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tasks } from './tasks';

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    taskId: varchar('task_id', { length: 36 })
      .references(() => tasks.id)
      .notNull(),
    dependsOnId: varchar('depends_on_id', { length: 36 })
      .references(() => tasks.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    uniqueTaskDependency: unique().on(table.taskId, table.dependsOnId),
  })
);

export const taskDependenciesRelations = relations(
  taskDependencies,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskDependencies.taskId],
      references: [tasks.id],
      relationName: 'taskDependencies',
    }),
    dependsOn: one(tasks, {
      fields: [taskDependencies.dependsOnId],
      references: [tasks.id],
      relationName: 'taskDependents',
    }),
  })
);
