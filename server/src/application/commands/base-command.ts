import { UserId } from '../../domain/value-objects/user-id';

export interface ICommand {
  readonly commandId: string;
  readonly timestamp: Date;
  readonly userId: UserId;
  readonly correlationId?: string;
}

export abstract class BaseCommand implements ICommand {
  public readonly commandId: string;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    public readonly userId: UserId,
    correlationId?: string
  ) {
    this.commandId = this.generateId();
    this.timestamp = new Date();
    if (correlationId) {
      this.correlationId = correlationId;
    }
  }

  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
