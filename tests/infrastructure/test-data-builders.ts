import { faker } from '@faker-js/faker';
import {
  User,
  Workspace,
  Project,
  Task,
  WorkspaceMember,
  TaskComment,
  TaskAttachment,
} from '@prisma/client';
import argon2 from 'argon2';
import { createId } from '@paralleldrive/cuid2';

export interface BuilderOptions<T> {
  overrides?: Partial<T>;
  count?: number;
}

export abstract class BaseBuilder<T> {
  protected data: Partial<T> = {};

  abstract build(): T;

  with(overrides: Partial<T>): this {
    this.data = { ...this.data, ...overrides };
    return this;
  }

  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }
}

export class UserBuilder extends BaseBuilder<User> {
  constructor() {
    super();
    this.data = {
      id: createId(),
      email: faker.internet.email(),
      emailVerified: faker.date.past(),
      name: faker.person.fullName(),
      image: faker.image.avatar(),
      mfaEnabled: false,
      totpSecret: null,
      backupCodes: [],
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: faker.date.recent(),
      lastLoginIp: faker.internet.ip(),
      riskScore: faker.number.float({ min: 0, max: 1 }),
      timezone: faker.location.timeZone(),
      workHours: {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5],
      },
      taskViewPreferences: {
        defaultView: faker.helpers.arrayElement(['list', 'kanban', 'calendar']),
        groupBy: faker.helpers.arrayElement(['status', 'priority', 'assignee']),
      },
      notificationSettings: {
        email: faker.datatype.boolean(),
        push: faker.datatype.boolean(),
        desktop: faker.datatype.boolean(),
      },
      productivitySettings: {
        pomodoroLength: faker.number.int({ min: 15, max: 45 }),
        breakLength: faker.number.int({ min: 5, max: 15 }),
      },
      avatarColor: faker.internet.color(),
      activeWorkspaceId: null,
      workspacePreferences: {},
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withMfaEnabled(enabled: boolean = true): this {
    this.data.mfaEnabled = enabled;
    if (enabled) {
      this.data.totpSecret = faker.string.alphanumeric(32);
      this.data.backupCodes = Array.from({ length: 10 }, () =>
        faker.string.numeric(6)
      );
    }
    return this;
  }

  withActiveWorkspace(workspaceId: string): this {
    this.data.activeWorkspaceId = workspaceId;
    return this;
  }

  async build(): Promise<User> {
    const passwordHash = await argon2.hash('test123');

    return {
      ...this.data,
      passwordHash,
    } as User;
  }

  static create(): UserBuilder {
    return new UserBuilder();
  }
}

export class WorkspaceBuilder extends BaseBuilder<Workspace> {
  constructor() {
    super();
    this.data = {
      id: createId(),
      name: faker.company.name(),
      slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
      description: faker.company.catchPhrase(),
      ownerId: createId(),
      subscriptionTier: faker.helpers.arrayElement([
        'free',
        'pro',
        'enterprise',
      ]),
      billingEmail: faker.internet.email(),
      settings: {
        allowGuestAccess: faker.datatype.boolean(),
        requireMfa: faker.datatype.boolean(),
        sessionTimeout: faker.number.int({ min: 30, max: 480 }),
      },
      branding: {
        primaryColor: faker.internet.color(),
        logo: faker.image.url(),
        customDomain: faker.internet.domainName(),
      },
      securitySettings: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: false,
        },
        ipWhitelist: [],
        ssoEnabled: false,
      },
      isActive: true,
      memberLimit: faker.number.int({ min: 5, max: 100 }),
      projectLimit: faker.number.int({ min: 3, max: 50 }),
      storageLimitGb: faker.number.int({ min: 1, max: 100 }),
      deletedAt: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withName(name: string): this {
    this.data.name = name;
    this.data.slug = faker.helpers.slugify(name).toLowerCase();
    return this;
  }

