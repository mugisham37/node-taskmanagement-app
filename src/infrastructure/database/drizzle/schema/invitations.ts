import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { teams } from './teams';
import { workspaces } from './workspaces';

// Invitation status enum
export const invitationStatusEnum = ['pending', 'accepted', 'declined', 'expired'] as const;

// Invitation type enum
export const invitationTypeEnum = ['team', 'workspace', 'project'] as const;

export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  invitedById: uuid('invited_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  message: text('message'),
  metadata: jsonb('metadata').default({}),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  declinedAt: timestamp('declined_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  emailTeamIdx: index('invitations_email_team_idx').on(table.email, table.teamId),
  emailWorkspaceIdx: index('invitations_email_workspace_idx').on(table.email, table.workspaceId),
  tokenIdx: index('invitations_token_idx').on(table.token),
  statusIdx: index('invitations_status_idx').on(table.status),
  expiresAtIdx: index('invitations_expires_at_idx').on(table.expiresAt),
  invitedByIdx: index('invitations_invited_by_idx').on(table.invitedById),
  typeIdx: index('invitations_type_idx').on(table.type),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  invitedBy: one(users, {
    fields: [invitations.invitedById],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const insertInvitationSchema = createInsertSchema(invitations, {
  email: z.string().email(),
  type: z.enum(invitationTypeEnum),
  status: z.enum(invitationStatusEnum).optional(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
  token: z.string().min(1),
  message: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.date(),
});

export const selectInvitationSchema = createSelectSchema(invitations);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type InvitationStatus = typeof invitationStatusEnum[number];
export type InvitationType = typeof invitationTypeEnum[number];
