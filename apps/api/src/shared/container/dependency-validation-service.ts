import { Container, SERVICE_TOKENS } from './types';
import { LoggingService } from '@taskmanagement/observability';

/**
 * Dependency Validation Service
 *
 * Provides comprehensive validation of dependency injection container
 * configuration, ensuring all services can be resolved and circular
 * dependencies are detected.
 */
export class DependencyValidationService {
  private validationResults: ValidationResult[] = [];

  constructor(
    private readonly container: Container,
    private readonly logger: LoggingService
  ) {}

  /**
   * Validate all service dependencies
   */
  async validateAllDependencies(): Promise<ValidationSummary> {
    this.validationResults = [];

    this.logger.info('Starting comprehensive dependency validation');

    // Validate core infrastructure services
    await this.validateInfrastructureServices();

    // Validate repositories
    await this.validateRepositories();

    // Validate domain services
    await this.validateDomainServices();

    // Validate application services
    await this.validateApplicationServices();

    // Validate command handlers
    await this.validateCommandHandlers();

    // Validate query handlers
    await this.validateQueryHandlers();

    // Validate controllers
    await this.validateControllers();

    // Validate event handling
    await this.validateEventHandling();

    // Check for circular dependencies
    await this.validateCircularDependencies();

    const summary = this.generateValidationSummary();

    this.logger.info('Dependency validation completed', {
      totalServices: summary.totalServices,
      validServices: summary.validServices,
      invalidServices: summary.invalidServices,
      warnings: summary.warnings,
    });

    return summary;
  }

  /**
   * Validate infrastructure services
   */
  private async validateInfrastructureServices(): Promise<void> {
    const infrastructureServices = [
      SERVICE_TOKENS.DATABASE_CONNECTION,
      SERVICE_TOKENS.TRANSACTION_MANAGER,
      SERVICE_TOKENS.TRANSACTION_INTEGRATION_SERVICE,
      SERVICE_TOKENS.CACHE_SERVICE,
      SERVICE_TOKENS.EMAIL_SERVICE,
      SERVICE_TOKENS.WEBSOCKET_SERVICE,
      SERVICE_TOKENS.JWT_SERVICE,
      SERVICE_TOKENS.PASSWORD_SERVICE,
      SERVICE_TOKENS.RATE_LIMIT_SERVICE,
      SERVICE_TOKENS.LOGGING_SERVICE,
      SERVICE_TOKENS.METRICS_SERVICE,
      SERVICE_TOKENS.HEALTH_SERVICE,
    ];

    for (const serviceToken of infrastructureServices) {
      await this.validateService(serviceToken, 'Infrastructure');
    }
  }

  /**
   * Validate repository services
   */
  private async validateRepositories(): Promise<void> {
    const repositories = [
      SERVICE_TOKENS.USER_REPOSITORY,
      SERVICE_TOKENS.TASK_REPOSITORY,
      SERVICE_TOKENS.PROJECT_REPOSITORY,
      SERVICE_TOKENS.WORKSPACE_REPOSITORY,
      SERVICE_TOKENS.NOTIFICATION_REPOSITORY,
      SERVICE_TOKENS.NOTIFICATION_PREFERENCES_REPOSITORY,
      SERVICE_TOKENS.AUDIT_LOG_REPOSITORY,
      SERVICE_TOKENS.WEBHOOK_REPOSITORY,
      SERVICE_TOKENS.CALENDAR_EVENT_REPOSITORY,
      SERVICE_TOKENS.FILE_ATTACHMENT_REPOSITORY,
    ];

    for (const repository of repositories) {
      await this.validateService(repository, 'Repository');
    }
  }

  /**
   * Validate domain services
   */
  private async validateDomainServices(): Promise<void> {
    const domainServices = [
      SERVICE_TOKENS.TASK_DOMAIN_SERVICE,
      SERVICE_TOKENS.PROJECT_DOMAIN_SERVICE,
      SERVICE_TOKENS.WORKSPACE_DOMAIN_SERVICE,
      SERVICE_TOKENS.NOTIFICATION_DOMAIN_SERVICE,
      SERVICE_TOKENS.AUDIT_DOMAIN_SERVICE,
      SERVICE_TOKENS.WEBHOOK_DOMAIN_SERVICE,
      SERVICE_TOKENS.CALENDAR_DOMAIN_SERVICE,
    ];

    for (const service of domainServices) {
      await this.validateService(service, 'Domain Service');
    }
  }

