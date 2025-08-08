// Export all configuration modules
export { default as config } from './environment';
export {
  default as logger,
  stream,
  requestLogger,
  createRequestLogger,
  logPerformance,
  logDatabase,
  logAuth,
  logApiRequest,
  logSecurity,
  logBusiness,
} from './logger';
export {
  default as db,
  pool,
  testConnection,
  closeConnection,
  initializeDatabase,
  checkDatabaseHealth,
  executeRawQuery,
} from './database';
export {
  default as i18next,
  initI18n,
  i18nMiddleware,
  t,
  changeLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from './i18n';
export {
  default as swaggerSpec,
  setupSwagger,
  getSwaggerSpec,
} from './swagger';

// Export new enterprise configuration modules
export {
  getConfigurationManager,
  EnterpriseConfigurationManager,
} from './configuration-manager';
export {
  getFeatureFlagService,
  EnterpriseFeatureFlagService,
  isFeatureEnabled,
  getFeatureVariant,
  getAllFeatureFlags,
} from './feature-flags';
export {
  getServiceDiscovery,
  EnterpriseServiceDiscovery,
} from './service-discovery';

// Re-export types for convenience
export type { Request, Response, NextFunction } from 'express';
export type {
  Configuration,
  FeatureFlags,
  FeatureFlagContext,
} from './configuration-manager';
export type { ServiceEndpoint, ServiceHealth } from './service-discovery';
