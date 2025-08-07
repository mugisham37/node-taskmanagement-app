/**
 * Horizontal Scaling Manager
 * Provides comprehensive horizontal scaling and load balancing capabilities
 */

import { logger } from '../logging/logger';
import { CircuitBreaker } from '../resilience/circuit-breaker';
import { LoadBalancer } from './load-balancer';

export interface ScalingMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestsPerSecond: number;
  responseTime: number;
  errorRate: number;
  queueLength: number;
}

export interface ScalingRule {
  name: string;
  metric: keyof ScalingMetrics;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  action: 'scale_up' | 'scale_down';
  cooldownPeriod: number; // in seconds
  minInstances: number;
  maxInstances: number;
  scaleStep: number;
}

export interface InstanceInfo {
  id: string;
  host: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
  metrics: ScalingMetrics;
  lastHealthCheck: Date;
  startedAt: Date;
  version: string;
  region?: string;
  zone?: string;
}

export interface ScalingEvent {
  timestamp: Date;
  type: 'scale_up' | 'scale_down' | 'health_check' | 'instance_failure';
  instanceId?: string;
  reason: string;
  metrics?: Partial<ScalingMetrics>;
  success: boolean;
  duration?: number;
}

export class HorizontalScalingManager {
  private instances = new Map<string, InstanceInfo>();
  private scalingRules: ScalingRule[] = [];
  private scalingEvents: ScalingEvent[] = [];
  private lastScalingAction = new Map<string, Date>();
  private readonly loadBalancer: LoadBalancer;
  private readonly circuitBreaker: CircuitBreaker;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;