  /**
   * Validate application services
   */
  private async validateApplicationServices(): Promise<void> {
    const applicationServices = [
      SERVICE_TOKENS.TASK_APPLICATION_SERVICE,
      SERVICE_TOKENS.PROJECT_APPLICATION_SERVICE,
      SERVICE_TOKENS.WORKSPACE_APPLICATION_SERVICE,
      SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE,
      SERVICE_TOKENS.AUTH_APPLICATION_SERVICE,
      SERVICE_TOKENS.WEBHOOK_APPLICATION_SERVICE,
      SERVICE_TOKENS.CALENDAR_APPLICATION_SERVICE,
    ];

    for (const service of applicationServices) {
      await this.validateService(service, 'Application Service');
    }
  }

  /**
   * Validate command handlers
   */
  private async validateCommandHandlers(): Promise<void> {
    const commandHandlers = [
      SERVICE_TOKENS.CREATE_TASK_HANDLER,
      SERVICE_TOKENS.UPDATE_TASK_HANDLER,
      SERVICE_TOKENS.ASSIGN_TASK_HANDLER,
      SERVICE_TOKENS.COMPLETE_TASK_HANDLER,
      SERVICE_TOKENS.CREATE_PROJECT_HANDLER,
      SERVICE_TOKENS.UPDATE_PROJECT_HANDLER,
      SERVICE_TOKENS.ADD_PROJECT_MEMBER_HANDLER,
      SERVICE_TOKENS.REMOVE_PROJECT_MEMBER_HANDLER,
      SERVICE_TOKENS.CREATE_WORKSPACE_HANDLER,
      SERVICE_TOKENS.INVITE_USER_HANDLER,
      SERVICE_TOKENS.REGISTER_USER_HANDLER,
      SERVICE_TOKENS.UPDATE_USER_PROFILE_HANDLER,
      SERVICE_TOKENS.CREATE_NOTIFICATION_HANDLER,
      SERVICE_TOKENS.UPDATE_NOTIFICATION_HANDLER,
      SERVICE_TOKENS.MARK_NOTIFICATION_READ_HANDLER,
      SERVICE_TOKENS.CREATE_AUDIT_LOG_HANDLER,
      SERVICE_TOKENS.CLEANUP_AUDIT_LOGS_HANDLER,
      SERVICE_TOKENS.CREATE_WEBHOOK_HANDLER,
      SERVICE_TOKENS.UPDATE_WEBHOOK_HANDLER,
      SERVICE_TOKENS.TRIGGER_WEBHOOK_HANDLER,
      SERVICE_TOKENS.CREATE_CALENDAR_EVENT_HANDLER,
      SERVICE_TOKENS.UPDATE_CALENDAR_EVENT_HANDLER,
      SERVICE_TOKENS.SCHEDULE_CALENDAR_EVENT_HANDLER,
    ];

    for (const handler of commandHandlers) {
      await this.validateService(handler, 'Command Handler');
    }
  }

  /**
   * Validate query handlers
   */
  private async validateQueryHandlers(): Promise<void> {
    const queryHandlers = [
      SERVICE_TOKENS.GET_TASK_HANDLER,
      SERVICE_TOKENS.LIST_TASKS_HANDLER,
      SERVICE_TOKENS.GET_PROJECT_HANDLER,
      SERVICE_TOKENS.LIST_PROJECTS_HANDLER,
      SERVICE_TOKENS.GET_PROJECT_MEMBERS_HANDLER,
      SERVICE_TOKENS.GET_WORKSPACE_HANDLER,
      SERVICE_TOKENS.LIST_WORKSPACES_HANDLER,
      SERVICE_TOKENS.GET_WORKSPACE_STATS_HANDLER,
      SERVICE_TOKENS.GET_USER_HANDLER,
      SERVICE_TOKENS.LIST_USERS_HANDLER,
      SERVICE_TOKENS.GET_USER_PREFERENCES_HANDLER,
      SERVICE_TOKENS.GET_NOTIFICATIONS_HANDLER,
      SERVICE_TOKENS.GET_NOTIFICATION_PREFERENCES_HANDLER,
      SERVICE_TOKENS.GET_WEBHOOKS_HANDLER,
      SERVICE_TOKENS.GET_WEBHOOK_DELIVERIES_HANDLER,
    ];

    for (const handler of queryHandlers) {
      await this.validateService(handler, 'Query Handler');
    }
  }

