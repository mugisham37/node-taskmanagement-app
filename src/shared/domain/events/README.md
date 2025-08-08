# Event-Driven Architecture System

This directory contains the complete event-driven architecture implementation for the enterprise platform. The system provides three types of events with seamless integration between them.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Domain Events │    │ Integration      │    │ WebSocket       │
│                 │    │ Events           │    │ Events          │
│ • Business      │    │                  │    │                 │
│   Logic Events  │    │ • Cross-boundary │    │ • Real-time     │
│ • Aggregate     │    │   Communication  │    │   Updates       │
│   Changes       │    │ • Webhook        │    │ • Presence      │
│ • State         │    │   Delivery       │    │   Tracking      │
│   Transitions   │    │ • External       │    │ • Collaboration │
│                 │    │   Integration    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │ Unified Event       │
                    │ System              │
                    │                     │
                    │ • Event Bridging    │
                    │ • Cross-system      │
                    │   Integration       │
                    │ • Metrics &         │
                    │   Monitoring        │
                    └─────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │ Event Store         │
                    │                     │
                    │ • Audit Trail       │
                    │ • Event Replay      │
                    │ • Snapshots         │
                    └─────────────────────┘
```

## Components

### 1. Domain Events (`domain-event.ts`, `domain-event-bus.ts`)

Domain events represent business-significant occurrences within the system. They are published when domain entities change state or when important business rules are triggered.

**Key Features:**

- Type-safe event handling
- Correlation and causation tracking
- Automatic event store integration
- Error isolation between handlers
- Comprehensive metrics

**Example Usage:**

```typescript
import { TaskCreatedEvent } from '@/domain/task-management/events/task-events';
import { EventSystemFactory } from '@/infrastructure/events/event-system-factory';

const eventSystem = EventSystemFactory.createForProduction();

// Publish a domain event
const event = new TaskCreatedEvent(
  'task-123',
  'Implement feature X',
  'Detailed description',
  'user-456',
  'workspace-789',
  'project-101'
);

await eventSystem.publishDomainEvent(event);
```

### 2. Integration Events (`integration-event.ts`, `integration-event-bus.ts`)

Integration events facilitate communication between different bounded contexts or external systems. They include webhook delivery with retry logic and event versioning.

**Key Features:**

- Cross-boundary communication
- Webhook delivery with retry logic
- Event versioning for backward compatibility
- Routing key-based filtering
- Serialization/deserialization

**Example Usage:**

```typescript
// Integration events are typically created automatically from domain events
// through the unified event system's bridging mechanism

// Manual integration event publishing
class TaskCompletedIntegrationEvent extends IntegrationEvent {
  constructor(taskId: string, completedBy: string) {
    super({
      service: 'task-management',
      version: '1.0.0',
      userId: completedBy,
    });
  }

  getEventVersion(): string {
    return '1.0.0';
  }

  getEventData(): Record<string, any> {
    return { taskId, completedBy };
  }

  getRoutingKey(): string {
    return 'task.completed';
  }
}

await eventSystem.publishIntegrationEvent(
  new TaskCompletedIntegrationEvent('task-123', 'user-456')
);
```

### 3. WebSocket Events (`websocket-event-bus.ts`)

WebSocket events enable real-time communication with connected clients. They support presence tracking, collaboration features, and targeted broadcasting.

**Key Features:**

- Real-time event broadcasting
- Presence tracking and collaboration
- Connection management
- Room-based and user-specific targeting
- Integration with domain and integration events

**Example Usage:**

```typescript
// WebSocket events are typically created automatically through bridging
// Manual WebSocket event broadcasting
const websocketEvent: WebSocketEvent = {
  id: 'ws-event-123',
  type: 'task',
  event: 'task.updated',
  data: { taskId: 'task-123', status: 'completed' },
  timestamp: Date.now(),
  source: {
    userId: 'user-456',
    workspaceId: 'workspace-789',
  },
  target: {
    type: 'project',
    id: 'project-101',
    excludeUsers: ['user-456'],
  },
  priority: 'normal',
  persistent: true,
};

await eventSystem.broadcastWebSocketEvent(websocketEvent);
```

### 4. Event Store (`event-store.ts`)

The event store provides persistent storage for events, enabling audit trails, event replay, and system recovery.

**Key Features:**

- Event persistence with metadata
- Aggregate-based event retrieval
- Event streaming capabilities
- Snapshot support for performance
- Comprehensive indexing

**Example Usage:**

```typescript
const eventStore = eventSystem.getEventStore();

// Retrieve all events for an aggregate
const events = await eventStore.getEvents('task-123');

// Get events by type
const taskCreatedEvents = await eventStore.getEventsByType('TaskCreatedEvent');

