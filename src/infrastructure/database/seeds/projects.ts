import { prisma } from '../prisma-client';
import { User, Workspace, Project } from '@prisma/client';

export async function seedProjects(
  workspaces: Workspace[],
  users: User[]
): Promise<Project[]> {
  const projects: Project[] = [];
  const workspace = workspaces[0];
  const adminUser = users[0];

  // Create demo projects
  const projectsData = [
    {
      name: 'Website Redesign',
      description: 'Complete redesign of the company website with modern UI/UX',
      color: '#3B82F6',
      status: 'ACTIVE' as const,
      priority: 'HIGH' as const,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-04-15'),
      budgetAmount: 50000,
      budgetCurrency: 'USD',
    },
    {
      name: 'Mobile App Development',
      description: 'Native mobile application for iOS and Android platforms',
      color: '#10B981',
      status: 'PLANNING' as const,
      priority: 'MEDIUM' as const,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-08-01'),
      budgetAmount: 75000,
      budgetCurrency: 'USD',
    },
    {
      name: 'API Integration',
      description: 'Integration with third-party APIs and services',
      color: '#F59E0B',
      status: 'ACTIVE' as const,
      priority: 'MEDIUM' as const,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-01'),
      budgetAmount: 25000,
      budgetCurrency: 'USD',
    },
  ];

  for (const projectData of projectsData) {
    const project = await prisma.project.create({
      data: {
        ...projectData,
        workspaceId: workspace.id,
        ownerId: adminUser.id,
        settings: {
          allowExternalCollaborators: false,
          requireTaskApproval: false,
          defaultTaskPriority: 'MEDIUM',
        },
      },
    });
    projects.push(project);

    // Add project members
    for (let i = 0; i < Math.min(3, users.length); i++) {
      const role = i === 0 ? 'OWNER' : i === 1 ? 'ADMIN' : 'MEMBER';

      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: users[i].id,
          role: role as any,
          addedBy: adminUser.id,
        },
      });
    }
  }

  return projects;
}
