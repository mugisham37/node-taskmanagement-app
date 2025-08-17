// Comprehensive Security Service
export { ComprehensiveSecurityService } from './comprehensive-security-service';
export type {
  AuthenticationResult,
  SecurityConfig,
  SecurityContext,
  SecurityValidationResult
} from './comprehensive-security-service';

// Security Headers Middleware
export { SecurityHeadersMiddleware } from './security-headers-middleware';
export type {
  CORSConfig,
  SecurityHeadersConfig
} from './security-headers-middleware';

// Vulnerability Scanner
export { VulnerabilityScanner } from './vulnerability-scanner';
export type {
  CodeRule,
  ConfigRule,
  ScanConfig,
  Vulnerability,
  VulnerabilityReport
} from './vulnerability-scanner';

// Compliance Manager
export { ComplianceManager } from './compliance-manager';
export type {
  ComplianceConfig,
  ComplianceEvidence,
  ComplianceFinding,
  ComplianceReport,
  ConsentStatus,
  DataProcessingActivity,
  DataSubject,
  PrivacyRequest,
  ThirdPartySharing
} from './compliance-manager';

// Security Configuration
export { SecurityConfigurationManager } from './security-config';
export type {
  ComprehensiveSecurityConfiguration,
  EscalationRule
} from './security-config';

