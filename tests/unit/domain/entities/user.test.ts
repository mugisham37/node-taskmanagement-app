import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '@/domain/entities/user';
import { Email } from '@/domain/value-objects/email';
import { UserId } from '@/domain/value-objects/user-id';
import { UserStatus } from '@/domain/value-objects/user-status';
import { TestDataFactory } from '../../../helpers/test-helpers';

describe('User Entity', () => {
  let userId: UserId;
  let email: Email;
  let userStatus: UserStatus;

  beforeEach(() => {
    userId = new UserId('user-123');
    email = new Email('test@example.com');
    userStatus = new UserStatus('ACTIVE');
  });

  describe('Constructor', () => {
    it('should create a user with valid properties', () => {
      const user = new User(
        userId,
        email,
        'John',
        'Doe',
        'hashedPassword',
        userStatus
      );

      expect(user.getId()).toBe(userId);
      expect(user.getEmail()).toBe(email);
      expect(user.getFirstName()).toBe('John');
      expect(user.getLastName()).toBe('Doe');
      expect(user.getStatus()).toBe(userStatus);
    });

    it('should throw error for invalid email', () => {
      expect(() => {
        new Email('invalid-email');
      }).toThrow();
    });

    it('should throw error for empty first name', () => {
      expect(() => {
        new User(userId, email, '', 'Doe', 'hashedPassword', userStatus);
      }).toThrow();
    });

    it('should throw error for empty last name', () => {
      expect(() => {
        new User(userId, email, 'John', '', 'hashedPassword', userStatus);
      }).toThrow();
    });
  });

  describe('Business Logic', () => {
    let user: User;

    beforeEach(() => {
      user = TestDataFactory.createUser();
    });

    it('should activate user', () => {
      user.activate();
      expect(user.getStatus().getValue()).toBe('ACTIVE');
    });

    it('should deactivate user', () => {
      user.deactivate();
      expect(user.getStatus().getValue()).toBe('INACTIVE');
    });

    it('should suspend user', () => {
      user.suspend();
      expect(user.getStatus().getValue()).toBe('SUSPENDED');
    });

    it('should update profile', () => {
      user.updateProfile('Jane', 'Smith');
      expect(user.getFirstName()).toBe('Jane');
      expect(user.getLastName()).toBe('Smith');
    });

    it('should get full name', () => {
      const user = new User(
        userId,
        email,
        'John',
        'Doe',
        'hashedPassword',
        userStatus
      );
      expect(user.getFullName()).toBe('John Doe');
    });

    it('should check if user is active', () => {
      const activeUser = new User(
        userId,
        email,
        'John',
        'Doe',
        'hashedPassword',
        new UserStatus('ACTIVE')
      );
      expect(activeUser.isActive()).toBe(true);

      const inactiveUser = new User(
        userId,
        email,
        'John',
        'Doe',
        'hashedPassword',
        new UserStatus('INACTIVE')
      );
      expect(inactiveUser.isActive()).toBe(false);
    });
  });

  describe('Domain Events', () => {
    it('should publish user created event', () => {
      const user = TestDataFactory.createUser();
      const events = user.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('UserCreated');
    });

    it('should publish user updated event when profile is updated', () => {
      const user = TestDataFactory.createUser();
      user.clearEvents(); // Clear creation event

      user.updateProfile('Jane', 'Smith');
      const events = user.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('UserUpdated');
    });

    it('should publish user status changed event', () => {
      const user = TestDataFactory.createUser();
      user.clearEvents(); // Clear creation event

      user.deactivate();
      const events = user.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].getEventType()).toBe('UserStatusChanged');
    });
  });

  describe('Validation', () => {
    it('should validate email format', () => {
      expect(() => new Email('valid@example.com')).not.toThrow();
      expect(() => new Email('invalid-email')).toThrow();
      expect(() => new Email('')).toThrow();
    });

    it('should validate user status', () => {
      expect(() => new UserStatus('ACTIVE')).not.toThrow();
      expect(() => new UserStatus('INACTIVE')).not.toThrow();
      expect(() => new UserStatus('SUSPENDED')).not.toThrow();
      expect(() => new UserStatus('INVALID_STATUS' as any)).toThrow();
    });

    it('should validate required fields', () => {
      expect(() => {
        new User(userId, email, 'John', 'Doe', 'hashedPassword', userStatus);
      }).not.toThrow();

      expect(() => {
        new User(userId, email, '', 'Doe', 'hashedPassword', userStatus);
      }).toThrow();
    });
  });
});
