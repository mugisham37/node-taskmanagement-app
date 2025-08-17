/**
 * Comprehensive Security Configuration
 * 
 * Centralized configuration for all security measures and compliance requirements
 */

import { ComplianceConfig } from './compliance-manager';
import { SecurityConfig } from './comprehensive-security-service';
import { CORSConfig, SecurityHeadersConfig } from './security-headers-middleware';
import { ScanConfig } from './vulnerability-scanner';

export interface ComprehensiveSecurityConfiguration {
  // Environment
  environment: 'development' | 'staging' | 'production';
  
  // Core Security Service Configuration
  security: SecurityConfig;
  
  // Security Headers Configuration
  headers: SecurityHeadersConfig;
  
  // CORS Configuration
  cors: CORSConfig;
  
  // Vulnerability Scanning Configuration
  scanning: ScanConfig;
  
  // Compliance Configuration
  compliance: ComplianceConfig;
  
  // Additional Security Settings
  additional: {
    // Incident Response
    incidentResponse: {
      enabled: boolean;
      alertThreshold: 'low' | 'medium' | 'high' | 'critical';
      escalationRules: EscalationRule[];
      responseTeam: string[];
      automatedResponse: boolean;
    };
    
    // Security Training
    securityTraining: {
      enabled: boolean;
      mandatory: boolean;
      frequency: 'monthly' | 'quarterly' | 'annually';
      topics: string[];
      trackingEnabled: boolean;
    };
    
    // Penetration Testing
    penetrationTesting: {
      enabled: boolean;
      frequency: 'monthly' | 'quarterly' | 'annually';
      scope: string[];
      externalProvider?: string;
      reportRetention: number; // in days
    };
    
    // Security Metrics
    metrics: {
      enabled: boolean;
      dashboardUrl?: string;
      kpis: string[];
      reportingFrequency: 'daily' | 'weekly' | 'monthly';
    };
  };
}

export interface EscalationRule {
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalateTo: string[];
  timeoutMinutes: number;
  actions: string[];
}

/**
 * Default security configuration for different environments
 */
export class SecurityConfigurationManager {
  
