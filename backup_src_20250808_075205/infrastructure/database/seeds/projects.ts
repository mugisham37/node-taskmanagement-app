import { prisma } from '../prisma-client';
import { User, Workspace, Project } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedProjects(
  workspaces: Workspace[],
  users: User[]
): Promise<Project[]> {
  const projects: Project[] = [];
  const adminUser = users[0];

  // Create projects across all workspaces
  for (const workspace of workspaces) {
    const workspaceProjects = await createWorkspaceProjects(
      workspace,
      users,
      adminUser
    );
    projects.push(...workspaceProjects);
  }

  return projects;
}

async function createWorkspaceProjects(
  workspace: Workspace,
  users: User[],
  adminUser: User
): Promise<Project[]> {
  const projects: Project[] = [];

  // Define realistic project templates based on workspace type
  const projectTemplates = getProjectTemplatesForWorkspace(workspace.name);

  for (const template of projectTemplates) {
    const project = await prisma.project.create({
      data: {
        ...template,
        workspaceId: workspace.id,
        ownerId: adminUser.id,
        createdAt: faker.date.past({ years: 1 }),
        updatedAt: faker.date.recent({ days: 30 }),
      },
    });
    projects.push(project);

    // Add project members with realistic distribution
    await addProjectMembers(project, users, adminUser);

    // Create teams for larger projects
    if (template.priority === 'HIGH' || template.priority === 'URGENT') {
      await createProjectTeams(project, users, adminUser);
    }
  }

  // Create some archived projects
  const archivedProjects = await createArchivedProjects(
    workspace,
    users,
    adminUser
  );
  projects.push(...archivedProjects);

  return projects;
}

