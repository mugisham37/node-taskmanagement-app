import { pgTable, uuid, varchar, text, boolean, timestamp, integer, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { tasks } from './tasks';

// Define project status enum
export const projectStatusEnum = pgEnum('project_status', [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled'
]);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: projectStatusEnum('status').notNull().default('planning'),
  isArchived: boolean('is_archived').notNull().default(false),
  version: integer('version').notNull().default(1), // Optimistic locking
  deletedAt: timestamp('deleted_at'), // Soft delete
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('projects_name_idx').on(table.name),
  ownerIdx: index('projects_owner_idx').on(table.ownerId),
  statusIdx: index('projects_status_idx').on(table.status),
  archivedIdx: index('projects_archived_idx').on(table.isArchived),
  ownerArchivedIdx: index('projects_owner_archived_idx').on(table.ownerId, table.isArchived),
  ownerStatusIdx: index('projects_owner_status_idx').on(table.ownerId, table.status),
  deletedAtIdx: index('projects_deleted_at_idx').on(table.deletedAt),
  createdAtIdx: index('projects_created_at_idx').on(table.createdAt),
}));

export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  members: many(projectMembers),
  tasks: many(tasks),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const insertProjectSchema = createInsertSchema(projects, {
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
});

export const selectProjectSchema = createSelectSchema(projects);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
