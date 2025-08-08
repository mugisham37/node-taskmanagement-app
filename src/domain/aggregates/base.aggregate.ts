import { DomainEvent } from '../../shared/interfaces/event.interface';

export abstract class AggregateRoot<ID> {
    private _domainEvents: DomainEvent[] = [];

    constructor(protected readonly _id: ID) { }

    get id(): ID {
        return this._id;
    }

    get domainEvents(): DomainEvent[] {
        return this._domainEvents;
    }

    protected addDomainEvent(event: DomainEvent): void {
        this._domainEvents.push(event);
    }

    public clearEvents(): void {
        this._domainEvents = [];
    }

    protected ensureValidState(): void {
        // Override in subclasses to validate aggregate state
    }

    protected markAsModified(): void {
        // Override in subclasses to track modifications
    }
}