  withOwner(ownerId: string): this {
    this.data.ownerId = ownerId;
    return this;
  }

  withSubscriptionTier(tier: 'free' | 'pro' | 'enterprise'): this {
    this.data.subscriptionTier = tier;
    return this;
  }

  build(): Workspace {
    return this.data as Workspace;
  }

  static create(): WorkspaceBuilder {
    return new WorkspaceBuilder();
  }
}

export class ProjectBuilder extends BaseBuilder<Project> {
  constructor() {
    super();
    this.data = {
      id: createId(),
      workspaceId: createId(),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      color: faker.internet.color(),
      ownerId: createId(),
      status: faker.helpers.arrayElement([
        'ACTIVE',
        'COMPLETED',
        'ON_HOLD',
        'CANCELLED',
      ]),
      priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      startDate: faker.date.past(),
      endDate: faker.date.future(),
      budgetAmount: faker.number.float({ min: 1000, max: 100000 }),
      budgetCurrency: 'USD',
      settings: {
        isPublic: faker.datatype.boolean(),
        allowComments: faker.datatype.boolean(),
        autoAssignTasks: faker.datatype.boolean(),
      },
      templateId: null,
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      deletedAt: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withWorkspace(workspaceId: string): this {
    this.data.workspaceId = workspaceId;
    return this;
  }

  withOwner(ownerId: string): this {
    this.data.ownerId = ownerId;
    return this;
  }

  withStatus(status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'): this {
    this.data.status = status;
    return this;
  }

  build(): Project {
    return this.data as Project;
  }

  static create(): ProjectBuilder {
    return new ProjectBuilder();
  }
}

export class TaskBuilder extends BaseBuilder<Task> {
  constructor() {
    super();
    this.data = {
      id: createId(),
      workspaceId: createId(),
      projectId: createId(),
      title: faker.hacker.phrase(),
      description: faker.lorem.paragraphs(2),
      status: faker.helpers.arrayElement([
        'TODO',
        'IN_PROGRESS',
        'IN_REVIEW',
        'DONE',
        'CANCELLED',
      ]),
      priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      assigneeId: null,
      creatorId: createId(),
      reporterId: null,
      dueDate: faker.date.future(),
      startDate: faker.date.recent(),
      completedAt: null,
      estimatedHours: faker.number.float({ min: 0.5, max: 40 }),
      actualHours: null,
      storyPoints: faker.number.int({ min: 1, max: 13 }),
      tags: faker.helpers.arrayElements(
        ['bug', 'feature', 'enhancement', 'documentation'],
        { min: 0, max: 3 }
      ),
      labels: faker.helpers.arrayElements(
        ['frontend', 'backend', 'database', 'api'],
        { min: 0, max: 2 }
      ),
      epicId: null,
      parentTaskId: null,
      attachments: [],
      externalLinks: [],
      recurringTaskId: null,
      recurrenceInstanceDate: null,
      watchers: [],
      lastActivityAt: faker.date.recent(),
      customFields: {},
      position: faker.number.int({ min: 0, max: 1000 }),
      deletedAt: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withWorkspace(workspaceId: string): this {
    this.data.workspaceId = workspaceId;
    return this;
  }

  withProject(projectId: string): this {
    this.data.projectId = projectId;
    return this;
  }

  withCreator(creatorId: string): this {
    this.data.creatorId = creatorId;
    return this;
  }

  withAssignee(assigneeId: string): this {
    this.data.assigneeId = assigneeId;
    return this;
  }

  withStatus(
    status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'
  ): this {
    this.data.status = status;
    if (status === 'DONE') {
      this.data.completedAt = faker.date.recent();
    }
    return this;
  }

  withPriority(priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'): this {
    this.data.priority = priority;
    return this;
  }

  withDueDate(dueDate: Date): this {
    this.data.dueDate = dueDate;
    return this;
  }

  build(): Task {
    return this.data as Task;
  }

  static create(): TaskBuilder {
    return new TaskBuilder();
  }
}

export class WorkspaceMemberBuilder extends BaseBuilder<WorkspaceMember> {
  constructor() {
    super();
    this.data = {
      id: createId(),
      workspaceId: createId(),
      userId: createId(),
      role: faker.helpers.arrayElement(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']),
      permissions: ['task:view', 'task:create'],
      invitedBy: createId(),
      invitedAt: faker.date.past(),
      joinedAt: faker.date.recent(),
      lastActiveAt: faker.date.recent(),
      settings: {
        notifications: faker.datatype.boolean(),
        emailDigest: faker.datatype.boolean(),
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withWorkspace(workspaceId: string): this {
    this.data.workspaceId = workspaceId;
    return this;
  }

  withUser(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'): this {
    this.data.role = role;
    return this;
  }

  build(): WorkspaceMember {
    return this.data as WorkspaceMember;
  }

  static create(): WorkspaceMemberBuilder {
    return new WorkspaceMemberBuilder();
  }
}

export class TaskCommentBuilder extends BaseBuilder<TaskComment> {
  constructor() {
    super();
    this.data = {
      id: createId(),
      taskId: createId(),
      authorId: createId(),
      content: faker.lorem.paragraphs(1),
      mentions: [],
      attachments: [],
      isInternal: faker.datatype.boolean(),
      parentCommentId: null,
      editedAt: null,
      editedBy: null,
      deletedAt: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    };
  }

  withTask(taskId: string): this {
    this.data.taskId = taskId;
    return this;
  }

  withAuthor(authorId: string): this {
    this.data.authorId = authorId;
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    return this;
  }

  build(): TaskComment {
    return this.data as TaskComment;
  }

  static create(): TaskCommentBuilder {
    return new TaskCommentBuilder();
  }
}

// Factory class for creating related entities
export class TestDataFactory {
  static async createCompleteWorkspace(): Promise<{
    workspace: Workspace;
    owner: User;
    members: User[];
    projects: Project[];
    tasks: Task[];
  }> {
    const owner = await UserBuilder.create().build();
    const workspace = WorkspaceBuilder.create().withOwner(owner.id).build();

    const members = await Promise.all([
      UserBuilder.create().withActiveWorkspace(workspace.id).build(),
      UserBuilder.create().withActiveWorkspace(workspace.id).build(),
    ]);

    const projects = [
      ProjectBuilder.create()
        .withWorkspace(workspace.id)
        .withOwner(owner.id)
        .build(),
      ProjectBuilder.create()
        .withWorkspace(workspace.id)
        .withOwner(members[0].id)
        .build(),
    ];

    const tasks = [
      TaskBuilder.create()
        .withWorkspace(workspace.id)
        .withProject(projects[0].id)
        .withCreator(owner.id)
        .withAssignee(members[0].id)
        .build(),
      TaskBuilder.create()
        .withWorkspace(workspace.id)
        .withProject(projects[0].id)
        .withCreator(members[0].id)
        .withAssignee(members[1].id)
        .build(),
      TaskBuilder.create()
        .withWorkspace(workspace.id)
        .withProject(projects[1].id)
        .withCreator(members[1].id)
        .build(),
    ];

    return { workspace, owner, members, projects, tasks };
  }

  static async createTaskWithComments(commentCount: number = 3): Promise<{
    task: Task;
    creator: User;
    assignee: User;
    comments: TaskComment[];
  }> {
    const creator = await UserBuilder.create().build();
    const assignee = await UserBuilder.create().build();
    const task = TaskBuilder.create()
      .withCreator(creator.id)
      .withAssignee(assignee.id)
      .build();

    const comments = Array.from({ length: commentCount }, () =>
      TaskCommentBuilder.create()
        .withTask(task.id)
        .withAuthor(faker.helpers.arrayElement([creator.id, assignee.id]))
        .build()
    );

    return { task, creator, assignee, comments };
  }
}
