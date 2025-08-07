/**
 * Zero-Downtime Deployment Support
 * Provides blue-green and rolling deployment strategies
 */

import { logger } from '../logging/logger';
import { LoadBalancer, ServiceInstance } from '../scaling/load-balancer';

export enum DeploymentStrategy {
  BLUE_GREEN = 'blue-green',
  ROLLING = 'rolling',
  CANARY = 'canary',
}

export enum DeploymentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export interface DeploymentConfig {
  strategy: DeploymentStrategy;
  serviceName: string;
  newVersion: string;
  healthCheckPath: string;
  healthCheckTimeout: number;
  rollbackOnFailure: boolean;
  maxUnavailableInstances?: number; // For rolling deployments
  canaryPercentage?: number; // For canary deployments
  deploymentTimeout: number;
}

export interface DeploymentStep {
  id: string;
  name: string;
  status: DeploymentStatus;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface DeploymentPlan {
  id: string;
  config: DeploymentConfig;
  steps: DeploymentStep[];
  status: DeploymentStatus;
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  rollbackPlan?: DeploymentStep[];
}

export class ZeroDowntimeDeploymentManager {
  private deployments = new Map<string, DeploymentPlan>();
  private activeDeployments = new Set<string>();

  constructor(private readonly loadBalancer: LoadBalancer) {}