  constructor() {
    this.loadBalancer = new LoadBalancer();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitorTimeout: 5000,
    });

    this.initializeDefaultScalingRules();
    this.startHealthChecking();
    this.startMetricsCollection();
  }

  /**
   * Register a new instance in the scaling pool
   */
  async registerInstance(
    instanceInfo: Omit<InstanceInfo, 'metrics' | 'lastHealthCheck'>
  ): Promise<void> {
    const instance: InstanceInfo = {
      ...instanceInfo,
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestsPerSecond: 0,
        responseTime: 0,
        errorRate: 0,
        queueLength: 0,
      },
      lastHealthCheck: new Date(),
    };

    this.instances.set(instance.id, instance);
    await this.loadBalancer.addServer({
      id: instance.id,
      host: instance.host,
      port: instance.port,
      weight: 1,
      maxConnections: 1000,
    });

    this.recordScalingEvent({
      timestamp: new Date(),
      type: 'health_check',
      instanceId: instance.id,
      reason: 'Instance registered',
      success: true,
    });

    logger.info('Instance registered for horizontal scaling', {
      instanceId: instance.id,
      host: instance.host,
      port: instance.port,
      status: instance.status,
    });
  }

  /**
   * Unregister an instance from the scaling pool
   */
  async unregisterInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logger.warn('Attempted to unregister unknown instance', { instanceId });
      return;
    }

    // Gracefully drain connections before removing
    await this.drainInstance(instanceId);

    this.instances.delete(instanceId);
    await this.loadBalancer.removeServer(instanceId);

    this.recordScalingEvent({
      timestamp: new Date(),
      type: 'health_check',
      instanceId,
      reason: 'Instance unregistered',
      success: true,
    });

    logger.info('Instance unregistered from horizontal scaling', {
      instanceId,
      host: instance.host,
      port: instance.port,
    });
  }

  /**
   * Add a scaling rule
   */
  addScalingRule(rule: ScalingRule): void {
    this.scalingRules.push(rule);

    logger.info('Scaling rule added', {
      name: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      action: rule.action,
    });
  }

  /**
   * Remove a scaling rule
   */
  removeScalingRule(ruleName: string): void {
    const index = this.scalingRules.findIndex(rule => rule.name === ruleName);
    if (index !== -1) {
      this.scalingRules.splice(index, 1);
      logger.info('Scaling rule removed', { ruleName });
    }
  }

  /**
   * Get current scaling status
   */
  getScalingStatus(): {
    totalInstances: number;
    healthyInstances: number;
    unhealthyInstances: number;
    averageMetrics: ScalingMetrics;
    activeRules: number;
    recentEvents: ScalingEvent[];
  } {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(i => i.status === 'healthy');
    const unhealthyInstances = instances.filter(i => i.status === 'unhealthy');

    // Calculate average metrics across healthy instances
    const averageMetrics = healthyInstances.reduce(
      (acc, instance) => {
        acc.cpuUsage += instance.metrics.cpuUsage;
        acc.memoryUsage += instance.metrics.memoryUsage;
        acc.activeConnections += instance.metrics.activeConnections;
        acc.requestsPerSecond += instance.metrics.requestsPerSecond;
        acc.responseTime += instance.metrics.responseTime;
        acc.errorRate += instance.metrics.errorRate;
        acc.queueLength += instance.metrics.queueLength;
        return acc;
      },
      {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestsPerSecond: 0,
        responseTime: 0,
        errorRate: 0,
        queueLength: 0,
      }
    );

    if (healthyInstances.length > 0) {
      Object.keys(averageMetrics).forEach(key => {
        (averageMetrics as any)[key] /= healthyInstances.length;
      });
    }

    return {
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      unhealthyInstances: unhealthyInstances.length,
      averageMetrics,
      activeRules: this.scalingRules.length,
      recentEvents: this.scalingEvents.slice(-10),
    };
  }

  /**
   * Manually trigger scaling action
   */
  async triggerScaling(
    action: 'scale_up' | 'scale_down',
    reason: string
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      let success = false;

      if (action === 'scale_up') {
        success = await this.scaleUp(reason);
      } else {
        success = await this.scaleDown(reason);
      }

      this.recordScalingEvent({
        timestamp: new Date(),
        type: action,
        reason: `Manual trigger: ${reason}`,
        success,
        duration: Date.now() - startTime,
      });

      return success;
    } catch (error) {
      logger.error('Manual scaling trigger failed', {
        action,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });

      this.recordScalingEvent({
        timestamp: new Date(),
        type: action,
        reason: `Manual trigger failed: ${error}`,
        success: false,
        duration: Date.now() - startTime,
      });

      return false;
    }
  }

  /**
   * Get load balancing recommendations
   */
  getLoadBalancingRecommendations(): {
    recommendations: string[];
    suggestedActions: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high';
      description: string;
    }>;
  } {
    const recommendations: string[] = [];
    const suggestedActions: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    const status = this.getScalingStatus();
    const { averageMetrics, healthyInstances, totalInstances } = status;

    // CPU usage recommendations
    if (averageMetrics.cpuUsage > 80) {
      recommendations.push('High CPU usage detected across instances');
      suggestedActions.push({
        action: 'scale_up',
        priority: 'high',
        description: 'Add more instances to distribute CPU load',
      });
    } else if (averageMetrics.cpuUsage < 20 && totalInstances > 2) {
      recommendations.push('Low CPU usage - consider scaling down');
      suggestedActions.push({
        action: 'scale_down',
        priority: 'low',
        description: 'Remove underutilized instances to optimize costs',
      });
    }

    // Memory usage recommendations
    if (averageMetrics.memoryUsage > 85) {
      recommendations.push('High memory usage detected');
      suggestedActions.push({
        action: 'scale_up',
        priority: 'high',
        description: 'Add instances to prevent memory exhaustion',
      });
    }

    // Response time recommendations
    if (averageMetrics.responseTime > 1000) {
      recommendations.push('High response times detected');
      suggestedActions.push({
        action: 'scale_up',
        priority: 'medium',
        description: 'Scale up to improve response times',
      });
    }

    // Error rate recommendations
    if (averageMetrics.errorRate > 5) {
      recommendations.push('High error rate detected');
      suggestedActions.push({
        action: 'scale_up',
        priority: 'high',
        description: 'Scale up to handle load and reduce errors',
      });
    }

    // Health recommendations
    if (healthyInstances < totalInstances * 0.7) {
      recommendations.push('Low healthy instance ratio');
      suggestedActions.push({
        action: 'scale_up',
        priority: 'high',
        description: 'Add healthy instances to maintain service availability',
      });
    }

    return { recommendations, suggestedActions };
  }

  /**
   * Perform graceful shutdown of scaling manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down horizontal scaling manager');

    // Stop health checking and metrics collection
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    // Gracefully drain all instances
    const instances = Array.from(this.instances.keys());
    await Promise.all(instances.map(id => this.drainInstance(id)));

    logger.info('Horizontal scaling manager shutdown complete');
  }

  private initializeDefaultScalingRules(): void {
    const defaultRules: ScalingRule[] = [
      {
        name: 'cpu_scale_up',
        metric: 'cpuUsage',
        threshold: 75,
        operator: 'gt',
        action: 'scale_up',
        cooldownPeriod: 300, // 5 minutes
        minInstances: 2,
        maxInstances: 10,
        scaleStep: 1,
      },
      {
        name: 'cpu_scale_down',
        metric: 'cpuUsage',
        threshold: 25,
        operator: 'lt',
        action: 'scale_down',
        cooldownPeriod: 600, // 10 minutes
        minInstances: 2,
        maxInstances: 10,
        scaleStep: 1,
      },
      {
        name: 'memory_scale_up',
        metric: 'memoryUsage',
        threshold: 80,
        operator: 'gt',
        action: 'scale_up',
        cooldownPeriod: 300,
        minInstances: 2,
        maxInstances: 10,
        scaleStep: 1,
      },
      {
        name: 'response_time_scale_up',
        metric: 'responseTime',
        threshold: 1000,
        operator: 'gt',
        action: 'scale_up',
        cooldownPeriod: 180, // 3 minutes
        minInstances: 2,
        maxInstances: 10,
        scaleStep: 2,
      },
      {
        name: 'error_rate_scale_up',
        metric: 'errorRate',
        threshold: 5,
        operator: 'gt',
        action: 'scale_up',
        cooldownPeriod: 120, // 2 minutes
        minInstances: 2,
        maxInstances: 10,
        scaleStep: 1,
      },
    ];

    defaultRules.forEach(rule => this.addScalingRule(rule));
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.evaluateScalingRules();
    }, 60000); // Every minute
  }

  private async performHealthChecks(): Promise<void> {
    const instances = Array.from(this.instances.values());

    await Promise.all(
      instances.map(async instance => {
        try {
          const isHealthy = await this.checkInstanceHealth(instance);
          const previousStatus = instance.status;

          instance.status = isHealthy ? 'healthy' : 'unhealthy';
          instance.lastHealthCheck = new Date();

          if (previousStatus !== instance.status) {
            logger.info('Instance status changed', {
              instanceId: instance.id,
              previousStatus,
              newStatus: instance.status,
            });

            if (instance.status === 'unhealthy') {
              await this.handleUnhealthyInstance(instance);
            } else if (instance.status === 'healthy') {
              await this.handleRecoveredInstance(instance);
            }
          }
        } catch (error) {
          logger.error('Health check failed for instance', {
            instanceId: instance.id,
            error: error instanceof Error ? error.message : String(error),
          });

          instance.status = 'unhealthy';
          instance.lastHealthCheck = new Date();
        }
      })
    );
  }

  private async checkInstanceHealth(instance: InstanceInfo): Promise<boolean> {
    try {
      // This would typically make an HTTP request to the instance's health endpoint
      // For now, we'll simulate the health check
      const response = await fetch(
        `http://${instance.host}:${instance.port}/health`,
        {
          timeout: 5000,
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async collectMetrics(): Promise<void> {
    const instances = Array.from(this.instances.values());

    await Promise.all(
      instances.map(async instance => {
        if (instance.status === 'healthy') {
          try {
            const metrics = await this.getInstanceMetrics(instance);
            instance.metrics = metrics;
          } catch (error) {
            logger.error('Failed to collect metrics for instance', {
              instanceId: instance.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      })
    );
  }

  private async getInstanceMetrics(
    instance: InstanceInfo
  ): Promise<ScalingMetrics> {
    try {
      // This would typically make an HTTP request to get metrics
      // For now, we'll simulate metrics collection
      const response = await fetch(
        `http://${instance.host}:${instance.port}/metrics`
      );
      const data = await response.json();

      return {
        cpuUsage: data.cpu_usage || 0,
        memoryUsage: data.memory_usage || 0,
        activeConnections: data.active_connections || 0,
        requestsPerSecond: data.requests_per_second || 0,
        responseTime: data.response_time || 0,
        errorRate: data.error_rate || 0,
        queueLength: data.queue_length || 0,
      };
    } catch (error) {
      // Return default metrics if collection fails
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestsPerSecond: 0,
        responseTime: 0,
        errorRate: 0,
        queueLength: 0,
      };
    }
  }

  private async evaluateScalingRules(): Promise<void> {
    const status = this.getScalingStatus();
    const { averageMetrics, healthyInstances } = status;

    for (const rule of this.scalingRules) {
      // Check cooldown period
      const lastAction = this.lastScalingAction.get(rule.name);
      if (lastAction) {
        const timeSinceLastAction = (Date.now() - lastAction.getTime()) / 1000;
        if (timeSinceLastAction < rule.cooldownPeriod) {
          continue;
        }
      }

      // Check if rule condition is met
      const metricValue = averageMetrics[rule.metric];
      const conditionMet = this.evaluateCondition(
        metricValue,
        rule.threshold,
        rule.operator
      );

      if (conditionMet) {
        // Check instance limits
        if (
          rule.action === 'scale_up' &&
          healthyInstances >= rule.maxInstances
        ) {
          continue;
        }
        if (
          rule.action === 'scale_down' &&
          healthyInstances <= rule.minInstances
        ) {
          continue;
        }

        logger.info('Scaling rule triggered', {
          ruleName: rule.name,
          action: rule.action,
          metric: rule.metric,
          value: metricValue,
          threshold: rule.threshold,
        });

        // Execute scaling action
        const success =
          rule.action === 'scale_up'
            ? await this.scaleUp(`Rule: ${rule.name}`)
            : await this.scaleDown(`Rule: ${rule.name}`);

        if (success) {
          this.lastScalingAction.set(rule.name, new Date());
        }
      }
    }
  }

  private evaluateCondition(
    value: number,
    threshold: number,
    operator: ScalingRule['operator']
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private async scaleUp(reason: string): Promise<boolean> {
    try {
      // This would typically trigger instance creation in your infrastructure
      // For now, we'll simulate scaling up
      logger.info('Scaling up triggered', { reason });

      // In a real implementation, this would:
      // 1. Create new instance(s) in your cloud provider
      // 2. Wait for instance(s) to be ready
      // 3. Register the new instance(s)

      return true;
    } catch (error) {
      logger.error('Scale up failed', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async scaleDown(reason: string): Promise<boolean> {
    try {
      // Find the least utilized healthy instance to remove
      const healthyInstances = Array.from(this.instances.values())
        .filter(i => i.status === 'healthy')
        .sort((a, b) => a.metrics.cpuUsage - b.metrics.cpuUsage);

      if (healthyInstances.length <= 2) {
        logger.warn('Cannot scale down: minimum instance count reached');
        return false;
      }

      const instanceToRemove = healthyInstances[0];

      logger.info('Scaling down triggered', {
        reason,
        instanceId: instanceToRemove.id,
      });

      // Gracefully remove the instance
      await this.drainInstance(instanceToRemove.id);
      await this.unregisterInstance(instanceToRemove.id);

      return true;
    } catch (error) {
      logger.error('Scale down failed', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async handleUnhealthyInstance(instance: InstanceInfo): Promise<void> {
    // Remove from load balancer but keep in instances map for monitoring
    await this.loadBalancer.markServerUnhealthy(instance.id);

    this.recordScalingEvent({
      timestamp: new Date(),
      type: 'instance_failure',
      instanceId: instance.id,
      reason: 'Instance became unhealthy',
      success: true,
    });

    // Consider scaling up if too many instances are unhealthy
    const status = this.getScalingStatus();
    if (status.healthyInstances < status.totalInstances * 0.5) {
      await this.scaleUp('Too many unhealthy instances');
    }
  }

  private async handleRecoveredInstance(instance: InstanceInfo): Promise<void> {
    // Add back to load balancer
    await this.loadBalancer.markServerHealthy(instance.id);

    this.recordScalingEvent({
      timestamp: new Date(),
      type: 'health_check',
      instanceId: instance.id,
      reason: 'Instance recovered',
      success: true,
    });
  }

  private async drainInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    logger.info('Draining instance', { instanceId });

    // Mark instance as stopping
    instance.status = 'stopping';

    // Remove from load balancer to stop new connections
    await this.loadBalancer.removeServer(instanceId);

    // Wait for existing connections to finish (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      if (instance.metrics.activeConnections === 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('Instance drained', {
      instanceId,
      remainingConnections: instance.metrics.activeConnections,
    });
  }

  private recordScalingEvent(event: ScalingEvent): void {
    this.scalingEvents.push(event);

    // Keep only last 100 events
    if (this.scalingEvents.length > 100) {
      this.scalingEvents = this.scalingEvents.slice(-100);
    }

    logger.debug('Scaling event recorded', event);
  }
}

export const horizontalScalingManager = new HorizontalScalingManager();
