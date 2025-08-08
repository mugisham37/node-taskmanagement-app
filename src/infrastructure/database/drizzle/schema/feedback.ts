import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';

// Feedback type enum
export const feedbackTypeEnum = ['bug', 'feature', 'improvement', 'other'] as const;

// Feedback status enum
export const feedbackStatusEnum = ['pending', 'in-progress', 'resolved', 'rejected'] as const;

// Feedback priority enum
export const feedbackPriorityEnum = ['low', 'medium', 'high', 'critical'] as const;

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  screenshots: jsonb('screenshots').default([]),
  attachments: jsonb('attachments').default([]),
  metadata: jsonb('metadata').default({}),
  adminResponse: text('admin_response'),
  adminUserId: uuid('admin_user_id').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at'),
  votes: jsonb('votes').default({ up: 0, down: 0, users: [] }),
  tags: jsonb('tags').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userCreatedAtIdx: index('feedback_user_created_at_idx').on(table.userId, table.createdAt),
  statusIdx: index('feedback_status_idx').on(table.status),
  typeIdx: index('feedback_type_idx').on(table.type),
  priorityIdx: index('feedback_priority_idx').on(table.priority),
  categoryIdx: index('feedback_category_idx').on(table.category),
  adminUserIdx: index('feedback_admin_user_idx').on(table.adminUserId),
  resolvedAtIdx: index('feedback_resolved_at_idx').on(table.resolvedAt),
  titleSearchIdx: index('feedback_title_search_idx').on(table.title),
}));

export const feedbackComments = pgTable('feedback_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  feedbackId: uuid('feedback_id').notNull().references(() => feedback.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  feedbackCreatedAtIdx: index('feedback_comments_feedback_created_at_idx').on(table.feedbackId, table.createdAt),
  userIdx: index('feedback_comments_user_idx').on(table.userId),
  internalIdx: index('feedback_comments_internal_idx').on(table.isInternal),
}));

export const feedbackRelations = relations(feedback, ({ one, many }) => ({
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
  adminUser: one(users, {
    fields: [feedback.adminUserId],
    references: [users.id],
  }),
  comments: many(feedbackComments),
}));

export const feedbackCommentsRelations = relations(feedbackComments, ({ one }) => ({
  feedback: one(feedback, {
    fields: [feedbackComments.feedbackId],
    references: [feedback.id],
  }),
  user: one(users, {
    fields: [feedbackComments.userId],
    references: [users.id],
  }),
}));

export const insertFeedbackSchema = createInsertSchema(feedback, {
  type: z.enum(feedbackTypeEnum),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  status: z.enum(feedbackStatusEnum).optional(),
  priority: z.enum(feedbackPriorityEnum).optional(),
  category: z.string().max(50).optional(),
  screenshots: z.array(z.string().url()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string(),
    mimetype: z.string(),
    size: z.number(),
  })).optional(),
  metadata: z.object({
    browser: z.string().optional(),
    os: z.string().optional(),
    device: z.string().optional(),
    url: z.string().url().optional(),
    userAgent: z.string().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
  }).optional(),
  adminResponse: z.string().max(2000).optional(),
  resolvedAt: z.date().optional(),
  votes: z.object({
    up: z.number().min(0).optional(),
    down: z.number().min(0).optional(),
    users: z.array(z.string().uuid()).optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

export const selectFeedbackSchema = createSelectSchema(feedback);

export const insertFeedbackCommentSchema = createInsertSchema(feedbackComments, {
  content: z.string().min(1).max(1000),
  isInternal: z.boolean().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string(),
    mimetype: z.string(),
    size: z.number(),
  })).optional(),
});

export const selectFeedbackCommentSchema = createSelectSchema(feedbackComments);

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type FeedbackComment = typeof feedbackComments.$inferSelect;
export type NewFeedbackComment = typeof feedbackComments.$inferInsert;
export type FeedbackType = typeof feedbackTypeEnum[number];
export type FeedbackStatus = typeof feedbackStatusEnum[number];
export type FeedbackPriority = typeof feedbackPriorityEnum[number];
