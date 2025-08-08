/**
 * Load Balancing and Horizontal Scaling Support
 * Provides intelligent load distribution and scaling capabilities
 */

import { logger } from '../logging/logger';
import { circuitBreakerManager } from '../resilience/circuit-breaker';

export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  healthy: boolean;
  lastHealthCheck: Date;
  responseTime: number;
  activeConnections: number;
  maxConnections: number;
  metadata: Record<string, any>;
}

export interface LoadBalancingStrategy {
  name: string;
  selectInstance(
    instances: ServiceInstance[],
    context?: any
  ): ServiceInstance | null;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
  expectedStatus?: number;
  expectedBody?: string;
}

export interface ScalingMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface ScalingRule {
  name: string;
  metric: keyof ScalingMetrics;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  cooldown: number;
  minInstances: number;
  maxInstances: number;
}

export class LoadBalancer {
  private instances = new Map<string, ServiceInstance>();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsHistory: Array<{ timestamp: Date; metrics: ScalingMetrics }> =
    [];
  private lastScalingAction?: Date;

  constructor(
    private readonly serviceName: string,
    private readonly strategy: LoadBalancingStrategy,
    private readonly healthCheckConfig: HealthCheckConfig,
    private readonly scalingRules: ScalingRule[] = []
  ) {
    logger.info('Load balancer initialized', {
      serviceName,
      strategy: strategy.name,
      healthCheckInterval: healthCheckConfig.interval,
    });
  }

  /**
   * Register service instance
   */
  registerInstance(instance: ServiceInstance): void {
    this.instances.set(instance.id, {
      ...instance,
      healthy: true,
      lastHealthCheck: new Date(),
      responseTime: 0,
      activeConnections: 0,
    });

    logger.info('Service instance registered', {
      serviceName: this.serviceName,
      instanceId: instance.id,
      host: instance.host,
      port: instance.port,
      weight: instance.weight,
    });
  }

  /**
   * Unregister service instance
   */
  unregisterInstance(instanceId: string): void {
    const removed = this.instances.delete(instanceId);

    if (removed) {
      logger.info('Service instance unregistered', {
        serviceName: this.serviceName,
        instanceId,
      });
    }
  }

  /**
   * Get next available instance using load balancing strategy
   */
  getNextInstance(context?: any): ServiceInstance | null {
    const healthyInstances = Array.from(this.instances.values()).filter(
      instance =>
        instance.healthy && instance.activeConnections < instance.maxConnections
    );

    if (healthyInstances.length === 0) {
      logger.warn('No healthy instances available', {
        serviceName: this.serviceName,
        totalInstances: this.instances.size,
      });
      return null;
    }

    const selectedInstance = this.strategy.selectInstance(
      healthyInstances,
      context
    );

    if (selectedInstance) {
      selectedInstance.activeConnections++;

      logger.debug('Instance selected', {
        serviceName: this.serviceName,
        instanceId: selectedInstance.id,
        strategy: this.strategy.name,
        activeConnections: selectedInstance.activeConnections,
      });
    }

    return selectedInstance;
  }

