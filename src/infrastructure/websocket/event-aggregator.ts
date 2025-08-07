import { BroadcastEvent } from './event-broadcaster';
import { logger } from '@/infrastructure/logging/logger';

export interface AggregatedEvent {
  id: string;
  type: string;
  events: BroadcastEvent[];
  aggregatedData: any;
  timestamp: number;
  count: number;
}

export interface AggregationRule {
  eventTypes: string[];
  aggregationKey: (event: BroadcastEvent) => string;
  aggregationWindow: number; // milliseconds
  maxEvents: number;
  aggregateData: (events: BroadcastEvent[]) => any;
}

export class EventAggregator {
  private aggregationRules: Map<string, AggregationRule> = new Map();
  private pendingAggregations: Map<
    string,
    {
      events: BroadcastEvent[];
      timer: NodeJS.Timeout;
      rule: AggregationRule;
    }
  > = new Map();
  private metrics = {
    eventsAggregated: 0,
    aggregationsCreated: 0,
    aggregationsSaved: 0,
  };

  constructor() {
    this.setupDefaultRules();
    logger.info('Event aggregator initialized');
  }

  /**
   * Setup default aggregation rules
   */
  private setupDefaultRules(): void {
    // Task update aggregation
    this.addRule('task-updates', {
      eventTypes: ['task.updated', 'task.created', 'task.deleted'],
      aggregationKey: event => `task:${event.data.taskId}`,
      aggregationWindow: 5000, // 5 seconds
      maxEvents: 10,
      aggregateData: events => ({
        taskId: events[0].data.taskId,
        updates: events.map(e => ({
          action: e.data.action,
          timestamp: e.timestamp,
          userId: e.source.userId,
        })),
        latestState: events[events.length - 1].data.task,
      }),
    });

    // Comment aggregation
    this.addRule('comment-updates', {
      eventTypes: ['comment.added', 'comment.updated', 'comment.deleted'],
      aggregationKey: event => `task:${event.data.taskId}:comments`,
      aggregationWindow: 3000, // 3 seconds
      maxEvents: 5,
      aggregateData: events => ({
        taskId: events[0].data.taskId,
        commentUpdates: events.map(e => ({
          commentId: e.data.commentId,
          action: e.event.split('.')[1], // added, updated, deleted
          timestamp: e.timestamp,
          userId: e.source.userId,
        })),
      }),
    });

    // Presence aggregation
    this.addRule('presence-updates', {
      eventTypes: ['presence.updated'],
      aggregationKey: event => `workspace:${event.source.workspaceId}:presence`,
      aggregationWindow: 2000, // 2 seconds
      maxEvents: 20,
      aggregateData: events => {
        const presenceMap = new Map();

        // Keep only latest presence for each user
        events.forEach(event => {
          presenceMap.set(event.source.userId, {
            userId: event.source.userId,
            status: event.data.status,
            location: event.data.location,
            timestamp: event.timestamp,
          });
        });

        return {
          workspaceId: events[0].source.workspaceId,
          presenceUpdates: Array.from(presenceMap.values()),
        };
      },
    });

    // Typing indicator aggregation
    this.addRule('typing-indicators', {
      eventTypes: ['typing.started', 'typing.stopped'],
      aggregationKey: event => `task:${event.data.taskId}:typing`,
      aggregationWindow: 1000, // 1 second
      maxEvents: 10,
      aggregateData: events => {
        const typingUsers = new Map();

        events.forEach(event => {
          const isTyping = event.event === 'typing.started';
          typingUsers.set(event.source.userId, {
            userId: event.source.userId,
            isTyping,
            timestamp: event.timestamp,
          });
        });

        return {
          taskId: events[0].data.taskId,
          typingUsers: Array.from(typingUsers.values()).filter(u => u.isTyping),
        };
      },
    });
  }

  /**
   * Add aggregation rule
   */
  addRule(ruleId: string, rule: AggregationRule): void {
    this.aggregationRules.set(ruleId, rule);

    logger.debug('Aggregation rule added', {
      ruleId,
      eventTypes: rule.eventTypes,
      aggregationWindow: rule.aggregationWindow,
    });
  }

  /**
   * Remove aggregation rule
   */
  removeRule(ruleId: string): void {
    this.aggregationRules.delete(ruleId);

    logger.debug('Aggregation rule removed', { ruleId });
  }