// Stream events from a specific timestamp
for await (const event of eventStore.getEventStream(new Date('2024-01-01'))) {
  console.log('Processing event:', event.eventName);
}
```

### 5. Unified Event System (`unified-event-system.ts`)

The unified event system orchestrates all three event types and provides cross-system integration through event bridging.

**Key Features:**

- Single interface for all event types
- Automatic event bridging between systems
- Comprehensive metrics and monitoring
- Graceful shutdown and cleanup
- Factory-based configuration

**Example Usage:**

```typescript
import { EventSystemFactory } from '@/infrastructure/events/event-system-factory';

// Create for production with all features enabled
const eventSystem = EventSystemFactory.createForProduction();

// Enable automatic bridging
eventSystem.enableDomainToWebSocketBridge();
eventSystem.enableDomainToIntegrationBridge();
eventSystem.enableIntegrationToWebSocketBridge();

// Get comprehensive metrics
const metrics = eventSystem.getMetrics();
console.log('Event system metrics:', metrics);

// Graceful shutdown
await eventSystem.shutdown();
```

## Event Handlers

Event handlers process events and trigger side effects. They are automatically registered through the factory system.

**Example Handler:**

```typescript
import { DomainEventHandler } from '@/shared/events/domain-event';
import { TaskCreatedEvent } from '@/domain/task-management/events/task-events';

export class TaskCreatedNotificationHandler
  implements DomainEventHandler<TaskCreatedEvent>
{
  canHandle(event: DomainEvent): boolean {
    return event instanceof TaskCreatedEvent;
  }

  async handle(event: TaskCreatedEvent): Promise<void> {
    // Send notification to project members
    await this.notificationService.notifyProjectMembers(event.projectId, {
      type: 'task_created',
      taskId: event.taskId,
      title: event.title,
      creatorId: event.creatorId,
    });

    // Update analytics
    await this.analyticsService.recordTaskCreation(event);
  }
}
```

## Configuration

The event system can be configured for different environments:

```typescript
// Development configuration
const devEventSystem = EventSystemFactory.createForDevelopment();

// Production configuration
const prodEventSystem = EventSystemFactory.createForProduction();

// Testing configuration
const testEventSystem = EventSystemFactory.createForTesting();

// Custom configuration
const customEventSystem = EventSystemFactory.create({
  enableEventStore: true,
  enableWebhooks: true,
  enableWebSocketBridge: true,
  enableIntegrationBridge: false,
  eventStoreConfig: {
    type: 'database',
    connectionString: 'postgresql://...',
  },
  webhookConfig: {
    retryAttempts: 5,
    retryDelay: 10000,
    timeout: 60000,
  },
});
```

## Monitoring and Metrics

The system provides comprehensive metrics for monitoring:

```typescript
const metrics = eventSystem.getMetrics();

console.log('Domain Events:', {
  published: metrics.domainEvents.published,
  handled: metrics.domainEvents.handled,
  failed: metrics.domainEvents.failed,
  averageHandlingTime: metrics.domainEvents.averageHandlingTime,
});

console.log('Integration Events:', {
  published: metrics.integrationEvents.published,
  webhooksDelivered: metrics.integrationEvents.webhooksDelivered,
  webhooksFailed: metrics.integrationEvents.webhooksFailed,
});

console.log('WebSocket Events:', {
  broadcast: metrics.websocketEvents.broadcast,
  delivered: metrics.websocketEvents.delivered,
  connections: metrics.websocketEvents.connections,
});

console.log('Event Store:', {
  totalEvents: metrics.eventStore.totalEvents,
  totalSnapshots: metrics.eventStore.totalSnapshots,
  storageSize: metrics.eventStore.storageSize,
});
```

## Testing

The system includes comprehensive integration tests:

```bash
# Run event system tests
npm test src/infrastructure/events/event-system-integration.test.ts
```

## Best Practices

1. **Event Naming**: Use past tense for event names (e.g., `TaskCreatedEvent`, not `TaskCreateEvent`)

2. **Event Data**: Include all necessary data in events to avoid requiring additional queries

3. **Error Handling**: Always implement proper error handling in event handlers

4. **Idempotency**: Ensure event handlers are idempotent to handle duplicate events

5. **Performance**: Use event aggregation for high-frequency events

6. **Monitoring**: Monitor event processing metrics and set up alerts for failures

7. **Versioning**: Version integration events to maintain backward compatibility

8. **Testing**: Write comprehensive tests for event handlers and event flows

## Integration with Existing Systems

The event system integrates seamlessly with the existing infrastructure:

- **IoC Container**: Event handlers are registered through dependency injection
- **Logging**: All events and errors are logged with structured logging
- **Monitoring**: Metrics are exposed for Prometheus collection
- **WebSocket Server**: Integrates with the existing WebSocket infrastructure
- **Database**: Event store can use the existing database connection

This event-driven architecture provides the foundation for a scalable, maintainable, and observable enterprise platform.
