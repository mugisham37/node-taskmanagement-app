import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { projects } from './projects';
import { workspaces } from './workspaces';
import { teams } from './teams';
import { tasks } from './tasks';

export const taskTemplates = pgTable('task_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  isPublic: boolean('is_public').notNull().default(false),
  usageCount: integer('usage_count').notNull().default(0),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  tags: jsonb('tags').default([]),
  taskData: jsonb('task_data').notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('task_templates_user_idx').on(table.userId),
  projectIdx: index('task_templates_project_idx').on(table.projectId),
  workspaceIdx: index('task_templates_workspace_idx').on(table.workspaceId),
  teamIdx: index('task_templates_team_idx').on(table.teamId),
  publicIdx: index('task_templates_public_idx').on(table.isPublic),
  categoryIdx: index('task_templates_category_idx').on(table.category),
  usageCountIdx: index('task_templates_usage_count_idx').on(table.usageCount),
  nameSearchIdx: index('task_templates_name_search_idx').on(table.name),
}));

export const taskTemplateUsage = pgTable('task_template_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => taskTemplates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at').notNull().defaultNow(),
}, (table) => ({
  templateUserIdx: index('task_template_usage_template_user_idx').on(table.templateId, table.userId),
  userIdx: index('task_template_usage_user_idx').on(table.userId),
  usedAtIdx: index('task_template_usage_used_at_idx').on(table.usedAt),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  user: one(users, {
    fields: [taskTemplates.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taskTemplates.projectId],
    references: [projects.id],
  }),
  workspace: one(workspaces, {
    fields: [taskTemplates.workspaceId],
    references: [workspaces.id],
  }),
  team: one(teams, {
    fields: [taskTemplates.teamId],
    references: [teams.id],
  }),
  usage: many(taskTemplateUsage),
}));

export const taskTemplateUsageRelations = relations(taskTemplateUsage, ({ one }) => ({
  template: one(taskTemplates, {
    fields: [taskTemplateUsage.templateId],
    references: [taskTemplates.id],
  }),
  user: one(users, {
    fields: [taskTemplateUsage.userId],
    references: [users.id],
  }),
}));

export const insertTaskTemplateSchema = createInsertSchema(taskTemplates, {
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  usageCount: z.number().min(0).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  taskData: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    tags: z.array(z.string()).optional(),
    estimatedHours: z.number().min(0).optional(),
    checklist: z.array(z.object({
      title: z.string().min(1).max(200),
      completed: z.boolean().optional(),
    })).optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      path: z.string(),
      mimetype: z.string(),
      size: z.number(),
    })).optional(),
  }),
  settings: z.record(z.any()).optional(),
});

export const selectTaskTemplateSchema = createSelectSchema(taskTemplates);

export const insertTaskTemplateUsageSchema = createInsertSchema(taskTemplateUsage, {
  usedAt: z.date().optional(),
});

export const selectTaskTemplateUsageSchema = createSelectSchema(taskTemplateUsage);

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
export type TaskTemplateUsage = typeof taskTemplateUsage.$inferSelect;
export type NewTaskTemplateUsage = typeof taskTemplateUsage.$inferInsert;
