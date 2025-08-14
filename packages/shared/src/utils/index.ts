// Export all utility modules
export * from './date.utils';
export * from './string.utils';
export * from './array.utils';
export * from './validation.utils';

// Legacy export for backward compatibility
export const formatDate = (date: Date): string => {
  return date.toISOString();
};