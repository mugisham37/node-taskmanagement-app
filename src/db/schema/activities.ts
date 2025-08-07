import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { tasks } from './tasks';
import { projects } from './projects';
import { workspaces } from './workspaces';
import { teams } from './teams';

// Activity type enum
export const activityTypeEnum = [
  'task_created',
  'task_updated', 
  'task_deleted',
  'task_completed',
  'task_assigned',
  'task_commented',
  'project_created',
  'project_updated',
  'project_deleted',
  'workspace_created',
  'workspace_updated',
  'workspace_deleted',
  'team_created',
  'team_updated',
  'team_deleted',
  'team_member_added',
  'team_member_removed',
  'team_member_role_changed',
  'calendar_event_created',
  'calendar_event_updated',
  'calendar_event_deleted',
] as const;

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull().default({}),
  metadata: jsonb('metadata').default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userCreatedAtIdx: index('activities_user_created_at_idx').on(table.userId, table.createdAt),
  taskCreatedAtIdx: index('activities_task_created_at_idx').on(table.taskId, table.createdAt),
  projectCreatedAtIdx: index('activities_project_created_at_idx').on(table.projectId, table.createdAt),
  workspaceCreatedAtIdx: index('activities_workspace_created_at_idx').on(table.workspaceId, table.createdAt),
  teamCreatedAtIdx: index('activities_team_created_at_idx').on(table.teamId, table.createdAt),
  typeCreatedAtIdx: index('activities_type_created_at_idx').on(table.type, table.createdAt),
  createdAtIdx: index('activities_created_at_idx').on(table.createdAt),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [activities.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
  workspace: one(workspaces, {
    fields: [activities.workspaceId],
    references: [workspaces.id],
  }),
  team: one(teams, {
    fields: [activities.teamId],
    references: [teams.id],
  }),
}));

export const insertActivitySchema = createInsertSchema(activities, {
  type: z.enum(activityTypeEnum),
  data: z.record(z.any()).default({}),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
});

export const selectActivitySchema = createSelectSchema(activities);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ActivityType = typeof activityTypeEnum[number];
