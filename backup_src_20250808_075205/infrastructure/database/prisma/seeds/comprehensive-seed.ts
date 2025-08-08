import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

interface SeedData {
  users: any[];
  workspaces: any[];
  projects: any[];
  tasks: any[];
  teams: any[];
  comments: any[];
  timeEntries: any[];
}

export class ComprehensiveDatabaseSeeder {
  private seedData: SeedData = {
    users: [],
    workspaces: [],
    projects: [],
    tasks: [],
    teams: [],
    comments: [],
    timeEntries: [],
  };

  async seed(): Promise<void> {
    console.log('🌱 Starting comprehensive database seeding...');

    try {
      // Clean existing data
      await this.cleanDatabase();

      // Create seed data
      await this.createUsers();
      await this.createWorkspaces();
      await this.createProjects();
      await this.createTasks();
      await this.createTeams();
      await this.createComments();
      await this.createTimeEntries();
      await this.createDependencies();

      console.log('✅ Comprehensive seeding completed successfully!');
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  private async cleanDatabase(): Promise<void> {
    console.log('🧹 Cleaning existing data...');

    // Delete in reverse dependency order
    await prisma.timeEntry.deleteMany();
    await prisma.taskDependency.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.task.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspaceRole.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  }

  private async createUsers(): Promise<void> {
    console.log('👥 Creating users...');

    const users = [];
    for (let i = 0; i < 50; i++) {
      const user = {
        id: faker.string.uuid(),
        email: faker.internet.email(),
        name: faker.person.fullName(),
        passwordHash: faker.string.alphanumeric(60),
        timezone: faker.location.timeZone(),
        avatarColor: faker.color.rgb(),
        createdAt: faker.date.past({ years: 2 }),
        updatedAt: new Date(),
      };
      users.push(user);
    }

    await prisma.user.createMany({ data: users });
    this.seedData.users = await prisma.user.findMany();
    console.log(`✅ Created ${users.length} users`);
  }

  private async createWorkspaces(): Promise<void> {
    console.log('🏢 Creating workspaces...');

    const workspaces = [];
    for (let i = 0; i < 10; i++) {
      const owner = faker.helpers.arrayElement(this.seedData.users);
      const workspace = {
        id: faker.string.uuid(),
        name: faker.company.name(),
        slug: faker.internet.domainWord(),
        description: faker.company.catchPhrase(),
        ownerId: owner.id,
        subscriptionTier: faker.helpers.arrayElement([
          'free',
          'pro',
          'enterprise',
        ]),
        billingEmail: faker.internet.email(),
        settings: {
          theme: faker.helpers.arrayElement(['light', 'dark']),
          language: 'en',
          timezone: faker.location.timeZone(),
        },
        branding: {
          primaryColor: faker.color.rgb(),
          logo: faker.image.url(),
        },
        securitySettings: {
          mfaRequired: faker.datatype.boolean(),
          sessionTimeout: faker.number.int({ min: 30, max: 480 }),
        },
        memberLimit: faker.number.int({ min: 10, max: 100 }),
        projectLimit: faker.number.int({ min: 5, max: 50 }),
        storageLimitGb: faker.number.int({ min: 1, max: 100 }),
        createdAt: faker.date.past({ years: 1 }),
        updatedAt: new Date(),
      };
      workspaces.push(workspace);
    }

    await prisma.workspace.createMany({ data: workspaces });
    this.seedData.workspaces = await prisma.workspace.findMany();

    // Create workspace roles and members
    for (const workspace of this.seedData.workspaces) {
      await this.createWorkspaceRolesAndMembers(workspace);
    }

    console.log(
      `✅ Created ${workspaces.length} workspaces with roles and members`
    );
  }

  private async createWorkspaceRolesAndMembers(workspace: any): Promise<void> {
    // Create default roles
    const roles = [
      {
        id: faker.string.uuid(),
        workspaceId: workspace.id,
        name: 'Admin',
        description: 'Full workspace administration',
        permissions: [
          'workspace:admin',
          'project:admin',
          'task:admin',
          'user:admin',
        ],
        isSystemRole: true,
      },
      {
        id: faker.string.uuid(),
        workspaceId: workspace.id,
        name: 'Manager',
        description: 'Project and team management',
        permissions: ['project:admin', 'task:admin', 'user:manage'],
        isSystemRole: true,
      },
      {
        id: faker.string.uuid(),
        workspaceId: workspace.id,
        name: 'Member',
        description: 'Standard workspace member',
        permissions: ['task:create', 'task:edit', 'project:view'],
        isSystemRole: true,
      },
      {
        id: faker.string.uuid(),
        workspaceId: workspace.id,
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['project:view', 'task:view'],
        isSystemRole: true,
      },
    ];

    await prisma.workspaceRole.createMany({ data: roles });

    // Add workspace members
    const memberCount = faker.number.int({ min: 5, max: 20 });
    const availableUsers = faker.helpers.arrayElements(
      this.seedData.users,
      memberCount
    );
    const createdRoles = await prisma.workspaceRole.findMany({
      where: { workspaceId: workspace.id },
    });

    for (const user of availableUsers) {
      const role = faker.helpers.arrayElement(createdRoles);
      await prisma.workspaceMember.create({
        data: {
          id: faker.string.uuid(),
          workspaceId: workspace.id,
          userId: user.id,
          roleId: role.id,
          invitedBy: workspace.ownerId,
          joinedAt: faker.date.past({ years: 1 }),
          lastActiveAt: faker.date.recent({ days: 30 }),
          status: faker.helpers.arrayElement(['ACTIVE', 'INACTIVE', 'PENDING']),
        },
      });
    }
  }

  private async createProjects(): Promise<void> {
    console.log('📁 Creating projects...');

    const projects = [];
    for (const workspace of this.seedData.workspaces) {
      const projectCount = faker.number.int({ min: 2, max: 8 });
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.id },
        include: { user: true },
      });

      for (let i = 0; i < projectCount; i++) {
        const owner = faker.helpers.arrayElement(workspaceMembers);
        const project = {
          id: faker.string.uuid(),
          workspaceId: workspace.id,
          name: faker.commerce.productName(),
          description: faker.lorem.paragraph(),
          color: faker.color.rgb(),
          ownerId: owner.userId,
          status: faker.helpers.arrayElement([
            'PLANNING',
            'ACTIVE',
            'ON_HOLD',
            'COMPLETED',
            'CANCELLED',
          ]),
          priority: faker.helpers.arrayElement([
            'LOW',
            'MEDIUM',
            'HIGH',
            'URGENT',
          ]),
          startDate: faker.date.past({ years: 1 }),
          endDate: faker.date.future({ years: 1 }),
          budgetAmount: faker.number.float({
            min: 1000,
            max: 100000,
            fractionDigits: 2,
          }),
          budgetCurrency: 'USD',
          settings: {
            allowSubtasks: faker.datatype.boolean(),
            requireApproval: faker.datatype.boolean(),
            autoAssign: faker.datatype.boolean(),
          },
          isArchived: faker.datatype.boolean({ probability: 0.1 }),
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: new Date(),
        };
        projects.push(project);
      }
    }

