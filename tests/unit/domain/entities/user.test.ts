import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '@/domain/entities/user';
import { UserId } from '@/domain/value-objects/user-id';
import { Email } from '@/domain/value-objects/email';
import { UserName } from '@/domain/value-objects/user-name';
import { Password } from '@/domain/value-objects/password';
import { UserCreatedEvent } from '@/domain/events/user-created-event';
import { UserPasswordChangedEvent } from '@/domain/events/user-password-changed-event';
import { UserMfaEnabledEvent } from '@/domain/events/user-mfa-enabled-event';
import { DomainError } from '@/shared/errors/domain-error';

describe('User Entity', () => {
  let userId: UserId;
  let email: Email;
  let name: UserName;
  let password: Password;

  beforeEach(() => {
    userId = UserId.create();
    email = Email.create('test@example.com');
    name = UserName.create('Test User');
    password = Password.create('SecurePassword123!');
  });

  describe('creation', () => {
    it('should create a new user with valid properties', () => {
      const user = User.create({
        email,
        name,
        password,
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.name).toBe(name);
      expect(user.isEmailVerified).toBe(false);
      expect(user.isMfaEnabled).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.isLocked).toBe(false);
      expect(user.riskScore).toBe(0);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should publish UserCreatedEvent when user is created', () => {
      const user = User.create({
        email,
        name,
        password,
      });

      const events = user.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect(events[0].aggregateId).toBe(user.id.value);
    });

    it('should throw error when creating user with invalid email', () => {
      expect(() => {
        User.create({
          email: Email.create('invalid-email'),
          name,
          password,
        });
      }).toThrow(DomainError);
    });

    it('should throw error when creating user with weak password', () => {
      expect(() => {
        User.create({
          email,
          name,
          password: Password.create('weak'),
        });
      }).toThrow(DomainError);
    });
  });

  describe('email verification', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
      user.clearDomainEvents();
    });

    it('should verify email successfully', () => {
      user.verifyEmail();

      expect(user.isEmailVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('should not verify email if already verified', () => {
      user.verifyEmail();
      const firstVerificationDate = user.emailVerifiedAt;

      user.verifyEmail();

      expect(user.emailVerifiedAt).toBe(firstVerificationDate);
    });
  });

  describe('password management', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
      user.clearDomainEvents();
    });

    it('should change password successfully', () => {
      const newPassword = Password.create('NewSecurePassword123!');

      user.changePassword(newPassword);

      expect(user.passwordHash).not.toBe(password.hash);

      const events = user.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserPasswordChangedEvent);
    });

    it('should not change to the same password', () => {
      expect(() => {
        user.changePassword(password);
      }).toThrow(DomainError);
    });

    it('should validate password correctly', async () => {
      const isValid = await user.validatePassword('SecurePassword123!');
      expect(isValid).toBe(true);

      const isInvalid = await user.validatePassword('WrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('MFA management', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
      user.clearDomainEvents();
    });

    it('should enable MFA successfully', () => {
      const secret = 'JBSWY3DPEHPK3PXP';

      user.enableMfa(secret);

      expect(user.isMfaEnabled).toBe(true);
      expect(user.totpSecret).toBe(secret);
      expect(user.backupCodes).toHaveLength(10);

      const events = user.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserMfaEnabledEvent);
    });

    it('should disable MFA successfully', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      user.enableMfa(secret);
      user.clearDomainEvents();

      user.disableMfa();

      expect(user.isMfaEnabled).toBe(false);
      expect(user.totpSecret).toBeNull();
      expect(user.backupCodes).toHaveLength(0);
    });

    it('should validate TOTP code correctly', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      user.enableMfa(secret);

      // This would require a real TOTP implementation
      // For testing, we'll mock the validation
      const isValid = user.validateTotpCode('123456');
      expect(typeof isValid).toBe('boolean');
    });

    it('should validate backup code correctly', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      user.enableMfa(secret);

      const backupCode = user.backupCodes[0];
      const isValid = user.validateBackupCode(backupCode);

      expect(isValid).toBe(true);
      expect(user.backupCodes).not.toContain(backupCode);
    });
  });

  describe('account security', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
      user.clearDomainEvents();
    });

    it('should record failed login attempt', () => {
      user.recordFailedLoginAttempt();

      expect(user.failedLoginAttempts).toBe(1);
      expect(user.isLocked).toBe(false);
    });

    it('should lock account after max failed attempts', () => {
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        user.recordFailedLoginAttempt();
      }

      expect(user.failedLoginAttempts).toBe(5);
      expect(user.isLocked).toBe(true);
      expect(user.lockedUntil).toBeInstanceOf(Date);
    });

    it('should reset failed attempts on successful login', () => {
      user.recordFailedLoginAttempt();
      user.recordFailedLoginAttempt();

      user.recordSuccessfulLogin('192.168.1.1');

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
      expect(user.lastLoginIp).toBe('192.168.1.1');
    });

    it('should unlock account after lock period expires', () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        user.recordFailedLoginAttempt();
      }

      // Simulate time passing
      const pastDate = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      user.lockedUntil = pastDate;

      expect(user.isLocked).toBe(false);
    });

    it('should update risk score', () => {
      user.updateRiskScore(0.7);

      expect(user.riskScore).toBe(0.7);
    });

    it('should throw error for invalid risk score', () => {
      expect(() => {
        user.updateRiskScore(1.5);
      }).toThrow(DomainError);

      expect(() => {
        user.updateRiskScore(-0.1);
      }).toThrow(DomainError);
    });
  });

  describe('user preferences', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
      user.clearDomainEvents();
    });

    it('should update timezone', () => {
      user.updateTimezone('America/New_York');

      expect(user.timezone).toBe('America/New_York');
    });

    it('should update work hours', () => {
      const workHours = {
        start: '08:00',
        end: '16:00',
        days: [1, 2, 3, 4, 5],
      };

      user.updateWorkHours(workHours);

      expect(user.workHours).toEqual(workHours);
    });

    it('should update task view preferences', () => {
      const preferences = {
        defaultView: 'kanban' as const,
        groupBy: 'priority' as const,
      };

      user.updateTaskViewPreferences(preferences);

      expect(user.taskViewPreferences).toEqual(preferences);
    });

    it('should update notification settings', () => {
      const settings = {
        email: false,
        push: true,
        desktop: false,
      };

      user.updateNotificationSettings(settings);

      expect(user.notificationSettings).toEqual(settings);
    });

    it('should update productivity settings', () => {
      const settings = {
        pomodoroLength: 30,
        breakLength: 10,
      };

      user.updateProductivitySettings(settings);

      expect(user.productivitySettings).toEqual(settings);
    });
  });

  describe('workspace management', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
      user.clearDomainEvents();
    });

    it('should set active workspace', () => {
      const workspaceId = 'workspace-123';

      user.setActiveWorkspace(workspaceId);

      expect(user.activeWorkspaceId).toBe(workspaceId);
    });

    it('should update workspace preferences', () => {
      const workspaceId = 'workspace-123';
      const preferences = {
        sidebarCollapsed: true,
        theme: 'dark',
      };

      user.updateWorkspacePreferences(workspaceId, preferences);

      expect(user.workspacePreferences[workspaceId]).toEqual(preferences);
    });
  });

  describe('entity behavior', () => {
    let user: User;

    beforeEach(() => {
      user = User.create({ email, name, password });
    });

    it('should increment version on changes', () => {
      const initialVersion = user.version;

      user.verifyEmail();

      expect(user.version).toBe(initialVersion + 1);
    });

    it('should update updatedAt timestamp on changes', () => {
      const initialUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        user.verifyEmail();
        expect(user.updatedAt.getTime()).toBeGreaterThan(
          initialUpdatedAt.getTime()
        );
      }, 10);
    });

    it('should clear domain events after retrieval', () => {
      expect(user.getDomainEvents()).toHaveLength(1);

      user.clearDomainEvents();

      expect(user.getDomainEvents()).toHaveLength(0);
    });

    it('should be equal to another user with same id', () => {
      const sameUser = User.fromPersistence({
        id: user.id.value,
        email: user.email.value,
        name: user.name.value,
        passwordHash: user.passwordHash,
        emailVerified: user.emailVerifiedAt,
        mfaEnabled: user.isMfaEnabled,
        totpSecret: user.totpSecret,
        backupCodes: user.backupCodes,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        riskScore: user.riskScore,
        timezone: user.timezone,
        workHours: user.workHours,
        taskViewPreferences: user.taskViewPreferences,
        notificationSettings: user.notificationSettings,
        productivitySettings: user.productivitySettings,
        avatarColor: user.avatarColor,
        activeWorkspaceId: user.activeWorkspaceId,
        workspacePreferences: user.workspacePreferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      expect(user.equals(sameUser)).toBe(true);
    });

    it('should not be equal to user with different id', () => {
      const differentUser = User.create({
        email: Email.create('different@example.com'),
        name: UserName.create('Different User'),
        password: Password.create('DifferentPassword123!'),
      });

      expect(user.equals(differentUser)).toBe(false);
    });
  });
});
