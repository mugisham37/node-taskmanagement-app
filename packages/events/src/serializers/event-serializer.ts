import { LoggingService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';

/**
 * Serialized Event Interface
 */
export interface SerializedEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  data: string;
  metadata?: Record<string, any>;
}

/**
 * Event Serializer Interface
 */
export interface IEventSerializer {
  serialize(event: DomainEvent): SerializedEvent;
  deserialize(serializedEvent: SerializedEvent): DomainEvent;
  canHandle(eventType: string): boolean;
  getContentType(): string;
}

/**
 * Serialization Options
 */
export interface SerializationOptions {
  includeMetadata?: boolean;
  compressData?: boolean;
  encryptSensitiveData?: boolean;
  validateSchema?: boolean;
}

/**
 * Base Event Serializer
 */
export abstract class BaseEventSerializer implements IEventSerializer {
  constructor(
    protected readonly logger: LoggingService,
    protected readonly options: SerializationOptions = {}
  ) {
    this.options = {
      includeMetadata: true,
      compressData: false,
      encryptSensitiveData: false,
      validateSchema: false,
      ...options,
    };
  }

  abstract serialize(event: DomainEvent): SerializedEvent;
  abstract deserialize(serializedEvent: SerializedEvent): DomainEvent;
  abstract canHandle(eventType: string): boolean;
  abstract getContentType(): string;

  /**
   * Create base serialized event structure
   */
  protected createBaseSerializedEvent(event: DomainEvent): Omit<SerializedEvent, 'data'> {
    return {
      id: event.getEventId(),
      eventType: event.getEventName(),
      aggregateId: event.getAggregateId(),
      aggregateType: event.getAggregateType?.() || 'Unknown',
      version: event.getVersion?.() || 1,
      occurredAt: event.getOccurredOn().toISOString(),
      metadata: this.options.includeMetadata ? this.extractMetadata(event) : undefined,
    };
  }

  /**
   * Extract metadata from event
   */
  protected extractMetadata(event: DomainEvent): Record<string, any> {
    return {
      serializedAt: new Date().toISOString(),
      serializerType: this.constructor.name,
      contentType: this.getContentType(),
    };
  }

  /**
   * Validate event before serialization
   */
  protected validateEvent(event: DomainEvent): void {
    if (!event.getEventId()) {
      throw new Error('Event ID is required for serialization');
    }
    if (!event.getEventName()) {
      throw new Error('Event name is required for serialization');
    }
    if (!event.getAggregateId()) {
      throw new Error('Aggregate ID is required for serialization');
    }
  }

  /**
   * Validate serialized event before deserialization
   */
  protected validateSerializedEvent(serializedEvent: SerializedEvent): void {
    if (!serializedEvent.id) {
      throw new Error('Serialized event ID is required');
    }
    if (!serializedEvent.eventType) {
      throw new Error('Serialized event type is required');
    }
    if (!serializedEvent.data) {
      throw new Error('Serialized event data is required');
    }
  }
}

/**
 * JSON Event Serializer
 */
export class JsonEventSerializer extends BaseEventSerializer {
  constructor(logger: LoggingService, options: SerializationOptions = {}) {
    super(logger, options);
  }

  serialize(event: DomainEvent): SerializedEvent {
    try {
      this.validateEvent(event);

      const baseEvent = this.createBaseSerializedEvent(event);
      
      // Extract event data
      const eventData = this.extractEventData(event);
      
      // Serialize data to JSON
      const serializedData = JSON.stringify(eventData);

      const serializedEvent: SerializedEvent = {
        ...baseEvent,
        data: serializedData,
      };

      this.logger.debug('Event serialized to JSON', {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
        dataSize: serializedData.length,
      });

      return serializedEvent;
    } catch (error) {
      this.logger.error('Failed to serialize event to JSON', error as Error, {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
      });
      throw error;
    }
  }

  deserialize(serializedEvent: SerializedEvent): DomainEvent {
    try {
      this.validateSerializedEvent(serializedEvent);

      // Parse JSON data
      const eventData = JSON.parse(serializedEvent.data);

      // Create domain event instance
      const domainEvent = this.createDomainEvent(serializedEvent, eventData);

      this.logger.debug('Event deserialized from JSON', {
        eventId: serializedEvent.id,
        eventType: serializedEvent.eventType,
      });

      return domainEvent;
    } catch (error) {
      this.logger.error('Failed to deserialize event from JSON', error as Error, {
        eventId: serializedEvent.id,
        eventType: serializedEvent.eventType,
      });
      throw error;
    }
  }

  canHandle(eventType: string): boolean {
    // JSON serializer can handle all event types
    return true;
  }

  getContentType(): string {
    return 'application/json';
  }

  /**
   * Extract event data for serialization
   */
  private extractEventData(event: DomainEvent): Record<string, any> {
    // This is a simplified implementation
    // In a real implementation, you would extract the actual event properties
    return {
      eventId: event.getEventId(),
      eventName: event.getEventName(),
      aggregateId: event.getAggregateId(),
      occurredAt: event.getOccurredOn().toISOString(),
      // Add other event-specific properties here
    };
  }

  /**
   * Create domain event from serialized data
   */
  private createDomainEvent(serializedEvent: SerializedEvent, eventData: Record<string, any>): DomainEvent {
    // This is a simplified implementation
    // In a real implementation, you would create the appropriate event type
    // based on the eventType and reconstruct it with the eventData
    
    // For now, return a generic domain event
    return {
      getEventId: () => serializedEvent.id,
      getEventName: () => serializedEvent.eventType,
      getAggregateId: () => serializedEvent.aggregateId,
      getOccurredOn: () => new Date(serializedEvent.occurredAt),
      getVersion: () => serializedEvent.version,
      getAggregateType: () => serializedEvent.aggregateType,
    } as DomainEvent;
  }
}

