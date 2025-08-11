import { pgTable, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { workspaces } from './workspaces';
import { tasks } from './tasks';
import { projectMembers } from './project-members';

export const projectStatusEnum = pgEnum('project_status', [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD', 
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const projects = pgTable('projects', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  workspaceId: varchar('workspace_id', { length: 36 })
    .references(() => workspaces.id)
    .notNull(),
  managerId: varchar('manager_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  status: projectStatusEnum('status').default('ACTIVE').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  manager: one(users, {
    fields: [projects.managerId],
    references: [users.id],
    relationName: 'projectManager',
  }),
  tasks: many(tasks),
  members: many(projectMembers),
}));
