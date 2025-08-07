import { DomainEvent } from '../events/domain-event';

export abstract class BaseEntity<T> {
  protected readonly props: T;
  private _domainEvents: DomainEvent[] = [];
  private readonly _id: string;

  constructor(props: T, id: string) {
    this.props = props;
    this._id = id;
  }

  public get id(): string {
    return this._id;
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

  public equals(other: BaseEntity<T>): boolean {
    return this._id === other._id;
  }
}
