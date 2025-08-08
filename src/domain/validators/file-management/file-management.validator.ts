import * as z from 'zod';

// File upload validation schema
export const uploadFileSchema = z.object({
  workspaceId: z.string().uuid(),
  attachTo: z
    .object({
      type: z.enum(['task', 'comment', 'project']),
      id: z.string().uuid(),
    })
    .optional(),
  description: z.string().optional(),
  generateThumbnail: z.boolean().optional(),
  generatePreview: z.boolean().optional(),
  runVirusScan: z.boolean().optional(),
  compress: z.boolean().optional(),
  maxSize: z.number().positive().optional(),
  allowedMimeTypes: z.array(z.string()).optional(),
  customMetadata: z.record(z.any()).optional(),
  accessControl: z
    .object({
      isPublic: z.boolean().optional(),
      workspaceLevel: z.boolean().optional(),
      projectLevel: z.boolean().optional(),
      specificUsers: z
        .array(
          z.object({
            userId: z.string().uuid(),
            permissions: z.array(z.string()),
          })
        )
        .optional(),
    })
    .optional(),
});

// File download validation schema
export const downloadFileSchema = z.object({
  fileId: z.string().uuid(),
  version: z.number().positive().optional(),
  thumbnail: z.boolean().optional(),
  preview: z.boolean().optional(),
  range: z
    .object({
      start: z.number().nonnegative(),
      end: z.number().positive(),
    })
    .optional(),
});

// File search validation schema
export const searchFilesSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  mimeType: z.string().optional(),
  sizeRange: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().positive(),
    })
    .optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  fullTextSearch: z.string().optional(),
  limit: z.number().positive().max(100).default(20),
  offset: z.number().nonnegative().default(0),
});

// File version upload validation schema
export const uploadVersionSchema = z.object({
  changeDescription: z.string().optional(),
});

export class FileManagementValidator {
  static validateUploadFile(data: unknown) {
    return uploadFileSchema.parse(data);
  }

  static validateDownloadFile(data: unknown) {
    return downloadFileSchema.parse(data);
  }

  static validateSearchFiles(data: unknown) {
    return searchFilesSchema.parse(data);
  }

  static validateUploadVersion(data: unknown) {
    return uploadVersionSchema.parse(data);
  }
}