function getProjectTemplatesForWorkspace(workspaceName: string) {
  const baseTemplates = {
    'Acme Corporation': [
      {
        name: 'Enterprise Platform Migration',
        description:
          'Migration of legacy systems to modern cloud-based enterprise platform with microservices architecture',
        color: '#3B82F6',
        status: 'ACTIVE' as const,
        priority: 'URGENT' as const,
        startDate: faker.date.past({ years: 0.5 }),
        endDate: faker.date.future({ years: 0.5 }),
        budgetAmount: 500000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: false,
          requireTaskApproval: true,
          defaultTaskPriority: 'HIGH',
          enableTimeTracking: true,
          autoAssignTasks: false,
          notifyOnTaskUpdates: true,
          customFields: {
            department: 'IT',
            compliance: 'SOX',
            riskLevel: 'High',
          },
        },
      },
      {
        name: 'Customer Portal Redesign',
        description:
          'Complete overhaul of customer-facing portal with improved UX and self-service capabilities',
        color: '#10B981',
        status: 'ACTIVE' as const,
        priority: 'HIGH' as const,
        startDate: faker.date.past({ years: 0.3 }),
        endDate: faker.date.future({ years: 0.3 }),
        budgetAmount: 150000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: false,
          defaultTaskPriority: 'MEDIUM',
          enableTimeTracking: true,
          autoAssignTasks: true,
          notifyOnTaskUpdates: true,
          customFields: {
            department: 'Marketing',
            customerImpact: 'High',
          },
        },
      },
      {
        name: 'Security Compliance Audit',
        description:
          'Comprehensive security audit and compliance implementation for SOC 2 Type II certification',
        color: '#EF4444',
        status: 'PLANNING' as const,
        priority: 'HIGH' as const,
        startDate: faker.date.future({ years: 0.1 }),
        endDate: faker.date.future({ years: 0.4 }),
        budgetAmount: 75000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: true,
          defaultTaskPriority: 'HIGH',
          enableTimeTracking: true,
          autoAssignTasks: false,
          notifyOnTaskUpdates: true,
          customFields: {
            department: 'Security',
            compliance: 'SOC2',
            auditor: 'External',
          },
        },
      },
      {
        name: 'Data Analytics Platform',
        description:
          'Implementation of enterprise data analytics platform with real-time dashboards and reporting',
        color: '#8B5CF6',
        status: 'ACTIVE' as const,
        priority: 'MEDIUM' as const,
        startDate: faker.date.past({ years: 0.2 }),
        endDate: faker.date.future({ years: 0.6 }),
        budgetAmount: 200000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: false,
          requireTaskApproval: false,
          defaultTaskPriority: 'MEDIUM',
          enableTimeTracking: true,
          autoAssignTasks: true,
          notifyOnTaskUpdates: false,
          customFields: {
            department: 'Analytics',
            dataSource: 'Multiple',
          },
        },
      },
    ],
    'Startup Hub': [
      {
        name: 'MVP Development',
        description:
          'Rapid development of minimum viable product for market validation',
        color: '#F59E0B',
        status: 'ACTIVE' as const,
        priority: 'URGENT' as const,
        startDate: faker.date.past({ years: 0.1 }),
        endDate: faker.date.future({ years: 0.2 }),
        budgetAmount: 25000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: false,
          defaultTaskPriority: 'HIGH',
          enableTimeTracking: true,
          autoAssignTasks: true,
          notifyOnTaskUpdates: true,
          customFields: {
            stage: 'MVP',
            funding: 'Seed',
          },
        },
      },
      {
        name: 'User Research & Testing',
        description:
          'Comprehensive user research and usability testing for product-market fit',
        color: '#06B6D4',
        status: 'ACTIVE' as const,
        priority: 'HIGH' as const,
        startDate: faker.date.past({ years: 0.05 }),
        endDate: faker.date.future({ years: 0.15 }),
        budgetAmount: 15000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: false,
          defaultTaskPriority: 'MEDIUM',
          enableTimeTracking: false,
          autoAssignTasks: false,
          notifyOnTaskUpdates: true,
          customFields: {
            researchType: 'Qualitative',
            targetUsers: '100',
          },
        },
      },
      {
        name: 'Marketing Launch Campaign',
        description:
          'Digital marketing campaign for product launch and user acquisition',
        color: '#EC4899',
        status: 'PLANNING' as const,
        priority: 'MEDIUM' as const,
        startDate: faker.date.future({ years: 0.1 }),
        endDate: faker.date.future({ years: 0.3 }),
        budgetAmount: 30000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: true,
          defaultTaskPriority: 'MEDIUM',
          enableTimeTracking: false,
          autoAssignTasks: true,
          notifyOnTaskUpdates: true,
          customFields: {
            channels: 'Digital',
            targetCAC: '$50',
          },
        },
      },
    ],
    'Creative Agency': [
      {
        name: 'Brand Identity Redesign',
        description:
          'Complete brand identity redesign including logo, colors, and brand guidelines',
        color: '#F97316',
        status: 'ACTIVE' as const,
        priority: 'HIGH' as const,
        startDate: faker.date.past({ years: 0.1 }),
        endDate: faker.date.future({ years: 0.2 }),
        budgetAmount: 40000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: true,
          defaultTaskPriority: 'HIGH',
          enableTimeTracking: true,
          autoAssignTasks: false,
          notifyOnTaskUpdates: true,
          customFields: {
            client: 'TechCorp',
            deliverables: 'Logo, Guidelines, Assets',
          },
        },
      },
      {
        name: 'Website Design & Development',
        description:
          'Custom website design and development with CMS integration',
        color: '#84CC16',
        status: 'ACTIVE' as const,
        priority: 'MEDIUM' as const,
        startDate: faker.date.past({ years: 0.2 }),
        endDate: faker.date.future({ years: 0.1 }),
        budgetAmount: 25000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: false,
          requireTaskApproval: false,
          defaultTaskPriority: 'MEDIUM',
          enableTimeTracking: true,
          autoAssignTasks: true,
          notifyOnTaskUpdates: false,
          customFields: {
            client: 'LocalBiz',
            cms: 'WordPress',
          },
        },
      },
      {
        name: 'Social Media Campaign',
        description:
          'Multi-platform social media campaign with content creation and management',
        color: '#A855F7',
        status: 'ON_HOLD' as const,
        priority: 'LOW' as const,
        startDate: faker.date.future({ years: 0.05 }),
        endDate: faker.date.future({ years: 0.25 }),
        budgetAmount: 12000,
        budgetCurrency: 'USD',
        settings: {
          allowExternalCollaborators: true,
          requireTaskApproval: true,
          defaultTaskPriority: 'LOW',
          enableTimeTracking: false,
          autoAssignTasks: true,
          notifyOnTaskUpdates: true,
          customFields: {
            client: 'FashionBrand',
            platforms: 'Instagram, TikTok, Facebook',
          },
        },
      },
    ],
  };

  return baseTemplates[workspaceName as keyof typeof baseTemplates] || [];
}

