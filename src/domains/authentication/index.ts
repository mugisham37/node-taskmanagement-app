/**
 * Authentication Domain Layer Exports
 * This module exports all authentication domain components
 */

// Aggregates
export { UserAggregate, UserProps } from './aggregates/user.aggregate';
export { SessionAggregate, SessionProps } from './aggregates/session.aggregate';

// Value Objects
export { UserId } from './value-objects/user-id';
export { Email } from './value-objects/email';
export { SessionId } from './value-objects/session-id';

// Domain Services
export { AuthenticationDomainService } from './services/authentication-domain.service';

// Repository Interfaces
export { IUserRepository } from './repositories/user.repository.interface';
export { ISessionRepository } from './repositories/session.repository.interface';

// Domain Events
export {
  UserRegisteredEvent,
  UserEmailVerifiedEvent,
  UserProfileUpdatedEvent,
  UserMFAEnabledEvent,
  UserMFADisabledEvent,
  UserLockedEvent,
  UserUnlockedEvent,
} from './aggregates/user.aggregate';

export {
  SessionCreatedEvent,
  SessionExpiredEvent,
  SessionWorkspaceContextChangedEvent,
  SessionRevokedEvent,
} from './aggregates/session.aggregate';

export {
  UserLoginAttemptedEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserPasswordChangedEvent,
  UserPasswordResetRequestedEvent,
  UserPasswordResetCompletedEvent,
  UserMFASetupStartedEvent,
  UserMFAVerificationAttemptedEvent,
  UserMFABackupCodeUsedEvent,
  SuspiciousActivityDetectedEvent,
  UserRiskScoreUpdatedEvent,
  UserAccountCompromisedEvent,
  SessionSecurityViolationEvent,
  MultipleSessionsDetectedEvent,
  EmailVerificationRequestedEvent,
  EmailVerificationFailedEvent,
} from './events/authentication.events';
