import {
  pgTable,
  varchar,
  timestamp,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';

export const projectRoleEnum = pgEnum('project_role', [
  'OWNER',
  'MANAGER',
  'MEMBER',
  'VIEWER',
]);

export const projectMembers = pgTable(
  'project_members',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    projectId: varchar('project_id', { length: 36 })
      .references(() => projects.id)
      .notNull(),
    userId: varchar('user_id', { length: 36 })
      .references(() => users.id)
      .notNull(),
    role: projectRoleEnum('role').default('MEMBER').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  table => ({
    uniqueProjectUser: unique().on(table.projectId, table.userId),
  })
);

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