async function addProjectMembers(
  project: Project,
  users: User[],
  adminUser: User
) {
  // Add project owner
  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: adminUser.id,
      role: 'OWNER',
      addedBy: adminUser.id,
      addedAt: project.createdAt,
    },
  });

  // Add other members based on project priority and budget
  const memberCount =
    project.priority === 'URGENT' ? 6 : project.priority === 'HIGH' ? 4 : 2;
  const availableUsers = users.slice(1, memberCount + 1);

  for (let i = 0; i < availableUsers.length; i++) {
    const user = availableUsers[i];
    const role =
      i === 0
        ? 'ADMIN'
        : faker.helpers.arrayElement(['MEMBER', 'MEMBER', 'VIEWER']);

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: role as any,
        addedBy: adminUser.id,
        addedAt: faker.date.between({
          from: project.createdAt,
          to: new Date(),
        }),
      },
    });
  }
}

async function createProjectTeams(
  project: Project,
  users: User[],
  adminUser: User
) {
  const teamNames = [
    'Development Team',
    'Design Team',
    'QA Team',
    'DevOps Team',
    'Product Team',
  ];

  const selectedTeams = faker.helpers.arrayElements(teamNames, {
    min: 1,
    max: 3,
  });

  for (const teamName of selectedTeams) {
    const team = await prisma.team.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        name: teamName,
        description: `${teamName} for ${project.name}`,
        color: faker.internet.color(),
        settings: {
          allowExternalMembers: false,
          requireApprovalForTasks: teamName.includes('QA'),
        },
      },
    });

    // Add team members
    const teamSize = faker.number.int({ min: 2, max: 5 });
    const teamUsers = faker.helpers.arrayElements(users, teamSize);

    for (let i = 0; i < teamUsers.length; i++) {
      const user = teamUsers[i];
      const role = i === 0 ? 'LEAD' : 'MEMBER';

      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: role as any,
          joinedAt: faker.date.between({
            from: project.createdAt,
            to: new Date(),
          }),
        },
      });
    }
  }
}

async function createArchivedProjects(
  workspace: Workspace,
  users: User[],
  adminUser: User
): Promise<Project[]> {
  const archivedProjects: Project[] = [];

  // Create 2-3 archived projects per workspace
  const archivedCount = faker.number.int({ min: 2, max: 3 });

  for (let i = 0; i < archivedCount; i++) {
    const completedDate = faker.date.past({ years: 1 });
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        ownerId: adminUser.id,
        name: faker.company.buzzPhrase(),
        description: faker.lorem.paragraph(),
        color: faker.internet.color(),
        status: 'COMPLETED',
        priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']),
        startDate: faker.date.past({ years: 1.5 }),
        endDate: completedDate,
        budgetAmount: faker.number.int({ min: 5000, max: 100000 }),
        budgetCurrency: 'USD',
        isArchived: true,
        archivedAt: faker.date.between({ from: completedDate, to: new Date() }),
        archivedBy: adminUser.id,
        settings: {
          allowExternalCollaborators: faker.datatype.boolean(),
          requireTaskApproval: faker.datatype.boolean(),
          defaultTaskPriority: 'MEDIUM',
          enableTimeTracking: true,
          autoAssignTasks: faker.datatype.boolean(),
          notifyOnTaskUpdates: false,
        },
        createdAt: faker.date.past({ years: 2 }),
        updatedAt: completedDate,
      },
    });

    archivedProjects.push(project);

    // Add minimal project members for archived projects
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: adminUser.id,
        role: 'OWNER',
        addedBy: adminUser.id,
        addedAt: project.createdAt,
      },
    });
  }

  return archivedProjects;
}
