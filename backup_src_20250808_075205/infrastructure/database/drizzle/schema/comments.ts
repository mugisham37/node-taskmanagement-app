import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { tasks } from './tasks';

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  attachments: jsonb('attachments').default([]),
  mentions: jsonb('mentions').default([]),
  reactions: jsonb('reactions').default({}),
  isEdited: boolean('is_edited').notNull().default(false),
  editedAt: timestamp('edited_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  taskCreatedAtIdx: index('comments_task_created_at_idx').on(table.taskId, table.createdAt),
  authorIdx: index('comments_author_idx').on(table.authorId),
  parentIdx: index('comments_parent_idx').on(table.parentId),
  mentionsIdx: index('comments_mentions_idx').on(table.mentions),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
  replies: many(comments),
}));

export const insertCommentSchema = createInsertSchema(comments, {
  content: z.string().min(1).max(2000),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string(),
    mimetype: z.string(),
    size: z.number(),
  })).optional(),
  mentions: z.array(z.string().uuid()).optional(),
  reactions: z.record(z.array(z.string().uuid())).optional(),
  isEdited: z.boolean().optional(),
});

export const selectCommentSchema = createSelectSchema(comments);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