/**
 * Binary Event Serializer
 */
export class BinaryEventSerializer extends BaseEventSerializer {
  constructor(logger: LoggingService, options: SerializationOptions = {}) {
    super(logger, options);
  }

  serialize(event: DomainEvent): SerializedEvent {
    try {
      this.validateEvent(event);

      const baseEvent = this.createBaseSerializedEvent(event);
      
      // Convert event to binary format (simplified implementation)
      const eventData = this.extractEventData(event);
      const jsonString = JSON.stringify(eventData);
      const binaryData = Buffer.from(jsonString, 'utf8').toString('base64');

      const serializedEvent: SerializedEvent = {
        ...baseEvent,
        data: binaryData,
      };

      this.logger.debug('Event serialized to binary', {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
        dataSize: binaryData.length,
      });

      return serializedEvent;
    } catch (error) {
      this.logger.error('Failed to serialize event to binary', error as Error, {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
      });
      throw error;
    }
  }

  deserialize(serializedEvent: SerializedEvent): DomainEvent {
    try {
      this.validateSerializedEvent(serializedEvent);

      // Decode binary data
      const jsonString = Buffer.from(serializedEvent.data, 'base64').toString('utf8');
      const eventData = JSON.parse(jsonString);

      // Create domain event instance
      const domainEvent = this.createDomainEvent(serializedEvent, eventData);

      this.logger.debug('Event deserialized from binary', {
        eventId: serializedEvent.id,
        eventType: serializedEvent.eventType,
      });

      return domainEvent;
    } catch (error) {
      this.logger.error('Failed to deserialize event from binary', error as Error, {
        eventId: serializedEvent.id,
        eventType: serializedEvent.eventType,
      });
      throw error;
    }
  }

  canHandle(eventType: string): boolean {
    // Binary serializer can handle all event types
    return true;
  }

  getContentType(): string {
    return 'application/octet-stream';
  }

  private extractEventData(event: DomainEvent): Record<string, any> {
    return {
      eventId: event.getEventId(),
      eventName: event.getEventName(),
      aggregateId: event.getAggregateId(),
      occurredAt: event.getOccurredOn().toISOString(),
    };
  }

  private createDomainEvent(serializedEvent: SerializedEvent, eventData: Record<string, any>): DomainEvent {
    return {
      getEventId: () => serializedEvent.id,
      getEventName: () => serializedEvent.eventType,
      getAggregateId: () => serializedEvent.aggregateId,
      getOccurredOn: () => new Date(serializedEvent.occurredAt),
      getVersion: () => serializedEvent.version,
      getAggregateType: () => serializedEvent.aggregateType,
    } as DomainEvent;
  }
}

/**
 * Event Serializer Registry
 */
export class EventSerializerRegistry {
  private serializers = new Map<string, IEventSerializer>();
  private defaultSerializer?: IEventSerializer;

  constructor(private readonly logger: LoggingService) {}

  /**
   * Register a serializer for specific event types
   */
  register(eventTypes: string[], serializer: IEventSerializer): void {
    for (const eventType of eventTypes) {
      this.serializers.set(eventType, serializer);
    }

    this.logger.debug('Event serializer registered', {
      eventTypes,
      serializerType: serializer.constructor.name,
      contentType: serializer.getContentType(),
    });
  }

  /**
   * Register default serializer
   */
  registerDefault(serializer: IEventSerializer): void {
    this.defaultSerializer = serializer;
    this.logger.debug('Default event serializer registered', {
      serializerType: serializer.constructor.name,
      contentType: serializer.getContentType(),
    });
  }

  /**
   * Get serializer for event type
   */
  getSerializer(eventType: string): IEventSerializer {
    const serializer = this.serializers.get(eventType) || this.defaultSerializer;
    
    if (!serializer) {
      throw new Error(`No serializer found for event type: ${eventType}`);
    }

    return serializer;
  }

  /**
   * Serialize event using appropriate serializer
   */
  serialize(event: DomainEvent): SerializedEvent {
    const serializer = this.getSerializer(event.getEventName());
    return serializer.serialize(event);
  }

  /**
   * Deserialize event using appropriate serializer
   */
  deserialize(serializedEvent: SerializedEvent): DomainEvent {
    const serializer = this.getSerializer(serializedEvent.eventType);
    return serializer.deserialize(serializedEvent);
  }

  /**
   * Get all registered serializers
   */
  getRegisteredSerializers(): Array<{
    eventTypes: string[];
    serializerType: string;
    contentType: string;
  }> {
    const result: Array<{
      eventTypes: string[];
      serializerType: string;
      contentType: string;
    }> = [];

    const serializerMap = new Map<IEventSerializer, string[]>();

    // Group event types by serializer
    for (const [eventType, serializer] of this.serializers) {
      if (!serializerMap.has(serializer)) {
        serializerMap.set(serializer, []);
      }
      serializerMap.get(serializer)!.push(eventType);
    }

    // Convert to result format
    for (const [serializer, eventTypes] of serializerMap) {
      result.push({
        eventTypes,
        serializerType: serializer.constructor.name,
        contentType: serializer.getContentType(),
      });
    }

    return result;
  }

  /**
   * Clear all registered serializers
   */
  clear(): void {
    this.serializers.clear();
    this.defaultSerializer = undefined;
    this.logger.info('Event serializer registry cleared');
  }
}