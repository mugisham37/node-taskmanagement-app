import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatar: text('avatar'),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  preferences: jsonb('preferences').default({
    theme: 'system',
    notifications: true,
    language: 'en'
  }),
  lastLoginAt: timestamp('last_login_at'),
  version: integer('version').notNull().default(1), // Optimistic locking
  deletedAt: timestamp('deleted_at'), // Soft delete
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
  roleIdx: index('users_role_idx').on(table.role),
  emailVerifiedIdx: index('users_email_verified_idx').on(table.isEmailVerified),
  lastLoginIdx: index('users_last_login_idx').on(table.lastLoginAt),
  deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  fullNameIdx: index('users_full_name_idx').on(table.firstName, table.lastName),
  createdAtIdx: index('users_created_at_idx').on(table.createdAt),
}));

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  username: z.string().min(3).max(20),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['admin', 'user']),
});

export const selectUserSchema = createSelectSchema(users);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