  /**
   * Get development environment security configuration
   */
  static getDevelopmentConfig(): ComprehensiveSecurityConfiguration {
    return {
      environment: 'development',
      
      security: {
        jwt: {
          accessTokenExpiry: '15m',
          refreshTokenExpiry: '7d',
          issuer: 'taskmanagement-dev',
          audience: 'taskmanagement-app',
          algorithm: 'HS256',
          keyRotationInterval: 24, // hours
        },
        
        twoFactor: {
          enabled: true,
          mandatory: false,
          methods: ['totp', 'email'],
          backupCodesCount: 10,
          totpWindow: 1,
          emailProvider: 'smtp',
        },
        
        webauthn: {
          enabled: true,
          rpName: 'TaskManagement Dev',
          rpId: 'localhost',
          origin: 'http://localhost:3000',
          timeout: 60000,
          userVerification: 'preferred',
          attestation: 'none',
        },
        
        rbac: {
          enabled: true,
          hierarchical: true,
          multiTenant: true,
          permissionCaching: true,
          cacheExpiry: 300, // 5 minutes
        },
        
        encryption: {
          algorithm: 'aes-256-gcm',
          keyLength: 32,
          ivLength: 16,
          saltLength: 32,
          iterations: 100000,
          keyRotationInterval: 90, // days
        },
        
        headers: {
          contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:;",
          strictTransportSecurity: 'max-age=31536000; includeSubDomains',
          xFrameOptions: 'DENY',
          xContentTypeOptions: 'nosniff',
          referrerPolicy: 'strict-origin-when-cross-origin',
          permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
        },
        
        cors: {
          origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
          allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-API-Key'],
          exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
          credentials: true,
          maxAge: 86400,
        },
        
        rateLimit: {
          enabled: true,
          windowMs: 60000, // 1 minute
          maxRequests: 100,
          skipSuccessfulRequests: false,
          skipFailedRequests: false,
        },
        
        validation: {
          maxInputLength: 10000,
          allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
          maxFileSize: 10 * 1024 * 1024, // 10MB
          sanitizeHtml: true,
          preventXSS: true,
          preventSQLInjection: true,
        },
        
        audit: {
          enabled: true,
          logLevel: 'all',
          retention: 90, // days
          encryption: false,
          realTimeAlerts: false,
        },
        
        compliance: {
          gdpr: {
            enabled: true,
            dataRetention: 365,
            rightToErasure: true,
            dataPortability: true,
            consentManagement: true,
          },
          soc2: {
            enabled: false,
            accessControls: true,
            systemMonitoring: true,
            logicalAccess: true,
            systemOperations: true,
          },
        },
        
        vulnerability: {
          enabled: true,
          scanInterval: 24, // hours
          autoRemediation: false,
          alertThreshold: 'medium',
        },
      },
      
      headers: {
        csp: {
          enabled: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            childSrc: ["'self'"],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: false, // Allow HTTP in development
            blockAllMixedContent: false,
          },
          reportOnly: false,
        },
        
        hsts: {
          enabled: false, // Disabled for HTTP development
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false,
        },
        
        frameOptions: {
          enabled: true,
          policy: 'DENY',
        },
        
        contentTypeOptions: {
          enabled: true,
          nosniff: true,
        },
        
        referrerPolicy: {
          enabled: true,
          policy: 'strict-origin-when-cross-origin',
        },
        
        permissionsPolicy: {
          enabled: true,
          directives: {
            camera: [],
            microphone: [],
            geolocation: [],
            notifications: ["'self'"],
            payment: [],
            usb: [],
            bluetooth: [],
            accelerometer: [],
            gyroscope: [],
            magnetometer: [],
            fullscreen: ["'self'"],
            autoplay: [],
            encryptedMedia: [],
            pictureInPicture: [],
          },
        },
        
        coep: {
          enabled: false, // Can cause issues in development
          policy: 'unsafe-none',
        },
        
        coop: {
          enabled: false, // Can cause issues in development
          policy: 'unsafe-none',
        },
        
        corp: {
          enabled: false, // Can cause issues in development
          policy: 'cross-origin',
        },
        
        additional: {
          xXssProtection: true,
          xDnsPrefetchControl: true,
          xDownloadOptions: true,
          xPermittedCrossDomainPolicies: true,
        },
      },
      
      cors: {
        enabled: true,
        origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-API-Key'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        credentials: true,
        maxAge: 86400,
        preflightContinue: false,
        optionsSuccessStatus: 204,
        dynamic: false,
        trustedDomains: [],
        origins: {
          development: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
          staging: [],
          production: [],
        },
      },
      
      scanning: {
        dependencies: {
          enabled: true,
          includeDevDependencies: true,
          excludePackages: [],
          severityThreshold: 'medium',
          autoUpdate: false,
          sources: ['npm', 'github'],
        },
        
        configuration: {
          enabled: true,
          checkSecurityHeaders: true,
          checkCORS: true,
          checkAuthentication: true,
          checkEncryption: true,
          checkLogging: true,
          customRules: [],
        },
        
        code: {
          enabled: true,
          staticAnalysis: true,
          secretScanning: true,
          sqlInjectionCheck: true,
          xssCheck: true,
          pathTraversalCheck: true,
          excludePaths: ['node_modules', 'dist', 'build'],
          customRules: [],
        },
        
        infrastructure: {
          enabled: false, // Simplified for development
          dockerImages: false,
          kubernetesConfigs: false,
          cloudResources: false,
          networkSecurity: false,
          accessControls: true,
        },
        
        schedule: {
          enabled: true,
          frequency: 'daily',
          time: '02:00',
          timezone: 'UTC',
        },
        
        notifications: {
          enabled: true,
          channels: ['email'],
          severityThreshold: 'medium',
          recipients: ['security@example.com'],
        },
      },
      
      compliance: {
        gdpr: {
          enabled: true,
          dataRetentionPeriod: 365,
          rightToErasure: true,
          rightToPortability: true,
          rightToRectification: true,
          rightToRestriction: true,
          consentManagement: true,
          dataProcessingBasis: ['consent', 'legitimate_interests'],
          dpoContact: 'dpo@example.com',
          supervisoryAuthority: 'Local DPA',
          breachNotificationPeriod: 72,
          dataMinimization: true,
          pseudonymization: true,
          encryption: true,
        },
        
        soc2: {
          enabled: false,
          trustServicesCriteria: ['security'],
          accessControls: true,
          systemMonitoring: true,
          logicalAccess: true,
          systemOperations: true,
          changeManagement: true,
          riskAssessment: true,
          vendorManagement: false,
          businessContinuity: false,
          incidentResponse: true,
        },
        
        iso27001: {
          enabled: false,
          informationSecurityPolicy: true,
          riskManagement: true,
          assetManagement: true,
          accessControl: true,
          cryptography: true,
          physicalSecurity: false,
          operationsSecurity: true,
          communicationsSecurity: true,
          systemAcquisition: true,
          supplierRelationships: false,
          incidentManagement: true,
          businessContinuity: false,
          compliance: true,
        },
        
        hipaa: {
          enabled: false,
          safeguards: [],
          minimumNecessary: false,
          businessAssociateAgreements: false,
          breachNotification: false,
          auditControls: false,
          integrityControls: false,
          transmissionSecurity: false,
        },
        
        pciDss: {
          enabled: false,
          requirements: [],
          cardholderDataEnvironment: false,
          networkSecurity: false,
          vulnerabilityManagement: false,
          accessControl: false,
          monitoring: false,
          informationSecurity: false,
        },
        
        general: {
          auditRetention: 7, // years
          reportingFrequency: 'monthly',
          automaticReporting: false,
          complianceOfficer: 'compliance@example.com',
          certificationRenewal: new Date('2025-12-31'),
        },
      },
      
      additional: {
        incidentResponse: {
          enabled: true,
          alertThreshold: 'medium',
          escalationRules: [
            {
              condition: 'critical_vulnerability_detected',
              severity: 'critical',
              escalateTo: ['security-team@example.com'],
              timeoutMinutes: 15,
              actions: ['notify', 'create_ticket'],
            },
          ],
          responseTeam: ['security@example.com', 'dev-team@example.com'],
          automatedResponse: false,
        },
        
        securityTraining: {
          enabled: true,
          mandatory: false,
          frequency: 'quarterly',
          topics: ['secure_coding', 'phishing_awareness', 'data_protection'],
          trackingEnabled: false,
        },
        
        penetrationTesting: {
          enabled: false,
          frequency: 'annually',
          scope: ['web_application', 'api'],
          reportRetention: 365,
        },
        
        metrics: {
          enabled: true,
          kpis: ['vulnerability_count', 'incident_response_time', 'compliance_score'],
          reportingFrequency: 'weekly',
        },
      },
    };
  }
  
  /**
   * Get production environment security configuration
   */
  static getProductionConfig(): ComprehensiveSecurityConfiguration {
    const devConfig = this.getDevelopmentConfig();
    
    return {
      ...devConfig,
      environment: 'production',
      
      security: {
        ...devConfig.security,
        
        jwt: {
          ...devConfig.security.jwt,
          algorithm: 'RS256', // Use asymmetric encryption in production
          keyRotationInterval: 12, // More frequent rotation
        },
        
        twoFactor: {
          ...devConfig.security.twoFactor,
          mandatory: true, // Mandatory 2FA in production
          methods: ['totp', 'webauthn', 'sms'],
        },
        
        webauthn: {
          ...devConfig.security.webauthn,
          rpId: 'taskmanagement.com',
          origin: 'https://taskmanagement.com',
          userVerification: 'required',
          attestation: 'direct',
        },
        
        encryption: {
          ...devConfig.security.encryption,
          keyRotationInterval: 30, // More frequent key rotation
        },
        
        headers: {
          ...devConfig.security.headers,
          contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;",
        },
        
        cors: {
          ...devConfig.security.cors,
          origin: ['https://taskmanagement.com', 'https://admin.taskmanagement.com'],
        },
        
        rateLimit: {
          ...devConfig.security.rateLimit,
          maxRequests: 60, // Stricter rate limiting
        },
        
        audit: {
          ...devConfig.security.audit,
          encryption: true,
          realTimeAlerts: true,
        },
        
        vulnerability: {
          ...devConfig.security.vulnerability,
          scanInterval: 12, // More frequent scanning
          autoRemediation: true,
          alertThreshold: 'low',
        },
      },
      
      headers: {
        ...devConfig.headers,
        
        csp: {
          ...devConfig.headers.csp,
          directives: {
            ...devConfig.headers.csp.directives,
            scriptSrc: ["'self'"], // No unsafe-inline in production
            upgradeInsecureRequests: true,
            blockAllMixedContent: true,
          },
        },
        
        hsts: {
          enabled: true,
          maxAge: 63072000, // 2 years
          includeSubDomains: true,
          preload: true,
        },
        
        coep: {
          enabled: true,
          policy: 'require-corp',
        },
        
        coop: {
          enabled: true,
          policy: 'same-origin',
        },
        
        corp: {
          enabled: true,
          policy: 'same-origin',
        },
      },
      
      cors: {
        ...devConfig.cors,
        origin: ['https://taskmanagement.com', 'https://admin.taskmanagement.com'],
        origins: {
          development: [],
          staging: ['https://staging.taskmanagement.com'],
          production: ['https://taskmanagement.com', 'https://admin.taskmanagement.com'],
        },
      },
      
      scanning: {
        ...devConfig.scanning,
        
        dependencies: {
          ...devConfig.scanning.dependencies,
          includeDevDependencies: false,
          severityThreshold: 'low',
          autoUpdate: true,
          sources: ['npm', 'snyk', 'github', 'osv'],
        },
        
        infrastructure: {
          enabled: true,
          dockerImages: true,
          kubernetesConfigs: true,
          cloudResources: true,
          networkSecurity: true,
          accessControls: true,
        },
        
        schedule: {
          ...devConfig.scanning.schedule,
          frequency: 'hourly',
        },
        
        notifications: {
          ...devConfig.scanning.notifications,
          channels: ['email', 'slack', 'webhook'],
          severityThreshold: 'low',
        },
      },
      
      compliance: {
        ...devConfig.compliance,
        
        soc2: {
          ...devConfig.compliance.soc2,
          enabled: true,
          trustServicesCriteria: ['security', 'availability', 'confidentiality'],
          vendorManagement: true,
          businessContinuity: true,
        },
        
        iso27001: {
          ...devConfig.compliance.iso27001,
          enabled: true,
          physicalSecurity: true,
          supplierRelationships: true,
          businessContinuity: true,
        },
        
        general: {
          ...devConfig.compliance.general,
          automaticReporting: true,
          externalAuditor: 'External Audit Firm',
        },
      },
      
      additional: {
        ...devConfig.additional,
        
        incidentResponse: {
          ...devConfig.additional.incidentResponse,
          alertThreshold: 'low',
          automatedResponse: true,
          escalationRules: [
            {
              condition: 'critical_vulnerability_detected',
              severity: 'critical',
              escalateTo: ['security-team@example.com', 'ciso@example.com'],
              timeoutMinutes: 5,
              actions: ['notify', 'create_ticket', 'auto_patch'],
            },
            {
              condition: 'data_breach_suspected',
              severity: 'critical',
              escalateTo: ['legal@example.com', 'ciso@example.com', 'ceo@example.com'],
              timeoutMinutes: 10,
              actions: ['notify', 'isolate_systems', 'legal_review'],
            },
          ],
        },
        
        securityTraining: {
          ...devConfig.additional.securityTraining,
          mandatory: true,
          trackingEnabled: true,
        },
        
        penetrationTesting: {
          ...devConfig.additional.penetrationTesting,
          enabled: true,
          frequency: 'quarterly',
          externalProvider: 'Professional Security Firm',
        },
        
        metrics: {
          ...devConfig.additional.metrics,
          dashboardUrl: 'https://security-dashboard.taskmanagement.com',
          reportingFrequency: 'daily',
        },
      },
    };
  }
  
  /**
   * Get staging environment security configuration
   */
  static getStagingConfig(): ComprehensiveSecurityConfiguration {
    const prodConfig = this.getProductionConfig();
    
    return {
      ...prodConfig,
      environment: 'staging',
      
      security: {
        ...prodConfig.security,
        
        twoFactor: {
          ...prodConfig.security.twoFactor,
          mandatory: false, // Optional in staging
        },
        
        cors: {
          ...prodConfig.security.cors,
          origin: ['https://staging.taskmanagement.com', 'https://staging-admin.taskmanagement.com'],
        },
        
        audit: {
          ...prodConfig.security.audit,
          retention: 30, // Shorter retention in staging
        },
      },
      
      cors: {
        ...prodConfig.cors,
        origin: ['https://staging.taskmanagement.com', 'https://staging-admin.taskmanagement.com'],
      },
      
      scanning: {
        ...prodConfig.scanning,
        
        schedule: {
          ...prodConfig.scanning.schedule,
          frequency: 'daily',
        },
      },
      
      additional: {
        ...prodConfig.additional,
        
        penetrationTesting: {
          ...prodConfig.additional.penetrationTesting,
          frequency: 'monthly',
        },
      },
    };
  }
  
  /**
   * Get configuration for current environment
   */
  static getCurrentConfig(): ComprehensiveSecurityConfiguration {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return this.getProductionConfig();
      case 'staging':
        return this.getStagingConfig();
      case 'development':
      default:
        return this.getDevelopmentConfig();
    }
  }
}