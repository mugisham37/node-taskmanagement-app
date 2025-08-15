// Export all error handling components

export { ErrorBoundary, withErrorBoundary, useErrorHandler } from './error-boundary';
export { 
  ErrorFallback, 
  PageErrorFallback, 
  SectionErrorFallback, 
  ComponentErrorFallback 
} from './error-fallback';
export { ErrorDashboard } from './error-dashboard';
export type { ErrorFallbackProps } from './error-boundary';