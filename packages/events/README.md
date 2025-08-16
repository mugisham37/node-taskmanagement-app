# @taskmanagement/events

A comprehensive event system package providing event bus, event store, event replay, and related functionality for the task management application.

## Features

- **Event Bus**: Robust event publishing and subscription system with middleware support
- **Domain Event Bus**: Specialized event bus for domain events with retry mechanisms and performance monitoring
- **Event Store**: Event sourcing capabilities with snapshots and stream management
- **Event Publishers**: Configurable event publishers with batching and retry logic
- **Event Subscribers**: Flexible event subscription system with filtering and priority support
- **Event Middleware**: Extensible middleware pipeline for event processing
- **Event Serialization**: Pluggable serialization system supporting JSON and binary formats
- **Event Replay**: Comprehensive event replay functionality with filtering and progress tracking
- **Event Integration**: Service for integrating events across different parts of the application

## Installation

```bash
npm install @taskmanagement/events
```

## Usage

### Basic Event Bus

```typescript
import { EventBus, LoggingService } from '@taskmanagement/events';

const logger = new LoggingService();
const eventBus = new EventBus(logger);

// Subscribe to events
eventBus.subscribe(TaskCreatedEvent, {
  async handle(event: TaskCreatedEvent) {
    console.log('Task created:', event.taskId);
  }
});

// Publish events
await eventBus.publish(new TaskCreatedEvent(taskId, title, description));
```

### Domain Event Bus

```typescript
import { DomainEventBus, LoggingService } from '@taskmanagement/events';

const logger = new LoggingService();
const domainEventBus = new DomainEventBus(logger);

// Subscribe to domain events
const subscription = domainEventBus.subscribe('TaskCreated', {
  canHandle: (event) => event.getEventName() === 'TaskCreated',
  handle: async (event) => {
    // Handle the event
  },
  priority: 1
});

// Publish domain events
await domainEventBus.publish(domainEvent);
```

### Event Store

```typescript
import { InMemoryEventStore, JsonEventSerializer } from '@taskmanagement/events';

const serializer = new JsonEventSerializer(logger);
const eventStore = new InMemoryEventStore(logger, metrics, serializer);

// Append events to a stream
await eventStore.append('task-123', [event1, event2]);

// Get events from a stream
const events = await eventStore.getEvents('task-123');

// Create snapshots
await eventStore.createSnapshot('task-123', 10, snapshotData);
```

### Event Publishers

```typescript
import { EventPublisher } from '@taskmanagement/events';

const publisher = new EventPublisher(logger, metrics, {
  enableBatching: true,
  batchSize: 10,
  enableRetry: true,
  maxRetries: 3
});

// Publish single event
await publisher.publish(event);

// Publish batch of events
await publisher.publishBatch([event1, event2, event3]);

// Publish asynchronously (fire and forget)
await publisher.publishAsync(event);
```

### Event Middleware

```typescript
import { 
  EventMiddlewarePipeline,
  LoggingMiddleware,
  MetricsMiddleware,
  ValidationMiddleware 
} from '@taskmanagement/events';

const pipeline = new EventMiddlewarePipeline(logger, metrics);

// Add middleware
pipeline.use(new LoggingMiddleware(logger, 100));
pipeline.use(new MetricsMiddleware(logger, metrics, 90));
pipeline.use(new ValidationMiddleware(logger, validators, 80));

// Execute pipeline
const processedEvent = await pipeline.execute(event);
```

### Event Replay

```typescript
import { EventReplayService } from '@taskmanagement/events';

const replayService = new EventReplayService(
  eventStore,
  eventBus,
  logger,
  metrics
);

// Replay all events
const progress = await replayService.replayAllEvents();

// Replay events from a specific stream
await replayService.replayStream('task-123', 5, 10);

// Replay events by type with filter
const filter = EventReplayService.createFilters().byEventType('TaskCreated');
await replayService.replayEventsByType('TaskCreated', 0, 100);
```

### Event Serialization

```typescript
import { 
  EventSerializerRegistry,
  JsonEventSerializer,
  BinaryEventSerializer 
} from '@taskmanagement/events';

const registry = new EventSerializerRegistry(logger);

// Register serializers
registry.register(['TaskCreated', 'TaskUpdated'], new JsonEventSerializer(logger));
registry.register(['LargeEvent'], new BinaryEventSerializer(logger));
registry.registerDefault(new JsonEventSerializer(logger));

// Serialize/deserialize events
const serialized = registry.serialize(event);
const deserialized = registry.deserialize(serialized);
```

## Architecture

The events package follows a modular architecture with clear separation of concerns:

- **Bus Layer**: Core event publishing and subscription functionality
- **Publishers Layer**: Event publishing with advanced features like batching and retry
- **Subscribers Layer**: Event subscription with filtering and priority support
- **Middleware Layer**: Extensible event processing pipeline
- **Serializers Layer**: Event serialization and deserialization
- **Storage Layer**: Event persistence and retrieval
- **Replay Layer**: Event replay functionality
- **Integration Layer**: Cross-service event integration

## Configuration

### Event Bus Configuration

```typescript
const config: EventProcessingOptions = {
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  enableParallelProcessing: true,
  enableMetrics: true
};

const eventBus = new DomainEventBus(logger, config);
```

### Event Store Configuration

```typescript
const config: EventStoreConfig = {
  enableSnapshots: true,
  snapshotFrequency: 10,
  maxEventsPerRead: 1000,
  enableMetrics: true,
  enableCaching: false
};

const eventStore = new InMemoryEventStore(logger, metrics, serializer, config);
```

### Event Replay Configuration

```typescript
const config: EventReplayConfig = {
  batchSize: 100,
  delayBetweenBatches: 100,
  enableMetrics: true,
  enableErrorRecovery: true,
  maxRetries: 3,
  retryDelay: 1000
};

const replayService = new EventReplayService(eventStore, eventBus, logger, metrics, config);
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Building

```bash
# Build the package
npm run build

# Build in watch mode
npm run build:watch

# Clean build artifacts
npm run clean
```

## Dependencies

- `@taskmanagement/core`: Core utilities and base classes
- `@taskmanagement/domain`: Domain events and entities
- `@taskmanagement/database`: Database transaction management
- `@taskmanagement/cache`: Caching functionality
- `@taskmanagement/utils`: Utility functions
- `@taskmanagement/integrations`: External service integrations

## License

MIT