import { prisma } from '../prisma-client';
import { User, Workspace, WorkspaceRole } from '@prisma/client';

export async function seedWorkspaces(users: User[]): Promise<Workspace[]> {
  const workspaces: Workspace[] = [];
  const adminUser = users[0]; // First user is admin

  // Create demo workspace
  const demoWorkspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description:
        'A demonstration workspace for the unified enterprise platform',
      ownerId: adminUser.id,
      subscriptionTier: 'premium',
      billingEmail: adminUser.email,
      memberLimit: 50,
      projectLimit: 20,
      storageLimitGb: 10,
      settings: {
        allowPublicProjects: false,
        requireMfaForMembers: false,
        defaultTaskView: 'kanban',
      },
      branding: {
        primaryColor: '#3B82F6',
        logo: null,
      },
    },
  });
  workspaces.push(demoWorkspace);

  // Create workspace roles
  const ownerRole = await prisma.workspaceRole.create({
    data: {
      workspaceId: demoWorkspace.id,
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
    },
  });

  const adminRole = await prisma.workspaceRole.create({
    data: {
      workspaceId: demoWorkspace.id,
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
    },
  });

  const memberRole = await prisma.workspaceRole.create({
    data: {
      workspaceId: demoWorkspace.id,
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
    },
  });

  // Add workspace members
  await prisma.workspaceMember.create({
    data: {
      workspaceId: demoWorkspace.id,
      userId: adminUser.id,
      roleId: ownerRole.id,
      status: 'ACTIVE',
    },
  });

  // Add other users as members
  for (let i = 1; i < users.length; i++) {
    const role = i === 1 ? adminRole : memberRole; // Second user is admin, rest are members

    await prisma.workspaceMember.create({
      data: {
        workspaceId: demoWorkspace.id,
        userId: users[i].id,
        roleId: role.id,
        invitedBy: adminUser.id,
        status: 'ACTIVE',
      },
    });
  }

  // Update users' active workspace
  await prisma.user.updateMany({
    where: {
      id: {
        in: users.map(u => u.id),
      },
    },
    data: {
      activeWorkspaceId: demoWorkspace.id,
    },
  });

  return workspaces;
}
