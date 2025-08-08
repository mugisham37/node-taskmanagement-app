import * as z from 'zod';

// Create attachment validation schema
export const createAttachmentSchema = z.object({
  fileId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  attachedTo: z.enum(['task', 'comment', 'project']),
  attachedToId: z.string().uuid(),
  description: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

// Update attachment validation schema
export const updateAttachmentSchema = z.object({
  description: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

// Search attachments validation schema
export const searchAttachmentsSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  attachedTo: z.enum(['task', 'comment', 'project']).optional(),
  attachedToId: z.string().uuid().optional(),
  attachedBy: z.string().uuid().optional(),
  fileType: z.string().optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Reorder attachments validation schema
export const reorderAttachmentsSchema = z.object({
  attachmentIds: z.array(z.string().uuid()),
});

// Share attachment validation schema
export const shareAttachmentSchema = z.object({
  shareWith: z.array(
    z.object({
      userId: z.string().uuid().optional(),
      email: z.string().email().optional(),
      permissions: z.array(z.enum(['read', 'write', 'delete'])),
      expiresAt: z.string().datetime().optional(),
    })
  ),
  message: z.string().optional(),
});

// Preview options validation schema
export const previewOptionsSchema = z.object({
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
  quality: z.number().int().min(1).max(100).optional(),
});

export class AttachmentValidator {
  static validateCreateAttachment(data: unknown) {
    return createAttachmentSchema.parse(data);
  }

  static validateUpdateAttachment(data: unknown) {
    return updateAttachmentSchema.parse(data);
  }

  static validateSearchAttachments(data: unknown) {
    return searchAttachmentsSchema.parse(data);
  }

  static validateReorderAttachments(data: unknown) {
    return reorderAttachmentsSchema.parse(data);
  }

  static validateShareAttachment(data: unknown) {
    return shareAttachmentSchema.parse(data);
  }

  static validatePreviewOptions(data: unknown) {
    return previewOptionsSchema.parse(data);
  }
}