    await prisma.project.createMany({ data: projects });
    this.seedData.projects = await prisma.project.findMany();

    // Create project members
    for (const project of this.seedData.projects) {
      await this.createProjectMembers(project);
    }

    console.log(`✅ Created ${projects.length} projects with members`);
  }

  private async createProjectMembers(project: any): Promise<void> {
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: project.workspaceId },
    });

    const memberCount = faker.number.int({ min: 2, max: 8 });
    const selectedMembers = faker.helpers.arrayElements(
      workspaceMembers,
      memberCount
    );

    for (const member of selectedMembers) {
      await prisma.projectMember.create({
        data: {
          id: faker.string.uuid(),
          projectId: project.id,
          userId: member.userId,
          role: faker.helpers.arrayElement([
            'OWNER',
            'ADMIN',
            'MEMBER',
            'VIEWER',
          ]),
          addedBy: project.ownerId,
          addedAt: faker.date.past({ months: 6 }),
        },
      });
    }
  }

  private async createTasks(): Promise<void> {
    console.log('📋 Creating tasks...');

    const tasks = [];
    for (const project of this.seedData.projects) {
      const taskCount = faker.number.int({ min: 10, max: 50 });
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: project.id },
      });

      for (let i = 0; i < taskCount; i++) {
        const creator = faker.helpers.arrayElement(projectMembers);
        const assignee = faker.helpers.arrayElement([...projectMembers, null]);
        const reporter = faker.helpers.arrayElement([...projectMembers, null]);

        const task = {
          id: faker.string.uuid(),
          workspaceId: project.workspaceId,
          projectId: project.id,
          title: faker.lorem.sentence({ min: 3, max: 8 }),
          description: faker.lorem.paragraphs(2),
          status: faker.helpers.arrayElement([
            'TODO',
            'IN_PROGRESS',
            'IN_REVIEW',
            'DONE',
            'CANCELLED',
          ]),
          priority: faker.helpers.arrayElement([
            'LOW',
            'MEDIUM',
            'HIGH',
            'URGENT',
          ]),
          assigneeId: assignee?.userId || null,
          creatorId: creator.userId,
          reporterId: reporter?.userId || null,
          dueDate: faker.date.future({ years: 1 }),
          startDate: faker.date.past({ months: 3 }),
          completedAt: faker.helpers.maybe(
            () => faker.date.recent({ days: 30 }),
            { probability: 0.3 }
          ),
          estimatedHours: faker.number.float({
            min: 1,
            max: 40,
            fractionDigits: 2,
          }),
          actualHours: faker.number.float({
            min: 0,
            max: 50,
            fractionDigits: 2,
          }),
          storyPoints: faker.number.int({ min: 1, max: 13 }),
          tags: faker.helpers.arrayElements(
            ['frontend', 'backend', 'bug', 'feature', 'urgent', 'research'],
            { min: 0, max: 3 }
          ),
          labels: faker.helpers.arrayElements(
            ['v1.0', 'v2.0', 'hotfix', 'enhancement'],
            { min: 0, max: 2 }
          ),
          attachments: [],
          externalLinks: [],
          watchers: faker.helpers.arrayElements(
            projectMembers.map(m => m.userId),
            { min: 0, max: 3 }
          ),
          lastActivityAt: faker.date.recent({ days: 7 }),
          customFields: {
            complexity: faker.helpers.arrayElement(['low', 'medium', 'high']),
            category: faker.helpers.arrayElement([
              'development',
              'design',
              'testing',
              'documentation',
            ]),
          },
          position: i,
          createdAt: faker.date.past({ months: 6 }),
          updatedAt: faker.date.recent({ days: 30 }),
        };
        tasks.push(task);
      }
    }

    await prisma.task.createMany({ data: tasks });
    this.seedData.tasks = await prisma.task.findMany();
    console.log(`✅ Created ${tasks.length} tasks`);
  }

  private async createTeams(): Promise<void> {
    console.log('👥 Creating teams...');

    const teams = [];
    for (const workspace of this.seedData.workspaces) {
      const teamCount = faker.number.int({ min: 2, max: 5 });
      const workspaceProjects = this.seedData.projects.filter(
        p => p.workspaceId === workspace.id
      );

      for (let i = 0; i < teamCount; i++) {
        const project = faker.helpers.arrayElement([
          ...workspaceProjects,
          null,
        ]);
        const team = {
          id: faker.string.uuid(),
          workspaceId: workspace.id,
          projectId: project?.id || null,
          name: faker.company.buzzNoun() + ' Team',
          description: faker.lorem.sentence(),
          color: faker.color.rgb(),
          settings: {
            isPublic: faker.datatype.boolean(),
            allowSelfJoin: faker.datatype.boolean(),
          },
          createdAt: faker.date.past({ months: 6 }),
          updatedAt: new Date(),
        };
        teams.push(team);
      }
    }

    await prisma.team.createMany({ data: teams });
    this.seedData.teams = await prisma.team.findMany();

    // Create team members
    for (const team of this.seedData.teams) {
      await this.createTeamMembers(team);
    }

    console.log(`✅ Created ${teams.length} teams with members`);
  }

  private async createTeamMembers(team: any): Promise<void> {
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: team.workspaceId },
    });

    const memberCount = faker.number.int({ min: 3, max: 10 });
    const selectedMembers = faker.helpers.arrayElements(
      workspaceMembers,
      memberCount
    );

    for (const member of selectedMembers) {
      await prisma.teamMember.create({
        data: {
          id: faker.string.uuid(),
          teamId: team.id,
          userId: member.userId,
          role: faker.helpers.arrayElement(['LEAD', 'MEMBER']),
          joinedAt: faker.date.past({ months: 3 }),
        },
      });
    }
  }

  private async createComments(): Promise<void> {
    console.log('💬 Creating comments...');

    const comments = [];
    const selectedTasks = faker.helpers.arrayElements(
      this.seedData.tasks,
      Math.min(200, this.seedData.tasks.length)
    );

    for (const task of selectedTasks) {
      const commentCount = faker.number.int({ min: 1, max: 8 });
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: task.projectId },
      });

      for (let i = 0; i < commentCount; i++) {
        const author = faker.helpers.arrayElement(projectMembers);
        const comment = {
          id: faker.string.uuid(),
          content: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
          authorId: author.userId,
          taskId: task.id,
          projectId: null,
          parentId: null,
          mentions: faker.helpers.arrayElements(
            projectMembers.map(m => m.userId),
            { min: 0, max: 2 }
          ),
          attachments: [],
          createdAt: faker.date.past({ months: 3 }),
          updatedAt: faker.date.recent({ days: 7 }),
        };
        comments.push(comment);
      }
    }

    await prisma.comment.createMany({ data: comments });
    this.seedData.comments = await prisma.comment.findMany();
    console.log(`✅ Created ${comments.length} comments`);
  }

  private async createTimeEntries(): Promise<void> {
    console.log('⏱️ Creating time entries...');

    const timeEntries = [];
    const selectedTasks = faker.helpers.arrayElements(
      this.seedData.tasks,
      Math.min(300, this.seedData.tasks.length)
    );

    for (const task of selectedTasks) {
      const entryCount = faker.number.int({ min: 1, max: 5 });
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: task.projectId },
      });

      for (let i = 0; i < entryCount; i++) {
        const user = faker.helpers.arrayElement(projectMembers);
        const startTime = faker.date.past({ months: 2 });
        const duration = faker.number.int({ min: 900, max: 28800 }); // 15 minutes to 8 hours in seconds
        const endTime = new Date(startTime.getTime() + duration * 1000);

        const timeEntry = {
          id: faker.string.uuid(),
          taskId: task.id,
          userId: user.userId,
          description: faker.lorem.sentence(),
          startTime,
          endTime,
          duration,
          createdAt: startTime,
          updatedAt: new Date(),
        };
        timeEntries.push(timeEntry);
      }
    }

    await prisma.timeEntry.createMany({ data: timeEntries });
    this.seedData.timeEntries = await prisma.timeEntry.findMany();
    console.log(`✅ Created ${timeEntries.length} time entries`);
  }

  private async createDependencies(): Promise<void> {
    console.log('🔗 Creating task dependencies...');

    const dependencies = [];
    const selectedTasks = faker.helpers.arrayElements(
      this.seedData.tasks,
      Math.min(100, this.seedData.tasks.length)
    );

    for (const task of selectedTasks) {
      const dependencyCount = faker.number.int({ min: 0, max: 3 });
      if (dependencyCount === 0) continue;

      const projectTasks = this.seedData.tasks.filter(
        t => t.projectId === task.projectId && t.id !== task.id
      );

      if (projectTasks.length === 0) continue;

      const dependsOnTasks = faker.helpers.arrayElements(
        projectTasks,
        dependencyCount
      );

      for (const dependsOnTask of dependsOnTasks) {
        const dependency = {
          id: faker.string.uuid(),
          taskId: task.id,
          dependsOnId: dependsOnTask.id,
          type: faker.helpers.arrayElement([
            'FINISH_TO_START',
            'START_TO_START',
            'FINISH_TO_FINISH',
            'START_TO_FINISH',
          ]),
          createdAt: faker.date.past({ months: 1 }),
        };
        dependencies.push(dependency);
      }
    }

    if (dependencies.length > 0) {
      await prisma.taskDependency.createMany({ data: dependencies });
    }
    console.log(`✅ Created ${dependencies.length} task dependencies`);
  }

  async cleanup(): Promise<void> {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const seeder = new ComprehensiveDatabaseSeeder();
  try {
    await seeder.seed();
  } finally {
    await seeder.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
