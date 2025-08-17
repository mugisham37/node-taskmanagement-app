import { Logger } from 'winston';
import { SecurityIncident, SecurityIncidentType, SecuritySeverity } from './incident-detection';

export interface IncidentResponse {
  id: string;
  incidentId: string;
  responseType: ResponseType;
  status: ResponseStatus;
  startedAt: Date;
  completedAt?: Date;
  executedBy: string;
  actions: ResponseAction[];
  result: ResponseResult;
  metadata: Record<string, any>;
}

export enum ResponseType {
  AUTOMATED = 'automated',
  MANUAL = 'manual',
  HYBRID = 'hybrid'
}

export enum ResponseStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ResponseAction {
  id: string;
  type: ActionType;
  description: string;
  executedAt: Date;
  status: ActionStatus;
  result?: any;
  error?: string;
}

export enum ActionType {
  BLOCK_IP = 'block_ip',
  DISABLE_USER = 'disable_user',
  REVOKE_TOKENS = 'revoke_tokens',
  QUARANTINE_FILE = 'quarantine_file',
  ISOLATE_SYSTEM = 'isolate_system',
  COLLECT_EVIDENCE = 'collect_evidence',
  NOTIFY_STAKEHOLDERS = 'notify_stakeholders',
  PATCH_VULNERABILITY = 'patch_vulnerability',
  RESET_CREDENTIALS = 'reset_credentials',
  ENABLE_MONITORING = 'enable_monitoring',
  BACKUP_DATA = 'backup_data',
  RESTORE_SERVICE = 'restore_service'
}

export enum ActionStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface ResponseResult {
  success: boolean;
  message: string;
  actionsExecuted: number;
  actionsFailed: number;
  evidence: EvidenceItem[];
  recommendations: string[];
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  description: string;
  collectedAt: Date;
  data: any;
  hash: string;
}

export enum EvidenceType {
  LOG_ENTRY = 'log_entry',
  NETWORK_TRAFFIC = 'network_traffic',
  FILE_SYSTEM = 'file_system',
  MEMORY_DUMP = 'memory_dump',
  DATABASE_RECORD = 'database_record',
  SCREENSHOT = 'screenshot',
  CONFIGURATION = 'configuration'
}

export interface ResponsePlaybook {
  id: string;
  name: string;
  incidentTypes: SecurityIncidentType[];
  severity: SecuritySeverity[];
  actions: PlaybookAction[];
  enabled: boolean;
  description: string;
}

export interface PlaybookAction {
  id: string;
  type: ActionType;
  description: string;
  automated: boolean;
  condition?: string;
  parameters: Record<string, any>;
  order: number;
  timeout: number;
  retries: number;
}

export class SecurityIncidentResponseSystem {
  private playbooks: Map<string, ResponsePlaybook> = new Map();
  private activeResponses: Map<string, IncidentResponse> = new Map();

  constructor(
    private logger: Logger,
    private actionExecutor: ResponseActionExecutor,
    private evidenceCollector: EvidenceCollector
  ) {
    this.loadDefaultPlaybooks();
  }

