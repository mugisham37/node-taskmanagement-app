import { z } from 'zod';

export interface ErrorResponseDto {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path: string;
  };
}

export interface ValidationErrorResponseDto extends ErrorResponseDto {
  error: ErrorResponseDto['error'] & {
    validationErrors: Array<{
      field: string;
      message: string;
      value?: any;
    }>;
  };
}

// Error response schemas for documentation
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
    timestamp: z.string(),
    path: z.string(),
  }),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
    timestamp: z.string(),
    path: z.string(),
    validationErrors: z.array(
      z.object({
        field: z.string(),
        message: z.string(),
        value: z.any().optional(),
      })
    ),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ValidationErrorResponse = z.infer<
  typeof ValidationErrorResponseSchema
>;
