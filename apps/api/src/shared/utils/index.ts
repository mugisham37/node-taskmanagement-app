export { ValidationUtils } from '@taskmanagement/validation';
export { DateUtils } from './date-utils';
export { IdGenerator } from './id-generator';

// Enhanced utilities from older version migration
export { APIFeatures, createAPIFeatures, queryHelpers } from './api-features';
export {
  asyncHandler,
  asyncHandlerWithCircuitBreaker,
  asyncHandlerWithRetry,
  asyncHandlerWithTimeout,
  asyncMiddleware,
  composeAsyncHandlers,
  conditionalAsyncHandler,
} from './async-handler';
export {
  buildCacheKey,
  default as cache,
  del as cacheDel,
  flush as cacheFlush,
  get as cacheGet,
  getOrSet as cacheGetOrSet,
  memoize as cacheMemoize,
  set as cacheSet,
  closeCache,
  initializeCache,
  taggedCache,
  warmCache,
} from './cache';
export {
  clearMetrics,
  collectSystemMetrics,
  createTimer,
  getDetailedMetrics,
  getMetricsByEndpoint,
  getMetricsByTimeRange,
  getPerformanceStats,
  getSystemMetrics,
  performanceMonitor,
  profileFunction,
  startSystemMetricsCollection,
  trackMemoryUsage,
} from './performance-monitor';
export {
  ResponseBuilder,
  conflictResponse,
  createPaginationMeta,
  createResponseBuilder,
  createdResponse,
  errorResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  noContentResponse,
  notFoundResponse,
  notModifiedResponse,
  paginatedResponse,
  responseFormatter,
  successResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from './response-formatter';
// Note: Error classes are exported from shared/errors instead
export {
  ContextualError,
  ErrorAggregator,
  ErrorSeverity,
  catchAsync,
  createError,
  formatErrorForLogging,
  getErrorSeverity,
  normalizeError,
} from './app-error';