  private loadDefaultPlaybooks(): void {
    const defaultPlaybooks: ResponsePlaybook[] = [
      {
        id: 'brute_force_response',
        name: 'Brute Force Attack Response',
        incidentTypes: [SecurityIncidentType.AUTHENTICATION_FAILURE],
        severity: [SecuritySeverity.HIGH, SecuritySeverity.CRITICAL],
        actions: [
          {
            id: 'block_ip',
            type: ActionType.BLOCK_IP,
            description: 'Block attacking IP address',
            automated: true,
            parameters: { duration: 3600 },
            order: 1,
            timeout: 30,
            retries: 3
          },
          {
            id: 'collect_logs',
            type: ActionType.COLLECT_EVIDENCE,
            description: 'Collect authentication logs',
            automated: true,
            parameters: { timeRange: 3600, logTypes: ['auth', 'access'] },
            order: 2,
            timeout: 60,
            retries: 2
          },
          {
            id: 'notify_security',
            type: ActionType.NOTIFY_STAKEHOLDERS,
            description: 'Notify security team',
            automated: true,
            parameters: { channels: ['email', 'slack'] },
            order: 3,
            timeout: 10,
            retries: 1
          }
        ],
        enabled: true,
        description: 'Automated response to brute force attacks'
      },
      {
        id: 'sql_injection_response',
        name: 'SQL Injection Response',
        incidentTypes: [SecurityIncidentType.SQL_INJECTION],
        severity: [SecuritySeverity.CRITICAL],
        actions: [
          {
            id: 'block_request',
            type: ActionType.BLOCK_IP,
            description: 'Block malicious requests',
            automated: true,
            parameters: { immediate: true },
            order: 1,
            timeout: 10,
            retries: 1
          },
          {
            id: 'collect_request_data',
            type: ActionType.COLLECT_EVIDENCE,
            description: 'Collect request data and logs',
            automated: true,
            parameters: { includePayload: true },
            order: 2,
            timeout: 30,
            retries: 2
          },
          {
            id: 'check_database',
            type: ActionType.COLLECT_EVIDENCE,
            description: 'Check database for unauthorized access',
            automated: false,
            parameters: { scanTables: true },
            order: 3,
            timeout: 300,
            retries: 1
          },
          {
            id: 'emergency_notification',
            type: ActionType.NOTIFY_STAKEHOLDERS,
            description: 'Send emergency notification',
            automated: true,
            parameters: { priority: 'critical', channels: ['email', 'sms', 'pagerduty'] },
            order: 4,
            timeout: 15,
            retries: 3
          }
        ],
        enabled: true,
        description: 'Critical response to SQL injection attempts'
      },
      {
        id: 'privilege_escalation_response',
        name: 'Privilege Escalation Response',
        incidentTypes: [SecurityIncidentType.PRIVILEGE_ESCALATION],
        severity: [SecuritySeverity.HIGH, SecuritySeverity.CRITICAL],
        actions: [
          {
            id: 'disable_user',
            type: ActionType.DISABLE_USER,
            description: 'Disable user account',
            automated: true,
            parameters: { immediate: true },
            order: 1,
            timeout: 30,
            retries: 2
          },
          {
            id: 'revoke_tokens',
            type: ActionType.REVOKE_TOKENS,
            description: 'Revoke all user tokens',
            automated: true,
            parameters: { allSessions: true },
            order: 2,
            timeout: 30,
            retries: 2
          },
          {
            id: 'audit_permissions',
            type: ActionType.COLLECT_EVIDENCE,
            description: 'Audit user permissions and access',
            automated: true,
            parameters: { fullAudit: true },
            order: 3,
            timeout: 120,
            retries: 1
          },
          {
            id: 'notify_admin',
            type: ActionType.NOTIFY_STAKEHOLDERS,
            description: 'Notify administrators',
            automated: true,
            parameters: { urgency: 'high' },
            order: 4,
            timeout: 10,
            retries: 2
          }
        ],
        enabled: true,
        description: 'Response to privilege escalation attempts'
      },
      {
        id: 'ddos_response',
        name: 'DDoS Attack Response',
        incidentTypes: [SecurityIncidentType.DDOS_ATTACK],
        severity: [SecuritySeverity.HIGH, SecuritySeverity.CRITICAL],
        actions: [
          {
            id: 'enable_rate_limiting',
            type: ActionType.ENABLE_MONITORING,
            description: 'Enable aggressive rate limiting',
            automated: true,
            parameters: { mode: 'aggressive' },
            order: 1,
            timeout: 30,
            retries: 2
          },
          {
            id: 'block_attack_ips',
            type: ActionType.BLOCK_IP,
            description: 'Block attacking IP ranges',
            automated: true,
            parameters: { bulkBlock: true },
            order: 2,
            timeout: 60,
            retries: 3
          },
          {
            id: 'scale_infrastructure',
            type: ActionType.RESTORE_SERVICE,
            description: 'Scale infrastructure to handle load',
            automated: false,
            parameters: { autoScale: true },
            order: 3,
            timeout: 300,
            retries: 1
          },
          {
            id: 'notify_ops_team',
            type: ActionType.NOTIFY_STAKEHOLDERS,
            description: 'Notify operations team',
            automated: true,
            parameters: { team: 'operations' },
            order: 4,
            timeout: 10,
            retries: 2
          }
        ],
        enabled: true,
        description: 'Response to DDoS attacks'
      }
    ];

    defaultPlaybooks.forEach(playbook => this.addPlaybook(playbook));
  }

  public addPlaybook(playbook: ResponsePlaybook): void {
    this.playbooks.set(playbook.id, playbook);
    this.logger.info('Response playbook added', { 
      playbookId: playbook.id, 
      name: playbook.name 
    });
  }

