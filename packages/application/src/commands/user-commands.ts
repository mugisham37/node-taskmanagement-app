import { Email } from '@project/domain/value-objects/email';
import { UserId } from '@project/domain/value-objects/user-id';
import { BaseCommand } from './base-command';

export class RegisterUserCommand extends BaseCommand {
  constructor(
    public readonly email: Email,
    public readonly name: string,
    public readonly password: string,
    userId: UserId
  ) {
    super(userId);
  }
}

export class UpdateUserProfileCommand extends BaseCommand {
  constructor(
    public readonly targetUserId: UserId,
    userId: UserId,
    public readonly name?: string,
    public readonly email?: Email
  ) {
    super(userId);
  }
}

export class ChangePasswordCommand extends BaseCommand {
  constructor(
    public readonly targetUserId: UserId,
    public readonly currentPassword: string,
    public readonly newPassword: string,
    userId: UserId
  ) {
    super(userId);
  }
}

export class ActivateUserCommand extends BaseCommand {
  constructor(
    public readonly targetUserId: UserId,
    public readonly activatedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}

export class DeactivateUserCommand extends BaseCommand {
  constructor(
    public readonly targetUserId: UserId,
    public readonly deactivatedBy: UserId,
    userId: UserId
  ) {
    super(userId);
  }
}