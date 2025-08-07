import { prisma } from '../prisma-client';
import { User, Workspace, WorkspaceRole } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedWorkspaces(users: User[]): Promise<Workspace[]> {
  const workspaces: Workspace[] = [];
  const adminUser = users[0]; // First user is admin

  // Create multiple workspaces for comprehensive testing
  const workspaceData = [
    {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description:
        'Main corporate workspace for Acme Corporation with comprehensive project management',
      subscriptionTier: 'enterprise',
      memberLimit: -1, // Unlimited
      projectLimit: -1, // Unlimited
      storageLimitGb: 1000,
      settings: {
        allowPublicProjects: false,
        requireMfaForMembers: true,
        defaultTaskView: 'kanban',
        enableTimeTracking: true,
        allowGuestAccess: false,
        workingDays: [1, 2, 3, 4, 5],
        workingHours: { start: '09:00', end: '17:00' },
        autoArchiveCompletedTasks: true,
        taskAutoAssignment: false,
      },
      branding: {
        primaryColor: '#3B82F6',
        secondaryColor: '#64748B',
        logo: null,
      },
      securitySettings: {
        enforcePasswordPolicy: true,
        requireMfa: true,
        sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
        allowedDomains: ['acme.com'],
        ipWhitelist: [],
      },
    },
    {
      name: 'Startup Hub',
      slug: 'startup-hub',
      description: 'Agile workspace for startup teams and rapid prototyping',
      subscriptionTier: 'professional',
      memberLimit: 100,
      projectLimit: 50,
      storageLimitGb: 100,
      settings: {
        allowPublicProjects: true,
        requireMfaForMembers: false,
        defaultTaskView: 'list',
        enableTimeTracking: true,
        allowGuestAccess: true,
        workingDays: [1, 2, 3, 4, 5, 6],
        workingHours: { start: '08:00', end: '20:00' },
        autoArchiveCompletedTasks: false,
        taskAutoAssignment: true,
      },
      branding: {
        primaryColor: '#10B981',
        secondaryColor: '#6B7280',
        logo: null,
      },
      securitySettings: {
        enforcePasswordPolicy: false,
        requireMfa: false,
        sessionTimeout: 12 * 60 * 60 * 1000, // 12 hours
        allowedDomains: [],
        ipWhitelist: [],
      },
    },
    {
      name: 'Creative Agency',
      slug: 'creative-agency',
      description:
        'Design-focused workspace for creative projects and client work',
      subscriptionTier: 'basic',
      memberLimit: 25,
      projectLimit: 10,
      storageLimitGb: 10,
      settings: {
        allowPublicProjects: false,
        requireMfaForMembers: false,
        defaultTaskView: 'calendar',
        enableTimeTracking: true,
        allowGuestAccess: true,
        workingDays: [1, 2, 3, 4, 5],
        workingHours: { start: '10:00', end: '18:00' },
        autoArchiveCompletedTasks: true,
        taskAutoAssignment: false,
      },
      branding: {
        primaryColor: '#F59E0B',
        secondaryColor: '#9CA3AF',
        logo: null,
      },
      securitySettings: {
        enforcePasswordPolicy: false,
        requireMfa: false,
        sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours
        allowedDomains: [],
        ipWhitelist: [],
      },
    },
  ];

  for (const wsData of workspaceData) {
    const workspace = await prisma.workspace.create({
      data: {
        ...wsData,
        ownerId: adminUser.id,
        billingEmail: adminUser.email,
        isActive: true,
      },
    });
    workspaces.push(workspace);

    // Create comprehensive workspace roles for each workspace
    const roles = await createWorkspaceRoles(workspace.id);

    // Add workspace members with realistic distribution
    await addWorkspaceMembers(workspace, users, roles);
  }

  // Update users' active workspace to the first one
  await prisma.user.updateMany({
    where: {
      id: {
        in: users.map(u => u.id),
      },
    },
    data: {
      activeWorkspaceId: workspaces[0].id,
    },
  });

  return workspaces;
}