  /**
   * Validate controllers
   */
  private async validateControllers(): Promise<void> {
    const controllers = [
      SERVICE_TOKENS.TASK_CONTROLLER,
      SERVICE_TOKENS.PROJECT_CONTROLLER,
      SERVICE_TOKENS.WORKSPACE_CONTROLLER,
      SERVICE_TOKENS.USER_CONTROLLER,
      SERVICE_TOKENS.AUTH_CONTROLLER,
      SERVICE_TOKENS.NOTIFICATION_CONTROLLER,
      SERVICE_TOKENS.WEBHOOK_CONTROLLER,
      SERVICE_TOKENS.CALENDAR_CONTROLLER,
    ];

    for (const controller of controllers) {
      await this.validateService(controller, 'Controller');
    }
  }

  /**
   * Validate event handling services
   */
  private async validateEventHandling(): Promise<void> {
    const eventServices = [
      SERVICE_TOKENS.EVENT_BUS,
      SERVICE_TOKENS.DOMAIN_EVENT_BUS,
      SERVICE_TOKENS.DOMAIN_EVENT_PUBLISHER,
      SERVICE_TOKENS.APPLICATION_EVENT_HANDLERS,
      SERVICE_TOKENS.EVENT_INTEGRATION_SERVICE,
    ];

    for (const service of eventServices) {
      await this.validateService(service, 'Event Service');
    }
  }

  /**
   * Validate a single service
   */
  private async validateService(
    serviceToken: string,
    category: string
  ): Promise<void> {
    try {
      if (!this.container.isRegistered(serviceToken)) {
        this.validationResults.push({
          serviceToken,
          category,
          status: 'error',
          message: 'Service not registered',
        });
        return;
      }

      // Try to resolve the service
      const service = this.container.resolve(serviceToken);

      if (!service) {
        this.validationResults.push({
          serviceToken,
          category,
          status: 'error',
          message: 'Service resolution returned null/undefined',
        });
        return;
      }

      this.validationResults.push({
        serviceToken,
        category,
        status: 'success',
        message: 'Service resolved successfully',
      });
    } catch (error) {
      this.validationResults.push({
        serviceToken,
        category,
        status: 'error',
        message: `Service resolution failed: ${(error as Error).message}`,
        error: error as Error,
      });
    }
  }

  /**
   * Validate circular dependencies
   */
  private async validateCircularDependencies(): Promise<void> {
    try {
      this.container.validateDependencies();

      this.validationResults.push({
        serviceToken: 'CIRCULAR_DEPENDENCY_CHECK',
        category: 'System',
        status: 'success',
        message: 'No circular dependencies detected',
      });
    } catch (error) {
      this.validationResults.push({
        serviceToken: 'CIRCULAR_DEPENDENCY_CHECK',
        category: 'System',
        status: 'error',
        message: `Circular dependency detected: ${(error as Error).message}`,
        error: error as Error,
      });
    }
  }

  /**
   * Generate validation summary
   */
  private generateValidationSummary(): ValidationSummary {
    const totalServices = this.validationResults.length;
    const validServices = this.validationResults.filter(
      r => r.status === 'success'
    ).length;
    const invalidServices = this.validationResults.filter(
      r => r.status === 'error'
    ).length;
    const warnings = this.validationResults.filter(
      r => r.status === 'warning'
    ).length;

    const errorsByCategory = this.validationResults
      .filter(r => r.status === 'error')
      .reduce(
        (acc, result) => {
          acc[result.category] = (acc[result.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const errors = this.validationResults.filter(r => r.status === 'error');

    return {
      totalServices,
      validServices,
      invalidServices,
      warnings,
      isValid: invalidServices === 0,
      errorsByCategory,
      errors,
      validationResults: this.validationResults,
    };
  }

  /**
   * Get detailed validation report
   */
  getDetailedReport(): string {
    const summary = this.generateValidationSummary();

    let report = `
=== Dependency Injection Validation Report ===

Summary:
- Total Services: ${summary.totalServices}
- Valid Services: ${summary.validServices}
- Invalid Services: ${summary.invalidServices}
- Warnings: ${summary.warnings}
- Overall Status: ${summary.isValid ? 'VALID' : 'INVALID'}

`;

    if (summary.invalidServices > 0) {
      report += `
Errors by Category:
`;
      Object.entries(summary.errorsByCategory).forEach(([category, count]) => {
        report += `- ${category}: ${count} errors\n`;
      });

      report += `
Detailed Errors:
`;
      summary.errors.forEach(error => {
        report += `- [${error.category}] ${error.serviceToken}: ${error.message}\n`;
      });
    }

    return report;
  }
}

interface ValidationResult {
  serviceToken: string;
  category: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  error?: Error;
}

interface ValidationSummary {
  totalServices: number;
  validServices: number;
  invalidServices: number;
  warnings: number;
  isValid: boolean;
  errorsByCategory: Record<string, number>;
  errors: ValidationResult[];
  validationResults: ValidationResult[];
}

