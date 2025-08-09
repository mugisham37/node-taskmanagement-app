import { UserId } from '../../domain/value-objects/user-id';

export interface ICommand {
  readonly timestamp: Date;
  readonly userId: UserId;
}

export abstract class BaseCommand implements ICommand {
  public readonly timestamp: Date;

  constructor(public readonly userId: UserId) {
    this.timestamp = new Date();
  }
}