async function createWorkspaceRoles(workspaceId: string) {
  const ownerRole = await prisma.workspaceRole.create({
    data: {
      workspaceId,
      name: 'Owner',
      description:
        'Full access to workspace with billing and administrative privileges',
      permissions: [
        'workspace:manage',
        'workspace:delete',
        'workspace:billing',
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
        'role:create',
        'role:manage',
        'role:delete',
        'webhook:create',
        'webhook:manage',
        'webhook:delete',
        'analytics:view',
        'audit:view',
      ],
      isSystemRole: true,
    },
  });

  const adminRole = await prisma.workspaceRole.create({
    data: {
      workspaceId,
      name: 'Admin',
      description:
        'Administrative access to workspace without billing privileges',
      permissions: [
        'workspace:view',
        'project:create',
        'project:manage',
        'project:delete',
        'task:create',
        'task:manage',
        'task:delete',
        'team:create',
        'team:manage',
        'member:invite',
        'member:manage',
        'webhook:create',
        'webhook:manage',
        'analytics:view',
      ],
      isSystemRole: true,
    },
  });

  const managerRole = await prisma.workspaceRole.create({
    data: {
      workspaceId,
      name: 'Manager',
      description: 'Project management access with team oversight',
      permissions: [
        'workspace:view',
        'project:create',
        'project:manage',
        'task:create',
        'task:manage',
        'task:delete',
        'team:manage',
        'member:invite',
        'analytics:view',
      ],
      isSystemRole: true,
    },
  });

  const memberRole = await prisma.workspaceRole.create({
    data: {
      workspaceId,
      name: 'Member',
      description: 'Standard member access for task and project participation',
      permissions: [
        'workspace:view',
        'project:view',
        'project:create',
        'task:create',
        'task:manage',
        'task:view',
        'team:view',
        'comment:create',
        'comment:manage',
      ],
      isSystemRole: true,
    },
  });

  const viewerRole = await prisma.workspaceRole.create({
    data: {
      workspaceId,
      name: 'Viewer',
      description: 'Read-only access to workspace content',
      permissions: [
        'workspace:view',
        'project:view',
        'task:view',
        'team:view',
        'comment:view',
      ],
      isSystemRole: true,
    },
  });

  return { ownerRole, adminRole, managerRole, memberRole, viewerRole };
}

async function addWorkspaceMembers(
  workspace: Workspace,
  users: User[],
  roles: {
    ownerRole: WorkspaceRole;
    adminRole: WorkspaceRole;
    managerRole: WorkspaceRole;
    memberRole: WorkspaceRole;
    viewerRole: WorkspaceRole;
  }
) {
  const adminUser = users[0];

  // Add owner
  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      roleId: roles.ownerRole.id,
      status: 'ACTIVE',
      joinedAt: faker.date.past({ years: 1 }),
      lastActiveAt: faker.date.recent({ days: 1 }),
    },
  });

  // Distribute other users across roles realistically
  const remainingUsers = users.slice(1);
  const roleDistribution = [
    {
      role: roles.adminRole,
      count: Math.min(2, Math.floor(remainingUsers.length * 0.1)),
    },
    {
      role: roles.managerRole,
      count: Math.min(3, Math.floor(remainingUsers.length * 0.15)),
    },
    { role: roles.memberRole, count: Math.floor(remainingUsers.length * 0.7) },
    { role: roles.viewerRole, count: Math.floor(remainingUsers.length * 0.05) },
  ];

  let userIndex = 0;
  for (const { role, count } of roleDistribution) {
    for (let i = 0; i < count && userIndex < remainingUsers.length; i++) {
      const user = remainingUsers[userIndex++];
      const status = faker.helpers.weightedArrayElement([
        { weight: 85, value: 'ACTIVE' },
        { weight: 10, value: 'INACTIVE' },
        { weight: 5, value: 'PENDING' },
      ]);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          roleId: role.id,
          invitedBy: adminUser.id,
          status,
          joinedAt: faker.date.past({ years: 1 }),
          lastActiveAt:
            status === 'ACTIVE' ? faker.date.recent({ days: 7 }) : null,
        },
      });
    }
  }
}
