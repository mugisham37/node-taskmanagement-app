import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  hashedPassword: text('hashed_password').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  managedProjects: many(projects, { relationName: 'projectManager' }),
  ownedWorkspaces: many(workspaces, { relationName: 'workspaceOwner' }),
  projectMemberships: many(projectMembers),
}));

// Import other tables for relations
import { tasks } from './tasks';
import { projects } from './projects';
import { workspaces } from './workspaces';
import { projectMembers } from './project-members';