  /**
   * Start deployment with specified strategy
   */
  async startDeployment(config: DeploymentConfig): Promise<string> {
    const deploymentId = this.generateDeploymentId();

    if (this.activeDeployments.has(config.serviceName)) {
      throw new Error(
        `Deployment already in progress for service ${config.serviceName}`
      );
    }

    const plan = this.createDeploymentPlan(deploymentId, config);
    this.deployments.set(deploymentId, plan);
    this.activeDeployments.add(config.serviceName);

    logger.info('Deployment started', {
      deploymentId,
      serviceName: config.serviceName,
      strategy: config.strategy,
      version: config.newVersion,
    });

    // Execute deployment asynchronously
    this.executeDeployment(deploymentId).catch(error => {
      logger.error('Deployment execution failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return deploymentId;
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): DeploymentPlan | null {
    return this.deployments.get(deploymentId) || null;
  }

  /**
   * Cancel ongoing deployment
   */
  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const plan = this.deployments.get(deploymentId);

    if (!plan || plan.status !== DeploymentStatus.IN_PROGRESS) {
      return false;
    }

    logger.info('Deployment cancellation requested', { deploymentId });

    // Mark as failed and trigger rollback if configured
    plan.status = DeploymentStatus.FAILED;
    plan.endTime = new Date();

    if (plan.config.rollbackOnFailure) {
      await this.rollbackDeployment(deploymentId);
    }

    this.activeDeployments.delete(plan.config.serviceName);
    return true;
  }

  /**
   * Rollback deployment
   */
  async rollbackDeployment(deploymentId: string): Promise<boolean> {
    const plan = this.deployments.get(deploymentId);

    if (!plan || !plan.rollbackPlan) {
      return false;
    }

    logger.info('Deployment rollback started', { deploymentId });

    try {
      for (const step of plan.rollbackPlan) {
        await this.executeStep(step, plan);
      }

      plan.status = DeploymentStatus.ROLLED_BACK;
      plan.endTime = new Date();

      logger.info('Deployment rollback completed', { deploymentId });
      return true;
    } catch (error) {
      logger.error('Deployment rollback failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      this.activeDeployments.delete(plan.config.serviceName);
    }
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(serviceName?: string): DeploymentPlan[] {
    const deployments = Array.from(this.deployments.values());

    if (serviceName) {
      return deployments.filter(d => d.config.serviceName === serviceName);
    }

    return deployments.sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  /**
   * Get deployment statistics
   */
  getDeploymentStats(): {
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
    rolledBackDeployments: number;
    averageDeploymentTime: number;
    successRate: number;
  } {
    const deployments = Array.from(this.deployments.values());
    const completed = deployments.filter(d => d.endTime);

    const successful = deployments.filter(
      d => d.status === DeploymentStatus.COMPLETED
    ).length;
    const failed = deployments.filter(
      d => d.status === DeploymentStatus.FAILED
    ).length;
    const rolledBack = deployments.filter(
      d => d.status === DeploymentStatus.ROLLED_BACK
    ).length;

    const averageDeploymentTime =
      completed.length > 0
        ? completed.reduce(
            (sum, d) => sum + (d.endTime!.getTime() - d.startTime.getTime()),
            0
          ) / completed.length
        : 0;

    const successRate =
      deployments.length > 0 ? (successful / deployments.length) * 100 : 0;

    return {
      totalDeployments: deployments.length,
      successfulDeployments: successful,
      failedDeployments: failed,
      rolledBackDeployments: rolledBack,
      averageDeploymentTime,
      successRate,
    };
  }

  private createDeploymentPlan(
    deploymentId: string,
    config: DeploymentConfig
  ): DeploymentPlan {
    const steps = this.generateDeploymentSteps(config);
    const rollbackPlan = this.generateRollbackSteps(config);

    return {
      id: deploymentId,
      config,
      steps,
      status: DeploymentStatus.PENDING,
      startTime: new Date(),
      rollbackPlan,
    };
  }

  private generateDeploymentSteps(config: DeploymentConfig): DeploymentStep[] {
    const steps: DeploymentStep[] = [];

    switch (config.strategy) {
      case DeploymentStrategy.BLUE_GREEN:
        steps.push(
          {
            id: '1',
            name: 'Prepare Green Environment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '2',
            name: 'Deploy to Green Environment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '3',
            name: 'Health Check Green Environment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '4',
            name: 'Switch Traffic to Green',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '5',
            name: 'Verify Green Environment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '6',
            name: 'Cleanup Blue Environment',
            status: DeploymentStatus.PENDING,
          }
        );
        break;

      case DeploymentStrategy.ROLLING:
        steps.push(
          {
            id: '1',
            name: 'Prepare Rolling Deployment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '2',
            name: 'Deploy to First Batch',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '3',
            name: 'Health Check First Batch',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '4',
            name: 'Deploy to Remaining Batches',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '5',
            name: 'Final Health Check',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '6',
            name: 'Cleanup Old Versions',
            status: DeploymentStatus.PENDING,
          }
        );
        break;

      case DeploymentStrategy.CANARY:
        steps.push(
          {
            id: '1',
            name: 'Prepare Canary Deployment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '2',
            name: 'Deploy Canary Version',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '3',
            name: 'Route Canary Traffic',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '4',
            name: 'Monitor Canary Metrics',
            status: DeploymentStatus.PENDING,
          },
          {
            id: '5',
            name: 'Full Deployment',
            status: DeploymentStatus.PENDING,
          },
          { id: '6', name: 'Cleanup Canary', status: DeploymentStatus.PENDING }
        );
        break;
    }

    return steps;
  }

  private generateRollbackSteps(config: DeploymentConfig): DeploymentStep[] {
    const steps: DeploymentStep[] = [];

    switch (config.strategy) {
      case DeploymentStrategy.BLUE_GREEN:
        steps.push(
          {
            id: 'rb1',
            name: 'Switch Traffic Back to Blue',
            status: DeploymentStatus.PENDING,
          },
          {
            id: 'rb2',
            name: 'Verify Blue Environment',
            status: DeploymentStatus.PENDING,
          },
          {
            id: 'rb3',
            name: 'Cleanup Failed Green Environment',
            status: DeploymentStatus.PENDING,
          }
        );
        break;

      case DeploymentStrategy.ROLLING:
        steps.push(
          {
            id: 'rb1',
            name: 'Stop New Deployments',
            status: DeploymentStatus.PENDING,
          },
          {
            id: 'rb2',
            name: 'Rollback Updated Instances',
            status: DeploymentStatus.PENDING,
          },
          {
            id: 'rb3',
            name: 'Verify Rollback',
            status: DeploymentStatus.PENDING,
          }
        );
        break;

      case DeploymentStrategy.CANARY:
        steps.push(
          {
            id: 'rb1',
            name: 'Remove Canary Traffic',
            status: DeploymentStatus.PENDING,
          },
          {
            id: 'rb2',
            name: 'Cleanup Canary Instances',
            status: DeploymentStatus.PENDING,
          },
          {
            id: 'rb3',
            name: 'Verify Original Environment',
            status: DeploymentStatus.PENDING,
          }
        );
        break;
    }

    return steps;
  }

  private async executeDeployment(deploymentId: string): Promise<void> {
    const plan = this.deployments.get(deploymentId);
    if (!plan) return;

    plan.status = DeploymentStatus.IN_PROGRESS;

    try {
      for (const step of plan.steps) {
        plan.currentStep = step.id;
        await this.executeStep(step, plan);

        if (step.status === DeploymentStatus.FAILED) {
          throw new Error(`Step ${step.name} failed: ${step.error}`);
        }
      }

      plan.status = DeploymentStatus.COMPLETED;
      plan.endTime = new Date();

      logger.info('Deployment completed successfully', {
        deploymentId,
        duration: plan.endTime.getTime() - plan.startTime.getTime(),
      });
    } catch (error) {
      plan.status = DeploymentStatus.FAILED;
      plan.endTime = new Date();

      logger.error('Deployment failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (plan.config.rollbackOnFailure) {
        await this.rollbackDeployment(deploymentId);
      }
    } finally {
      this.activeDeployments.delete(plan.config.serviceName);
    }
  }

  private async executeStep(
    step: DeploymentStep,
    plan: DeploymentPlan
  ): Promise<void> {
    step.status = DeploymentStatus.IN_PROGRESS;
    step.startTime = new Date();

    logger.debug('Executing deployment step', {
      deploymentId: plan.id,
      stepId: step.id,
      stepName: step.name,
    });

    try {
      switch (step.id) {
        case '1':
          await this.prepareEnvironment(plan);
          break;
        case '2':
          await this.deployNewVersion(plan);
          break;
        case '3':
          await this.performHealthCheck(plan);
          break;
        case '4':
          await this.switchTraffic(plan);
          break;
        case '5':
          await this.verifyDeployment(plan);
          break;
        case '6':
          await this.cleanup(plan);
          break;
        // Rollback steps
        case 'rb1':
          await this.rollbackTraffic(plan);
          break;
        case 'rb2':
          await this.verifyRollback(plan);
          break;
        case 'rb3':
          await this.cleanupFailedDeployment(plan);
          break;
        default:
          logger.warn('Unknown deployment step', { stepId: step.id });
      }

      step.status = DeploymentStatus.COMPLETED;
      step.endTime = new Date();
    } catch (error) {
      step.status = DeploymentStatus.FAILED;
      step.endTime = new Date();
      step.error = error instanceof Error ? error.message : String(error);

      logger.error('Deployment step failed', {
        deploymentId: plan.id,
        stepId: step.id,
        stepName: step.name,
        error: step.error,
      });

      throw error;
    }
  }

  private async prepareEnvironment(plan: DeploymentPlan): Promise<void> {
    // Prepare deployment environment based on strategy
    logger.debug('Preparing deployment environment', {
      deploymentId: plan.id,
      strategy: plan.config.strategy,
    });

    // Simulate preparation time
    await this.delay(1000);
  }

  private async deployNewVersion(plan: DeploymentPlan): Promise<void> {
    // Deploy new version based on strategy
    logger.debug('Deploying new version', {
      deploymentId: plan.id,
      version: plan.config.newVersion,
    });

    // Simulate deployment time
    await this.delay(5000);
  }

  private async performHealthCheck(plan: DeploymentPlan): Promise<void> {
    // Perform health checks on new instances
    logger.debug('Performing health check', {
      deploymentId: plan.id,
      healthCheckPath: plan.config.healthCheckPath,
    });

    // Simulate health check
    await this.delay(2000);

    // Simulate potential health check failure
    if (Math.random() < 0.1) {
      // 10% chance of failure
      throw new Error('Health check failed');
    }
  }

  private async switchTraffic(plan: DeploymentPlan): Promise<void> {
    // Switch traffic to new instances
    logger.debug('Switching traffic', {
      deploymentId: plan.id,
      strategy: plan.config.strategy,
    });

    // Simulate traffic switching
    await this.delay(1000);
  }

  private async verifyDeployment(plan: DeploymentPlan): Promise<void> {
    // Verify deployment success
    logger.debug('Verifying deployment', {
      deploymentId: plan.id,
    });

    // Simulate verification
    await this.delay(2000);
  }

  private async cleanup(plan: DeploymentPlan): Promise<void> {
    // Cleanup old instances
    logger.debug('Cleaning up old instances', {
      deploymentId: plan.id,
    });

    // Simulate cleanup
    await this.delay(1000);
  }

  private async rollbackTraffic(plan: DeploymentPlan): Promise<void> {
    // Rollback traffic to previous version
    logger.debug('Rolling back traffic', {
      deploymentId: plan.id,
    });

    // Simulate traffic rollback
    await this.delay(1000);
  }

  private async verifyRollback(plan: DeploymentPlan): Promise<void> {
    // Verify rollback success
    logger.debug('Verifying rollback', {
      deploymentId: plan.id,
    });

    // Simulate rollback verification
    await this.delay(2000);
  }

  private async cleanupFailedDeployment(plan: DeploymentPlan): Promise<void> {
    // Cleanup failed deployment artifacts
    logger.debug('Cleaning up failed deployment', {
      deploymentId: plan.id,
    });

    // Simulate cleanup
    await this.delay(1000);
  }

  private generateDeploymentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `deploy_${timestamp}_${random}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Deployment orchestrator for managing multiple services
 */
export class DeploymentOrchestrator {
  private deploymentManagers = new Map<string, ZeroDowntimeDeploymentManager>();

  /**
   * Register service for deployment management
   */
  registerService(serviceName: string, loadBalancer: LoadBalancer): void {
    const manager = new ZeroDowntimeDeploymentManager(loadBalancer);
    this.deploymentManagers.set(serviceName, manager);

    logger.info('Service registered for deployment management', {
      serviceName,
    });
  }

  /**
   * Deploy service with zero downtime
   */
  async deployService(config: DeploymentConfig): Promise<string> {
    const manager = this.deploymentManagers.get(config.serviceName);

    if (!manager) {
      throw new Error(
        `Service ${config.serviceName} not registered for deployment`
      );
    }

    return await manager.startDeployment(config);
  }

  /**
   * Get deployment status across all services
   */
  getAllDeploymentStatus(): Record<string, DeploymentPlan[]> {
    const status: Record<string, DeploymentPlan[]> = {};

    for (const [serviceName, manager] of this.deploymentManagers.entries()) {
      status[serviceName] = manager.getDeploymentHistory();
    }

    return status;
  }

  /**
   * Get deployment statistics across all services
   */
  getOverallDeploymentStats(): {
    totalServices: number;
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
    averageSuccessRate: number;
  } {
    let totalDeployments = 0;
    let successfulDeployments = 0;
    let failedDeployments = 0;
    let totalSuccessRate = 0;

    for (const manager of this.deploymentManagers.values()) {
      const stats = manager.getDeploymentStats();
      totalDeployments += stats.totalDeployments;
      successfulDeployments += stats.successfulDeployments;
      failedDeployments += stats.failedDeployments;
      totalSuccessRate += stats.successRate;
    }

    const averageSuccessRate =
      this.deploymentManagers.size > 0
        ? totalSuccessRate / this.deploymentManagers.size
        : 0;

    return {
      totalServices: this.deploymentManagers.size,
      totalDeployments,
      successfulDeployments,
      failedDeployments,
      averageSuccessRate,
    };
  }
}

// Global deployment orchestrator instance
export const deploymentOrchestrator = new DeploymentOrchestrator();