  public async respondToIncident(incident: SecurityIncident): Promise<IncidentResponse> {
    const playbook = this.findMatchingPlaybook(incident);
    
    if (!playbook) {
      this.logger.warn('No matching playbook found for incident', {
        incidentId: incident.id,
        type: incident.type,
        severity: incident.severity
      });
      return this.createManualResponse(incident);
    }

    const response: IncidentResponse = {
      id: this.generateResponseId(),
      incidentId: incident.id,
      responseType: ResponseType.AUTOMATED,
      status: ResponseStatus.PENDING,
      startedAt: new Date(),
      executedBy: 'system',
      actions: [],
      result: {
        success: false,
        message: '',
        actionsExecuted: 0,
        actionsFailed: 0,
        evidence: [],
        recommendations: []
      },
      metadata: {
        playbookId: playbook.id,
        playbookName: playbook.name
      }
    };

    this.activeResponses.set(response.id, response);

    try {
      await this.executePlaybook(playbook, incident, response);
    } catch (error) {
      this.logger.error('Error executing incident response', {
        responseId: response.id,
        incidentId: incident.id,
        error: error.message
      });
      response.status = ResponseStatus.FAILED;
      response.result.message = `Response execution failed: ${error.message}`;
    }

    response.completedAt = new Date();
    return response;
  }

  private findMatchingPlaybook(incident: SecurityIncident): ResponsePlaybook | null {
    for (const playbook of this.playbooks.values()) {
      if (!playbook.enabled) continue;

      const typeMatch = playbook.incidentTypes.includes(incident.type);
      const severityMatch = playbook.severity.includes(incident.severity);

      if (typeMatch && severityMatch) {
        return playbook;
      }
    }

    return null;
  }

  private async executePlaybook(
    playbook: ResponsePlaybook, 
    incident: SecurityIncident, 
    response: IncidentResponse
  ): Promise<void> {
    response.status = ResponseStatus.IN_PROGRESS;

    // Sort actions by order
    const sortedActions = [...playbook.actions].sort((a, b) => a.order - b.order);

    for (const playbookAction of sortedActions) {
      const action: ResponseAction = {
        id: this.generateActionId(),
        type: playbookAction.type,
        description: playbookAction.description,
        executedAt: new Date(),
        status: ActionStatus.PENDING
      };

      response.actions.push(action);

      try {
        // Check if action should be executed based on conditions
        if (playbookAction.condition && !this.evaluateCondition(playbookAction.condition, incident)) {
          action.status = ActionStatus.SKIPPED;
          continue;
        }

        action.status = ActionStatus.EXECUTING;

        // Execute the action
        const result = await this.executeAction(playbookAction, incident);
        action.result = result;
        action.status = ActionStatus.COMPLETED;
        response.result.actionsExecuted++;

        this.logger.info('Response action completed', {
          responseId: response.id,
          actionId: action.id,
          type: action.type
        });

      } catch (error) {
        action.status = ActionStatus.FAILED;
        action.error = error.message;
        response.result.actionsFailed++;

        this.logger.error('Response action failed', {
          responseId: response.id,
          actionId: action.id,
          type: action.type,
          error: error.message
        });

        // Continue with other actions unless it's a critical failure
        if (playbookAction.type === ActionType.ISOLATE_SYSTEM) {
          throw error; // Stop execution for critical failures
        }
      }
    }

    // Collect evidence
    const evidence = await this.evidenceCollector.collectEvidence(incident);
    response.result.evidence = evidence;

    // Generate recommendations
    response.result.recommendations = this.generateRecommendations(incident, response);

    // Determine overall success
    response.result.success = response.result.actionsFailed === 0;
    response.status = response.result.success ? ResponseStatus.COMPLETED : ResponseStatus.FAILED;
    
    if (response.result.success) {
      response.result.message = `Successfully executed ${response.result.actionsExecuted} actions`;
    } else {
      response.result.message = `Executed ${response.result.actionsExecuted} actions, ${response.result.actionsFailed} failed`;
    }
  }

  private async executeAction(action: PlaybookAction, incident: SecurityIncident): Promise<any> {
    const context = {
      incident,
      parameters: action.parameters,
      timeout: action.timeout,
      retries: action.retries
    };

    return await this.actionExecutor.execute(action.type, context);
  }

  private evaluateCondition(condition: string, incident: SecurityIncident): boolean {
    // Simple condition evaluation - in production, use a proper expression evaluator
    try {
      // Replace incident properties in condition
      const evaluatedCondition = condition
        .replace(/incident\.severity/g, `"${incident.severity}"`)
        .replace(/incident\.type/g, `"${incident.type}"`)
        .replace(/incident\.source/g, `"${incident.source}"`);

      return eval(evaluatedCondition);
    } catch (error) {
      this.logger.error('Error evaluating condition', { condition, error: error.message });
      return false;
    }
  }

