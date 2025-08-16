import { z } from 'zod';

/**
 * Common validation schemas used across the application
 */

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date range schema
export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Start date must be before end date',
  path: ['endDate'],
});

// Search schema
export const SearchSchema = z.object({
  query: z.string().min(1).max(255),
  filters: z.record(z.any()).optional(),
});

// ID parameter schema
export const IdParamsSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// Bulk operation schema
export const BulkOperationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  operation: z.string().min(1),
  data: z.record(z.any()).optional(),
});

// File upload schema
export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().min(1),
  size: z.number().min(1).max(50 * 1024 * 1024), // 50MB max
  buffer: z.instanceof(Buffer).optional(),
});

// Multiple file upload schema
export const MultipleFileUploadSchema = z.object({
  files: z.array(FileUploadSchema).min(1).max(10),
});

// Color schema (hex color)
export const ColorSchema = z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format');

// URL schema
export const UrlSchema = z.string().url('Invalid URL format');

// Email schema
export const EmailSchema = z.string().email('Invalid email format').toLowerCase().trim();

// Phone number schema
export const PhoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]{10,}$/, 'Invalid phone number format');

// Slug schema
export const SlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must not exceed 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .refine(slug => !slug.startsWith('-') && !slug.endsWith('-'), {
    message: 'Slug cannot start or end with a hyphen',
  });

// Tag schema
export const TagSchema = z
  .string()
  .min(1, 'Tag cannot be empty')
  .max(50, 'Tag must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Tag can only contain letters, numbers, spaces, hyphens, and underscores')
  .trim();

// Tags array schema
export const TagsSchema = z.array(TagSchema).max(20, 'Maximum 20 tags allowed');

// Timezone schema
export const TimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid timezone' }
);

// Language code schema (ISO 639-1)
export const LanguageCodeSchema = z.string().length(2, 'Language code must be 2 characters').toLowerCase();

// Currency code schema (ISO 4217)
export const CurrencyCodeSchema = z.string().length(3, 'Currency code must be 3 characters').toUpperCase();

// Coordinates schema
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Address schema
export const AddressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2, 'Country code must be 2 characters').toUpperCase(),
  coordinates: CoordinatesSchema.optional(),
});

// Social media links schema
export const SocialLinksSchema = z.object({
  website: UrlSchema.optional(),
  linkedin: UrlSchema.optional(),
  twitter: UrlSchema.optional(),
  github: UrlSchema.optional(),
  facebook: UrlSchema.optional(),
  instagram: UrlSchema.optional(),
});

// Notification preferences schema
export const NotificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  sms: z.boolean().default(false),
  inApp: z.boolean().default(true),
  digest: z.enum(['NEVER', 'DAILY', 'WEEKLY', 'MONTHLY']).default('WEEKLY'),
});

// Privacy settings schema
export const PrivacySettingsSchema = z.object({
  profileVisibility: z.enum(['PUBLIC', 'PRIVATE', 'CONTACTS_ONLY']).default('PUBLIC'),
  showEmail: z.boolean().default(false),
  showPhone: z.boolean().default(false),
  allowDirectMessages: z.boolean().default(true),
  allowNotifications: z.boolean().default(true),
});

// API key schema
export const ApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

// Webhook schema
export const WebhookSchema = z.object({
  url: UrlSchema,
  events: z.array(z.string()).min(1),
  secret: z.string().min(8).max(100).optional(),
  active: z.boolean().default(true),
});

// Rate limit schema
export const RateLimitSchema = z.object({
  requests: z.number().min(1).max(10000),
  window: z.number().min(1).max(86400), // 1 second to 24 hours
  burst: z.number().min(1).optional(),
});

// Type exports
export type Pagination = z.infer<typeof PaginationSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type Search = z.infer<typeof SearchSchema>;
export type IdParams = z.infer<typeof IdParamsSchema>;
export type BulkOperation = z.infer<typeof BulkOperationSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
export type MultipleFileUpload = z.infer<typeof MultipleFileUploadSchema>;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type SocialLinks = z.infer<typeof SocialLinksSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type Webhook = z.infer<typeof WebhookSchema>;
export type RateLimit = z.infer<typeof RateLimitSchema>;