import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  json,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// File type enum
export const fileTypeEnum = pgEnum('file_type', [
  'image',
  'document',
  'spreadsheet',
  'presentation',
  'video',
  'audio',
  'archive',
  'other',
]);

// File status enum
export const fileStatusEnum = pgEnum('file_status', [
  'uploading',
  'processing',
  'ready',
  'error',
  'deleted',
]);

// File attachments table with metadata and versioning support
export const fileAttachments = pgTable(
  'file_attachments',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    filename: varchar('filename', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(), // Size in bytes
    type: fileTypeEnum('type').notNull(),
    status: fileStatusEnum('status').notNull().default('uploading'),
    url: text('url'),
    thumbnailUrl: text('thumbnail_url'),
    checksum: varchar('checksum', { length: 64 }).notNull(), // SHA-256 hash
    uploadedBy: varchar('uploaded_by', { length: 36 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 36 }),
    projectId: varchar('project_id', { length: 36 }),
    taskId: varchar('task_id', { length: 36 }),
    commentId: varchar('comment_id', { length: 36 }),
    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  table => ({
    // File identification and deduplication
    filenameIdx: index('idx_file_attachments_filename').on(table.filename),
    checksumIdx: index('idx_file_attachments_checksum').on(table.checksum),

    // User and workspace organization
    uploadedByIdx: index('idx_file_attachments_uploaded_by').on(
      table.uploadedBy,
      table.createdAt
    ),
    workspaceIdx: index('idx_file_attachments_workspace').on(
      table.workspaceId,
      table.createdAt
    ),

    // Entity associations
    projectIdx: index('idx_file_attachments_project').on(table.projectId),
    taskIdx: index('idx_file_attachments_task').on(table.taskId),
    commentIdx: index('idx_file_attachments_comment').on(table.commentId),

    // File type and status filtering
    typeIdx: index('idx_file_attachments_type').on(table.type),
    statusIdx: index('idx_file_attachments_status').on(table.status),
    typeStatusIdx: index('idx_file_attachments_type_status').on(
      table.type,
      table.status
    ),

    // MIME type filtering for file operations
    mimeTypeIdx: index('idx_file_attachments_mime_type').on(table.mimeType),

    // Size-based queries for storage management
    sizeIdx: index('idx_file_attachments_size').on(table.size),

    // Soft delete support
    deletedIdx: index('idx_file_attachments_deleted').on(table.deletedAt),
    activeFilesIdx: index('idx_file_attachments_active').on(
      table.status,
      table.deletedAt
    ),

    // Orphaned files cleanup (files not associated with any entity)
    orphanedFilesIdx: index('idx_file_attachments_orphaned').on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.commentId
    ),

    // Time-based queries for analytics and cleanup
    createdAtIdx: index('idx_file_attachments_created_at').on(table.createdAt),

    // Storage analytics by workspace and user
    workspaceStorageIdx: index('idx_file_attachments_workspace_storage').on(
      table.workspaceId,
      table.size,
      table.status
    ),
    userStorageIdx: index('idx_file_attachments_user_storage').on(
      table.uploadedBy,
      table.size,
      table.status
    ),

    // Ready files for serving
    readyFilesIdx: index('idx_file_attachments_ready').on(
      table.status,
      table.url
    ),
  })
);

// Relations
export const fileAttachmentsRelations = relations(
  fileAttachments,
  ({ one }) => ({
    uploader: one(users, {
      fields: [fileAttachments.uploadedBy],
      references: [users.id],
    }),
    workspace: one(workspaces, {
      fields: [fileAttachments.workspaceId],
      references: [workspaces.id],
    }),
    project: one(projects, {
      fields: [fileAttachments.projectId],
      references: [projects.id],
    }),
    task: one(tasks, {
      fields: [fileAttachments.taskId],
      references: [tasks.id],
    }),
  })
);

// Import other tables for relations
import { users } from './users';
import { workspaces } from './workspaces';
import { projects } from './projects';
import { tasks } from './tasks';