  private createManualResponse(incident: SecurityIncident): IncidentResponse {
    return {
      id: this.generateResponseId(),
      incidentId: incident.id,
      responseType: ResponseType.MANUAL,
      status: ResponseStatus.PENDING,
      startedAt: new Date(),
      executedBy: 'manual',
      actions: [],
      result: {
        success: false,
        message: 'Manual response required - no matching playbook found',
        actionsExecuted: 0,
        actionsFailed: 0,
        evidence: [],
        recommendations: [
          'Review incident details and determine appropriate response',
          'Consider creating a playbook for this incident type',
          'Escalate to security team for manual investigation'
        ]
      },
      metadata: {
        requiresManualIntervention: true
      }
    };
  }

  private generateRecommendations(incident: SecurityIncident, response: IncidentResponse): string[] {
    const recommendations: string[] = [];

    // Base recommendations based on incident type
    switch (incident.type) {
      case SecurityIncidentType.AUTHENTICATION_FAILURE:
        recommendations.push(
          'Review authentication logs for patterns',
          'Consider implementing additional rate limiting',
          'Evaluate multi-factor authentication requirements'
        );
        break;
      case SecurityIncidentType.SQL_INJECTION:
        recommendations.push(
          'Review and update input validation',
          'Audit database permissions',
          'Consider implementing prepared statements',
          'Review web application firewall rules'
        );
        break;
      case SecurityIncidentType.PRIVILEGE_ESCALATION:
        recommendations.push(
          'Conduct full security audit of user permissions',
          'Review role-based access control implementation',
          'Implement principle of least privilege',
          'Consider additional monitoring for privilege changes'
        );
        break;
      case SecurityIncidentType.DDOS_ATTACK:
        recommendations.push(
          'Review DDoS protection mechanisms',
          'Consider implementing CDN with DDoS protection',
          'Evaluate auto-scaling capabilities',
          'Review rate limiting configurations'
        );
        break;
    }

    // Add severity-based recommendations
    if (incident.severity === SecuritySeverity.CRITICAL) {
      recommendations.push(
        'Conduct immediate security review',
        'Consider engaging external security experts',
        'Review and update incident response procedures'
      );
    }

    // Add recommendations based on response results
    if (response.result.actionsFailed > 0) {
      recommendations.push(
        'Review failed response actions',
        'Update response playbooks based on failures',
        'Consider manual intervention for failed actions'
      );
    }

    return recommendations;
  }

