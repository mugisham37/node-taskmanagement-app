import { DomainEvent } from '../events/DomainEvent';

export abstract class BaseEntity<T> {
  protected readonly props: T;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: T) {
    this.props = props;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  public hasDomainEvents(): boolean {
    return this._domainEvents.length > 0;
  }
}