  /**
   * Process event for aggregation
   */
  async processEvent(
    event: BroadcastEvent
  ): Promise<BroadcastEvent | AggregatedEvent | null> {
    // Find matching rules
    const matchingRules = this.findMatchingRules(event);

    if (matchingRules.length === 0) {
      // No aggregation needed, return original event
      return event;
    }

    // Process with first matching rule (could be extended to handle multiple rules)
    const rule = matchingRules[0];
    const aggregationKey = rule.aggregationKey(event);
    const pendingKey = `${rule.eventTypes.join(',')}:${aggregationKey}`;

    // Check if there's already a pending aggregation
    const pending = this.pendingAggregations.get(pendingKey);

    if (pending) {
      // Add to existing aggregation
      pending.events.push(event);
      this.metrics.eventsAggregated++;

      // Check if we should flush early due to max events
      if (pending.events.length >= rule.maxEvents) {
        clearTimeout(pending.timer);
        return await this.flushAggregation(pendingKey, pending, rule);
      }

      // Event added to pending aggregation, don't emit yet
      return null;
    } else {
      // Start new aggregation
      const timer = setTimeout(async () => {
        const currentPending = this.pendingAggregations.get(pendingKey);
        if (currentPending) {
          await this.flushAggregation(pendingKey, currentPending, rule);
        }
      }, rule.aggregationWindow);

      this.pendingAggregations.set(pendingKey, {
        events: [event],
        timer,
        rule,
      });

      this.metrics.eventsAggregated++;

      // Event added to new aggregation, don't emit yet
      return null;
    }
  }

  /**
   * Flush aggregation and create aggregated event
   */
  private async flushAggregation(
    pendingKey: string,
    pending: {
      events: BroadcastEvent[];
      timer: NodeJS.Timeout;
      rule: AggregationRule;
    },
    rule: AggregationRule
  ): Promise<AggregatedEvent> {
    // Remove from pending
    this.pendingAggregations.delete(pendingKey);
    clearTimeout(pending.timer);

    // Create aggregated event
    const aggregatedEvent: AggregatedEvent = {
      id: this.generateAggregatedEventId(),
      type: 'aggregated',
      events: pending.events,
      aggregatedData: rule.aggregateData(pending.events),
      timestamp: Date.now(),
      count: pending.events.length,
    };

    this.metrics.aggregationsCreated++;

    logger.debug('Aggregation flushed', {
      pendingKey,
      eventCount: pending.events.length,
      aggregatedEventId: aggregatedEvent.id,
    });

    return aggregatedEvent;
  }

  /**
   * Find matching aggregation rules for event
   */
  private findMatchingRules(event: BroadcastEvent): AggregationRule[] {
    const matchingRules: AggregationRule[] = [];

    for (const rule of this.aggregationRules.values()) {
      if (rule.eventTypes.includes(event.event)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  /**
   * Force flush all pending aggregations
   */
  async flushAll(): Promise<AggregatedEvent[]> {
    const aggregatedEvents: AggregatedEvent[] = [];

    for (const [pendingKey, pending] of this.pendingAggregations) {
      const aggregatedEvent = await this.flushAggregation(
        pendingKey,
        pending,
        pending.rule
      );
      aggregatedEvents.push(aggregatedEvent);
    }

    logger.info('All pending aggregations flushed', {
      count: aggregatedEvents.length,
    });

    return aggregatedEvents;
  }

  /**
   * Get aggregation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      pendingAggregations: this.pendingAggregations.size,
      activeRules: this.aggregationRules.size,
    };
  }

  /**
   * Get pending aggregations info
   */
  getPendingAggregations(): Array<{
    key: string;
    eventCount: number;
    rule: string;
    timeRemaining: number;
  }> {
    const info: Array<{
      key: string;
      eventCount: number;
      rule: string;
      timeRemaining: number;
    }> = [];

    for (const [key, pending] of this.pendingAggregations) {
      info.push({
        key,
        eventCount: pending.events.length,
        rule: pending.rule.eventTypes.join(','),
        timeRemaining: pending.rule.aggregationWindow,
      });
    }

    return info;
  }

  /**
   * Clear all pending aggregations
   */
  clearPending(): void {
    for (const [, pending] of this.pendingAggregations) {
      clearTimeout(pending.timer);
    }

    this.pendingAggregations.clear();

    logger.info('All pending aggregations cleared');
  }

  /**
   * Generate unique aggregated event ID
   */
  private generateAggregatedEventId(): string {
    return `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown aggregator
   */
  shutdown(): void {
    this.clearPending();
    logger.info('Event aggregator shutdown');
  }
}
