import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { teams } from './teams';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }).notNull().default('folder'),
  color: varchar('color', { length: 7 }).notNull().default('#4f46e5'),
  isPersonal: boolean('is_personal').notNull().default(false),
  settings: jsonb('settings').default({}),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index('workspaces_owner_idx').on(table.ownerId),
  teamIdx: index('workspaces_team_idx').on(table.teamId),
  personalOwnerIdx: index('workspaces_personal_owner_idx').on(table.isPersonal, table.ownerId),
  nameIdx: index('workspaces_name_idx').on(table.name),
}));

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  permissions: jsonb('permissions').default({}),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('workspace_members_workspace_user_idx').on(table.workspaceId, table.userId),
  userIdx: index('workspace_members_user_idx').on(table.userId),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [workspaces.teamId],
    references: [teams.id],
  }),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const insertWorkspaceSchema = createInsertSchema(workspaces, {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isPersonal: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
});

export const selectWorkspaceSchema = createSelectSchema(workspaces);

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers, {
  role: z.enum(['owner', 'admin', 'member']),
  permissions: z.record(z.any()).optional(),
});

export const selectWorkspaceMemberSchema = createSelectSchema(workspaceMembers);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