  private generateResponseId(): string {
    return `RESP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getResponse(responseId: string): IncidentResponse | undefined {
    return this.activeResponses.get(responseId);
  }

  public getActiveResponses(): IncidentResponse[] {
    return Array.from(this.activeResponses.values()).filter(
      response => response.status === ResponseStatus.IN_PROGRESS || 
                 response.status === ResponseStatus.PENDING
    );
  }

  public getResponsesByIncident(incidentId: string): IncidentResponse[] {
    return Array.from(this.activeResponses.values()).filter(
      response => response.incidentId === incidentId
    );
  }
}

export class ResponseActionExecutor {
  constructor(
    private logger: Logger,
    private securityServices: SecurityServices
  ) {}

  public async execute(actionType: ActionType, context: any): Promise<any> {
    switch (actionType) {
      case ActionType.BLOCK_IP:
        return await this.blockIP(context);
      case ActionType.DISABLE_USER:
        return await this.disableUser(context);
      case ActionType.REVOKE_TOKENS:
        return await this.revokeTokens(context);
      case ActionType.COLLECT_EVIDENCE:
        return await this.collectEvidence(context);
      case ActionType.NOTIFY_STAKEHOLDERS:
        return await this.notifyStakeholders(context);
      case ActionType.ENABLE_MONITORING:
        return await this.enableMonitoring(context);
      default:
        throw new Error(`Unsupported action type: ${actionType}`);
    }
  }

  private async blockIP(context: any): Promise<any> {
    const { incident, parameters } = context;
    const ipAddress = incident.metadata.triggerEvent?.ipAddress;
    
    if (!ipAddress) {
      throw new Error('No IP address found in incident data');
    }

    await this.securityServices.firewall.blockIP(ipAddress, parameters.duration || 3600);
    
    return {
      action: 'IP blocked',
      ipAddress,
      duration: parameters.duration || 3600
    };
  }

  private async disableUser(context: any): Promise<any> {
    const { incident, parameters } = context;
    const userId = incident.metadata.triggerEvent?.userId;
    
    if (!userId) {
      throw new Error('No user ID found in incident data');
    }

    await this.securityServices.userManagement.disableUser(userId, 'Security incident');
    
    return {
      action: 'User disabled',
      userId,
      reason: 'Security incident'
    };
  }

  private async revokeTokens(context: any): Promise<any> {
    const { incident, parameters } = context;
    const userId = incident.metadata.triggerEvent?.userId;
    
    if (!userId) {
      throw new Error('No user ID found in incident data');
    }

    const revokedTokens = await this.securityServices.tokenManagement.revokeAllTokens(userId);
    
    return {
      action: 'Tokens revoked',
      userId,
      tokensRevoked: revokedTokens.length
    };
  }

  private async collectEvidence(context: any): Promise<any> {
    const { incident, parameters } = context;
    
    const evidence = await this.securityServices.evidenceCollector.collect({
      incidentId: incident.id,
      timeRange: parameters.timeRange || 3600,
      types: parameters.logTypes || ['all']
    });
    
    return {
      action: 'Evidence collected',
      evidenceItems: evidence.length
    };
  }

  private async notifyStakeholders(context: any): Promise<any> {
    const { incident, parameters } = context;
    
    const notifications = await this.securityServices.notificationService.sendIncidentNotification({
      incident,
      channels: parameters.channels || ['email'],
      priority: parameters.priority || 'medium'
    });
    
    return {
      action: 'Stakeholders notified',
      notificationsSent: notifications.length
    };
  }

  private async enableMonitoring(context: any): Promise<any> {
    const { incident, parameters } = context;
    
    await this.securityServices.monitoring.enableEnhancedMonitoring({
      incidentType: incident.type,
      mode: parameters.mode || 'standard'
    });
    
    return {
      action: 'Enhanced monitoring enabled',
      mode: parameters.mode || 'standard'
    };
  }
}

export class EvidenceCollector {
  constructor(
    private logger: Logger,
    private storageService: EvidenceStorageService
  ) {}

  public async collectEvidence(incident: SecurityIncident): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    try {
      // Collect different types of evidence based on incident type
      switch (incident.type) {
        case SecurityIncidentType.AUTHENTICATION_FAILURE:
          evidence.push(...await this.collectAuthenticationEvidence(incident));
          break;
        case SecurityIncidentType.SQL_INJECTION:
          evidence.push(...await this.collectSQLInjectionEvidence(incident));
          break;
        case SecurityIncidentType.PRIVILEGE_ESCALATION:
          evidence.push(...await this.collectPrivilegeEscalationEvidence(incident));
          break;
        default:
          evidence.push(...await this.collectGeneralEvidence(incident));
      }

      // Store evidence securely
      for (const item of evidence) {
        await this.storageService.store(item);
      }

      this.logger.info('Evidence collected for incident', {
        incidentId: incident.id,
        evidenceItems: evidence.length
      });

    } catch (error) {
      this.logger.error('Error collecting evidence', {
        incidentId: incident.id,
        error: error.message
      });
    }

    return evidence;
  }

  private async collectAuthenticationEvidence(incident: SecurityIncident): Promise<EvidenceItem[]> {
    // Implementation for collecting authentication-related evidence
    return [];
  }

  private async collectSQLInjectionEvidence(incident: SecurityIncident): Promise<EvidenceItem[]> {
    // Implementation for collecting SQL injection evidence
    return [];
  }

  private async collectPrivilegeEscalationEvidence(incident: SecurityIncident): Promise<EvidenceItem[]> {
    // Implementation for collecting privilege escalation evidence
    return [];
  }

  private async collectGeneralEvidence(incident: SecurityIncident): Promise<EvidenceItem[]> {
    // Implementation for collecting general evidence
    return [];
  }
}

interface SecurityServices {
  firewall: {
    blockIP(ip: string, duration: number): Promise<void>;
  };
  userManagement: {
    disableUser(userId: string, reason: string): Promise<void>;
  };
  tokenManagement: {
    revokeAllTokens(userId: string): Promise<any[]>;
  };
  evidenceCollector: {
    collect(params: any): Promise<any[]>;
  };
  notificationService: {
    sendIncidentNotification(params: any): Promise<any[]>;
  };
  monitoring: {
    enableEnhancedMonitoring(params: any): Promise<void>;
  };
}

interface EvidenceStorageService {
  store(evidence: EvidenceItem): Promise<void>;
}