  /**
   * Release instance connection
   */
  releaseInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);

    if (instance && instance.activeConnections > 0) {
      instance.activeConnections--;

      logger.debug('Instance connection released', {
        serviceName: this.serviceName,
        instanceId,
        activeConnections: instance.activeConnections,
      });
    }
  }

  /**
   * Update instance metrics
   */
  updateInstanceMetrics(
    instanceId: string,
    responseTime: number,
    success: boolean
  ): void {
    const instance = this.instances.get(instanceId);

    if (instance) {
      // Update response time with exponential moving average
      instance.responseTime =
        instance.responseTime === 0
          ? responseTime
          : instance.responseTime * 0.8 + responseTime * 0.2;

      // Update health based on success rate
      if (!success) {
        logger.debug('Instance request failed', {
          serviceName: this.serviceName,
          instanceId,
          responseTime,
        });
      }
    }
  }

  /**
   * Get load balancer statistics
   */
  getStats(): {
    serviceName: string;
    strategy: string;
    totalInstances: number;
    healthyInstances: number;
    totalConnections: number;
    averageResponseTime: number;
    instances: Array<{
      id: string;
      host: string;
      port: number;
      healthy: boolean;
      activeConnections: number;
      responseTime: number;
      weight: number;
    }>;
  } {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(i => i.healthy);
    const totalConnections = instances.reduce(
      (sum, i) => sum + i.activeConnections,
      0
    );
    const averageResponseTime =
      instances.length > 0
        ? instances.reduce((sum, i) => sum + i.responseTime, 0) /
          instances.length
        : 0;

    return {
      serviceName: this.serviceName,
      strategy: this.strategy.name,
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      totalConnections,
      averageResponseTime,
      instances: instances.map(i => ({
        id: i.id,
        host: i.host,
        port: i.port,
        healthy: i.healthy,
        activeConnections: i.activeConnections,
        responseTime: i.responseTime,
        weight: i.weight,
      })),
    };
  }

  /**
   * Start health checking
   */
  startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckConfig.interval);

    logger.info('Health checking started', {
      serviceName: this.serviceName,
      interval: this.healthCheckConfig.interval,
    });
  }

  /**
   * Stop health checking
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;

      logger.info('Health checking stopped', {
        serviceName: this.serviceName,
      });
    }
  }

  /**
   * Record scaling metrics
   */
  recordMetrics(metrics: ScalingMetrics): void {
    this.metricsHistory.push({
      timestamp: new Date(),
      metrics,
    });

    // Keep only last 100 metrics entries
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    // Check scaling rules
    this.evaluateScalingRules(metrics);
  }

  /**
   * Get scaling recommendations
   */
  getScalingRecommendations(): Array<{
    rule: string;
    action: 'scale_up' | 'scale_down';
    reason: string;
    currentValue: number;
    threshold: number;
  }> {
    if (this.metricsHistory.length === 0) {
      return [];
    }

    const latestMetrics =
      this.metricsHistory[this.metricsHistory.length - 1].metrics;
    const recommendations: Array<{
      rule: string;
      action: 'scale_up' | 'scale_down';
      reason: string;
      currentValue: number;
      threshold: number;
    }> = [];

    for (const rule of this.scalingRules) {
      const currentValue = latestMetrics[rule.metric];
      const shouldTrigger =
        rule.action === 'scale_up'
          ? currentValue > rule.threshold
          : currentValue < rule.threshold;

      if (shouldTrigger) {
        recommendations.push({
          rule: rule.name,
          action: rule.action,
          reason: `${rule.metric} (${currentValue}) ${rule.action === 'scale_up' ? 'exceeds' : 'below'} threshold (${rule.threshold})`,
          currentValue,
          threshold: rule.threshold,
        });
      }
    }

    return recommendations;
  }

  private async performHealthChecks(): Promise<void> {
    const instances = Array.from(this.instances.values());
    const healthCheckPromises = instances.map(instance =>
      this.checkInstanceHealth(instance)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    const startTime = Date.now();
    let healthy = false;

    try {
      const url = `http://${instance.host}:${instance.port}${this.healthCheckConfig.endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.healthCheckConfig.timeout
      );

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);

      healthy =
        response.status === (this.healthCheckConfig.expectedStatus || 200);

      if (this.healthCheckConfig.expectedBody) {
        const body = await response.text();
        healthy = healthy && body.includes(this.healthCheckConfig.expectedBody);
      }
    } catch (error) {
      logger.debug('Health check failed', {
        serviceName: this.serviceName,
        instanceId: instance.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const responseTime = Date.now() - startTime;
    const wasHealthy = instance.healthy;

    instance.healthy = healthy;
    instance.lastHealthCheck = new Date();
    instance.responseTime = responseTime;

    if (wasHealthy !== healthy) {
      logger.info('Instance health status changed', {
        serviceName: this.serviceName,
        instanceId: instance.id,
        healthy,
        responseTime,
      });
    }
  }

  private evaluateScalingRules(metrics: ScalingMetrics): void {
    const now = new Date();

    for (const rule of this.scalingRules) {
      // Check cooldown period
      if (
        this.lastScalingAction &&
        now.getTime() - this.lastScalingAction.getTime() < rule.cooldown
      ) {
        continue;
      }

      const currentValue = metrics[rule.metric];
      const shouldTrigger =
        rule.action === 'scale_up'
          ? currentValue > rule.threshold
          : currentValue < rule.threshold;

      if (shouldTrigger) {
        const currentInstances = this.instances.size;

        if (
          rule.action === 'scale_up' &&
          currentInstances < rule.maxInstances
        ) {
          this.triggerScaling(rule, 'scale_up', currentValue);
        } else if (
          rule.action === 'scale_down' &&
          currentInstances > rule.minInstances
        ) {
          this.triggerScaling(rule, 'scale_down', currentValue);
        }
      }
    }
  }

  private triggerScaling(
    rule: ScalingRule,
    action: 'scale_up' | 'scale_down',
    currentValue: number
  ): void {
    this.lastScalingAction = new Date();

    logger.info('Scaling action triggered', {
      serviceName: this.serviceName,
      rule: rule.name,
      action,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      currentInstances: this.instances.size,
    });

    // Emit scaling event (would be handled by orchestration system)
    this.emitScalingEvent(rule, action, currentValue);
  }

  private emitScalingEvent(
    rule: ScalingRule,
    action: 'scale_up' | 'scale_down',
    currentValue: number
  ): void {
    // This would typically integrate with container orchestration systems
    // like Kubernetes, Docker Swarm, or cloud auto-scaling groups

    logger.info('Scaling event emitted', {
      serviceName: this.serviceName,
      rule: rule.name,
      action,
      currentValue,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Round Robin Load Balancing Strategy
 */
export class RoundRobinStrategy implements LoadBalancingStrategy {
  name = 'round-robin';
  private currentIndex = 0;

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex = (this.currentIndex + 1) % instances.length;

    return instance;
  }
}

/**
 * Weighted Round Robin Load Balancing Strategy
 */
export class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  name = 'weighted-round-robin';
  private weightedInstances: ServiceInstance[] = [];
  private currentIndex = 0;

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    // Rebuild weighted list if instances changed
    if (
      this.weightedInstances.length === 0 ||
      this.instancesChanged(instances)
    ) {
      this.buildWeightedList(instances);
    }

    if (this.weightedInstances.length === 0) return null;

    const instance =
      this.weightedInstances[this.currentIndex % this.weightedInstances.length];
    this.currentIndex = (this.currentIndex + 1) % this.weightedInstances.length;

    return instance;
  }

  private buildWeightedList(instances: ServiceInstance[]): void {
    this.weightedInstances = [];

    for (const instance of instances) {
      for (let i = 0; i < instance.weight; i++) {
        this.weightedInstances.push(instance);
      }
    }

    this.currentIndex = 0;
  }

  private instancesChanged(instances: ServiceInstance[]): boolean {
    const currentIds = new Set(this.weightedInstances.map(i => i.id));
    const newIds = new Set(instances.map(i => i.id));

    return (
      currentIds.size !== newIds.size ||
      !Array.from(currentIds).every(id => newIds.has(id))
    );
  }
}

/**
 * Least Connections Load Balancing Strategy
 */
export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  name = 'least-connections';

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    return instances.reduce((least, current) =>
      current.activeConnections < least.activeConnections ? current : least
    );
  }
}

/**
 * Response Time Based Load Balancing Strategy
 */
export class ResponseTimeStrategy implements LoadBalancingStrategy {
  name = 'response-time';

  selectInstance(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    // Select instance with lowest response time
    return instances.reduce((fastest, current) =>
      current.responseTime < fastest.responseTime ? current : fastest
    );
  }
}

/**
 * Load Balancer Manager for managing multiple load balancers
 */
export class LoadBalancerManager {
  private loadBalancers = new Map<string, LoadBalancer>();

  /**
   * Create load balancer for service
   */
  createLoadBalancer(
    serviceName: string,
    strategy: LoadBalancingStrategy,
    healthCheckConfig: HealthCheckConfig,
    scalingRules: ScalingRule[] = []
  ): LoadBalancer {
    const loadBalancer = new LoadBalancer(
      serviceName,
      strategy,
      healthCheckConfig,
      scalingRules
    );
    this.loadBalancers.set(serviceName, loadBalancer);

    // Start health checking
    loadBalancer.startHealthChecking();

    logger.info('Load balancer created', { serviceName });

    return loadBalancer;
  }

  /**
   * Get load balancer for service
   */
  getLoadBalancer(serviceName: string): LoadBalancer | null {
    return this.loadBalancers.get(serviceName) || null;
  }

  /**
   * Remove load balancer
   */
  removeLoadBalancer(serviceName: string): boolean {
    const loadBalancer = this.loadBalancers.get(serviceName);

    if (loadBalancer) {
      loadBalancer.stopHealthChecking();
      this.loadBalancers.delete(serviceName);

      logger.info('Load balancer removed', { serviceName });
      return true;
    }

    return false;
  }

  /**
   * Get all load balancer statistics
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [serviceName, loadBalancer] of this.loadBalancers.entries()) {
      stats[serviceName] = loadBalancer.getStats();
    }

    return stats;
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): {
    totalServices: number;
    healthyServices: number;
    totalInstances: number;
    healthyInstances: number;
    healthPercentage: number;
  } {
    let totalInstances = 0;
    let healthyInstances = 0;
    let healthyServices = 0;

    for (const loadBalancer of this.loadBalancers.values()) {
      const stats = loadBalancer.getStats();
      totalInstances += stats.totalInstances;
      healthyInstances += stats.healthyInstances;

      if (stats.healthyInstances > 0) {
        healthyServices++;
      }
    }

    const healthPercentage =
      totalInstances > 0 ? (healthyInstances / totalInstances) * 100 : 100;

    return {
      totalServices: this.loadBalancers.size,
      healthyServices,
      totalInstances,
      healthyInstances,
      healthPercentage,
    };
  }

  /**
   * Cleanup all load balancers
   */
  cleanup(): void {
    for (const [serviceName, loadBalancer] of this.loadBalancers.entries()) {
      loadBalancer.stopHealthChecking();
    }

    this.loadBalancers.clear();
    logger.info('Load balancer manager cleaned up');
  }
}

// Global load balancer manager instance
export const loadBalancerManager = new LoadBalancerManager();
