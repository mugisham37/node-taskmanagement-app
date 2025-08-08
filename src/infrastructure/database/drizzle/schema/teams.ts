import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';

// Team role enum
export const teamRoleEnum = ['owner', 'admin', 'member'] as const;

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  avatar: text('avatar'),
  color: varchar('color', { length: 7 }).notNull().default('#4f46e5'),
  settings: jsonb('settings').default({}),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('teams_name_idx').on(table.name),
  createdByIdx: index('teams_created_by_idx').on(table.createdById),
}));

export const teamMembers = pgTable('team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  permissions: jsonb('permissions').default({}),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  invitedById: uuid('invited_by_id').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  teamUserIdx: index('team_members_team_user_idx').on(table.teamId, table.userId),
  userIdx: index('team_members_user_idx').on(table.userId),
  roleIdx: index('team_members_role_idx').on(table.role),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [teams.createdById],
    references: [users.id],
  }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    fields: [teamMembers.invitedById],
    references: [users.id],
  }),
}));

export const insertTeamSchema = createInsertSchema(teams, {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  settings: z.record(z.any()).optional(),
});

export const selectTeamSchema = createSelectSchema(teams);

export const insertTeamMemberSchema = createInsertSchema(teamMembers, {
  role: z.enum(teamRoleEnum),
  permissions: z.record(z.any()).optional(),
});

export const selectTeamMemberSchema = createSelectSchema(teamMembers);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type TeamRole = typeof teamRoleEnum[number];
