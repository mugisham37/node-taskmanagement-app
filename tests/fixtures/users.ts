import { User } from '@prisma/client';
import argon2 from 'argon2';

export const userFixtures = {
  adminUser: {
    id: 'admin-user-id',
    email: 'admin@example.com',
    emailVerified: new Date('2024-01-01'),
    name: 'Admin User',
    image: null,
    passwordHash: '', // Will be set by createUserFixture
    mfaEnabled: true,
    totpSecret: 'JBSWY3DPEHPK3PXP',
    backupCodes: ['123456', '789012'],
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.1',
    riskScore: 0.1,
    timezone: 'UTC',
    workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    taskViewPreferences: { defaultView: 'kanban', groupBy: 'status' },
    notificationSettings: { email: true, push: true, desktop: true },
    productivitySettings: { pomodoroLength: 25, breakLength: 5 },
    avatarColor: '#3B82F6',
    activeWorkspaceId: 'test-workspace-id',
    workspacePreferences: { theme: 'dark' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as User,

  regularUser: {
    id: 'regular-user-id',
    email: 'user@example.com',
    emailVerified: new Date('2024-01-02'),
    name: 'Regular User',
    image: 'https://example.com/avatar.jpg',
    passwordHash: '', // Will be set by createUserFixture
    mfaEnabled: false,
    totpSecret: null,
    backupCodes: [],
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.2',
    riskScore: 0.0,
    timezone: 'America/New_York',
    workHours: { start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5] },
    taskViewPreferences: { defaultView: 'list', groupBy: 'priority' },
    notificationSettings: { email: true, push: false, desktop: true },
    productivitySettings: { pomodoroLength: 30, breakLength: 10 },
    avatarColor: '#10B981',
    activeWorkspaceId: 'test-workspace-id',
    workspacePreferences: { theme: 'light' },
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  } as User,

  guestUser: {
    id: 'guest-user-id',
    email: 'guest@example.com',
    emailVerified: null,
    name: 'Guest User',
    image: null,
    passwordHash: '', // Will be set by createUserFixture
    mfaEnabled: false,
    totpSecret: null,
    backupCodes: [],
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    riskScore: 0.0,
    timezone: 'UTC',
    workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    taskViewPreferences: { defaultView: 'list', groupBy: 'status' },
    notificationSettings: { email: false, push: false, desktop: false },
    productivitySettings: { pomodoroLength: 25, breakLength: 5 },
    avatarColor: '#6B7280',
    activeWorkspaceId: null,
    workspacePreferences: {},
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  } as User,

  lockedUser: {
    id: 'locked-user-id',
    email: 'locked@example.com',
    emailVerified: new Date('2024-01-04'),
    name: 'Locked User',
    image: null,
    passwordHash: '', // Will be set by createUserFixture
    mfaEnabled: false,
    totpSecret: null,
    backupCodes: [],
    failedLoginAttempts: 5,
    lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.3',
    riskScore: 0.8,
    timezone: 'UTC',
    workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    taskViewPreferences: { defaultView: 'list', groupBy: 'status' },
    notificationSettings: { email: true, push: true, desktop: true },
    productivitySettings: { pomodoroLength: 25, breakLength: 5 },
    avatarColor: '#EF4444',
    activeWorkspaceId: null,
    workspacePreferences: {},
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
  } as User,
};

export async function createUserFixture(
  fixture: keyof typeof userFixtures,
  password: string = 'test123'
): Promise<User> {
  const user = { ...userFixtures[fixture] };
  user.passwordHash = await argon2.hash(password);
  return user;
}

export async function createAllUserFixtures(): Promise<
  Record<keyof typeof userFixtures, User>
> {
  const fixtures = {} as Record<keyof typeof userFixtures, User>;

  for (const [key, value] of Object.entries(userFixtures)) {
    fixtures[key as keyof typeof userFixtures] = await createUserFixture(
      key as keyof typeof userFixtures
    );
  }

  return fixtures;
}
