import { Workspace, WorkspaceRole, WorkspaceMember } from '@prisma/client';

export const workspaceFixtures = {
  testWorkspace: {
    id: 'test-workspace-id',
    name: 'Test Workspace',
    slug: 'test-workspace',
    description: 'A workspace for testing purposes',
    ownerId: 'admin-user-id',
    subscriptionTier: 'premium',
    billingEmail: 'billing@example.com',
    settings: {
      allowPublicProjects: false,
      requireMfaForMembers: true,
      defaultTaskView: 'kanban',
      workingHours: { start: '09:00', end: '17:00' },
    },
    branding: {
      primaryColor: '#3B82F6',
      logo: 'https://example.com/logo.png',
      favicon: 'https://example.com/favicon.ico',
    },
    securitySettings: {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: false,
      },
      sessionTimeout: 3600,
      ipWhitelist: [],
    },
    isActive: true,
    memberLimit: 50,
    projectLimit: 20,
    storageLimitGb: 10,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  } as Workspace,

  freeWorkspace: {
    id: 'free-workspace-id',
    name: 'Free Workspace',
    slug: 'free-workspace',
    description: 'A free tier workspace',
    ownerId: 'regular-user-id',
    subscriptionTier: 'free',
    billingEmail: null,
    settings: {
      allowPublicProjects: true,
      requireMfaForMembers: false,
      defaultTaskView: 'list',
    },
    branding: {},
    securitySettings: {},
    isActive: true,
    memberLimit: 5,
    projectLimit: 3,
    storageLimitGb: 1,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    deletedAt: null,
  } as Workspace,

  inactiveWorkspace: {
    id: 'inactive-workspace-id',
    name: 'Inactive Workspace',
    slug: 'inactive-workspace',
    description: 'An inactive workspace',
    ownerId: 'admin-user-id',
    subscriptionTier: 'free',
    billingEmail: null,
    settings: {},
    branding: {},
    securitySettings: {},
    isActive: false,
    memberLimit: 10,
    projectLimit: 5,
    storageLimitGb: 1,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    deletedAt: null,
  } as Workspace,
};

export const workspaceRoleFixtures = {
  ownerRole: {
    id: 'owner-role-id',
    workspaceId: 'test-workspace-id',
    name: 'Owner',
    description: 'Full access to workspace',
    permissions: [
      'workspace:manage',
      'workspace:delete',
      'project:create',
      'project:manage',
      'project:delete',
      'task:create',
      'task:manage',
      'task:delete',
      'team:create',
      'team:manage',
      'team:delete',
      'member:invite',
      'member:manage',
      'member:remove',
    ],
    isSystemRole: true,
    createdAt: new Date('2024-01-01'),
  } as WorkspaceRole,

  adminRole: {
    id: 'admin-role-id',
    workspaceId: 'test-workspace-id',
    name: 'Admin',
    description: 'Administrative access to workspace',
    permissions: [
      'project:create',
      'project:manage',
      'task:create',
      'task:manage',
      'team:create',
      'team:manage',
      'member:invite',
      'member:manage',
    ],
    isSystemRole: true,
    createdAt: new Date('2024-01-01'),
  } as WorkspaceRole,

  memberRole: {
    id: 'member-role-id',
    workspaceId: 'test-workspace-id',
    name: 'Member',
    description: 'Standard member access',
    permissions: [
      'project:view',
      'task:create',
      'task:manage',
      'task:view',
      'team:view',
    ],
    isSystemRole: true,
    createdAt: new Date('2024-01-01'),
  } as WorkspaceRole,

  viewerRole: {
    id: 'viewer-role-id',
    workspaceId: 'test-workspace-id',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['project:view', 'task:view', 'team:view'],
    isSystemRole: true,
    createdAt: new Date('2024-01-01'),
  } as WorkspaceRole,
};

export const workspaceMemberFixtures = {
  adminMember: {
    id: 'admin-member-id',
    workspaceId: 'test-workspace-id',
    userId: 'admin-user-id',
    roleId: 'owner-role-id',
    invitedBy: null,
    joinedAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
    status: 'ACTIVE' as const,
  } as WorkspaceMember,

  regularMember: {
    id: 'regular-member-id',
    workspaceId: 'test-workspace-id',
    userId: 'regular-user-id',
    roleId: 'member-role-id',
    invitedBy: 'admin-user-id',
    joinedAt: new Date('2024-01-02'),
    lastActiveAt: new Date(),
    status: 'ACTIVE' as const,
  } as WorkspaceMember,

  pendingMember: {
    id: 'pending-member-id',
    workspaceId: 'test-workspace-id',
    userId: 'guest-user-id',
    roleId: 'member-role-id',
    invitedBy: 'admin-user-id',
    joinedAt: new Date('2024-01-03'),
    lastActiveAt: null,
    status: 'PENDING' as const,
  } as WorkspaceMember,

  suspendedMember: {
    id: 'suspended-member-id',
    workspaceId: 'test-workspace-id',
    userId: 'locked-user-id',
    roleId: 'member-role-id',
    invitedBy: 'admin-user-id',
    joinedAt: new Date('2024-01-04'),
    lastActiveAt: new Date('2024-01-04'),
    status: 'SUSPENDED' as const,
  } as WorkspaceMember,
};

export function createWorkspaceFixture(
  fixture: keyof typeof workspaceFixtures,
  overrides: Partial<Workspace> = {}
): Workspace {
  return { ...workspaceFixtures[fixture], ...overrides };
}

export function createWorkspaceRoleFixture(
  fixture: keyof typeof workspaceRoleFixtures,
  overrides: Partial<WorkspaceRole> = {}
): WorkspaceRole {
  return { ...workspaceRoleFixtures[fixture], ...overrides };
}

export function createWorkspaceMemberFixture(
  fixture: keyof typeof workspaceMemberFixtures,
  overrides: Partial<WorkspaceMember> = {}
): WorkspaceMember {
  return { ...workspaceMemberFixtures[fixture], ...overrides };
}
