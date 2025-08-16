/**
 * Disaster Recovery configuration
 */
export interface DisasterRecoveryConfig {
  /** Enable or disable disaster recovery */
  enabled: boolean;
  /** Primary site configuration */
  primarySite: SiteConfig;
  /** Secondary site configurations */
  secondarySites: SiteConfig[];
  /** Failover configuration */
  failover: FailoverPlan;
  /** Monitoring and alerting */
  monitoring: {
    enabled: boolean;
    checkInterval: number;
    healthCheckUrl?: string;
    alertThresholds: {
      rpo: number; // Recovery Point Objective in seconds
      rto: number; // Recovery Time Objective in seconds
      lagThreshold: number;
    };
  };
  /** Replication settings */
  replication: {
    mode: 'synchronous' | 'asynchronous';
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    batchSize: number;
    retryAttempts: number;
  };
}

/**
 * Site configuration for disaster recovery
 */
export interface SiteConfig {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'witness';
  location: string;
  connectionString: string;
  priority: number;
  isActive: boolean;
  lastHealthCheck?: Date;
  replicationLag?: number;
  status: 'healthy' | 'warning' | 'unhealthy' | 'unreachable';
}

/**
 * Failover plan configuration
 */
export interface FailoverPlan {
  id: string;
  name: string;
  automaticFailover: boolean;
  failoverTimeout: number;
  rollbackTimeout: number;
  preFailoverChecks: string[];
  postFailoverTasks: string[];
  notificationEndpoints: string[];
  requiredApprovals: number;
  steps: FailoverStep[];
}

/**
 * Individual failover step
 */
export interface FailoverStep {
  id: string;
  name: string;
  type: 'check' | 'action' | 'validation';
  command: string;
  timeout: number;
  retryAttempts: number;
  rollbackCommand?: string;
  critical: boolean;
  order: number;
}

/**
 * Disaster event information
 */
export interface DisasterEvent {
  id: string;
  type: 'outage' | 'corruption' | 'performance' | 'manual' | 'planned';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  affectedSites: string[];
  impactAssessment: {
    estimatedDowntime: number;
    affectedUsers: number;
    dataLoss: boolean;
    serviceImpact: string[];
  };
  response: {
    actions: string[];
    timeline: Array<{
      timestamp: Date;
      action: string;
      performer: string;
      notes: string;
    }>;
  };
}

/**
 * Disaster Recovery status
 */
export interface DRStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline';
  sites: Array<{
    siteId: string;
    status: 'active' | 'standby' | 'failed' | 'maintenance';
    replicationLag: number;
    lastUpdate: Date;
  }>;
  currentRPO: number;
  currentRTO: number;
  activeEvents: DisasterEvent[];
  lastFailoverTest?: Date;
  nextScheduledTest?: Date;
  metrics: {
    uptimePercentage: number;
    averageReplicationLag: number;
    failoverCount: number;
    lastMonthIncidents: number;
  };
}
