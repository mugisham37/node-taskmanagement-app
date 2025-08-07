import { PrismaClient } from '@prisma/client';
import {
  UserBuilder,
  WorkspaceBuilder,
  ProjectBuilder,
  TaskBuilder,
  WorkspaceMemberBuilder,
  TaskCommentBuilder,
} from './test-data-builders';
import { createId } from '@paralleldrive/cuid2';

/**
 * Pre-built test scenarios for common testing patterns
 */
export class TestScenarios {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a complete workspace with owner, members, projects, and tasks
   */
  async createCompleteWorkspaceScenario(): Promise<{
    owner: any;
    workspace: any;
    members: any[];
    projects: any[];
    tasks: any[];
    comments: any[];
  }> {
    // Create owner
    const owner = await UserBuilder.create().build();
    await this.prisma.user.create({ data: owner });

    // Create workspace
    const workspace = WorkspaceBuilder.create().withOwner(owner.id).build();
    await this.prisma.workspace.create({ data: workspace });

    // Create workspace owner membership
    const ownerMembership = WorkspaceMemberBuilder.create()
      .withWorkspace(workspace.id)
      .withUser(owner.id)
      .withRole('OWNER')
      .build();
    await this.prisma.workspaceMember.create({ data: ownerMembership });

    // Create additional members
    const members = [];
    for (let i = 0; i < 3; i++) {
      const member = await UserBuilder.create()
        .withActiveWorkspace(workspace.id)
        .build();
      await this.prisma.user.create({ data: member });

      const membership = WorkspaceMemberBuilder.create()
        .withWorkspace(workspace.id)
        .withUser(member.id)
        .withRole(i === 0 ? 'ADMIN' : 'MEMBER')
        .build();
      await this.prisma.workspaceMember.create({ data: membership });

      members.push(member);
    }

    // Create projects
    const projects = [];
    for (let i = 0; i < 2; i++) {
      const project = ProjectBuilder.create()
        .withWorkspace(workspace.id)
        .withOwner(i === 0 ? owner.id : members[0].id)
        .withName(`Project ${i + 1}`)
        .build();
      await this.prisma.project.create({ data: project });

      // Create project memberships
      const projectOwnerMembership = {
        id: createId(),
        projectId: project.id,
        userId: project.ownerId,
        role: 'OWNER' as const,
        permissions: ['*'],
        addedBy: project.ownerId,
        addedAt: new Date(),
      };
      await this.prisma.projectMember.create({ data: projectOwnerMembership });

      projects.push(project);
    }

    // Create tasks
    const tasks = [];
    const allUsers = [owner, ...members];

    for (let i = 0; i < 8; i++) {
      const project = projects[i % projects.length];
      const creator = allUsers[i % allUsers.length];
      const assignee = i % 2 === 0 ? allUsers[(i + 1) % allUsers.length] : null;

      const task = TaskBuilder.create()
        .withWorkspace(workspace.id)
        .withProject(project.id)
        .withCreator(creator.id)
        .withTitle(`Task ${i + 1}`)
        .withStatus(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'][i % 4] as any)
        .withPriority(['LOW', 'MEDIUM', 'HIGH', 'URGENT'][i % 4] as any)
        .build();

      if (assignee) {
        task.assigneeId = assignee.id;
      }

      await this.prisma.task.create({ data: task });
      tasks.push(task);
    }

    // Create comments
    const comments = [];
    for (let i = 0; i < 5; i++) {
      const task = tasks[i % tasks.length];
      const author = allUsers[i % allUsers.length];

      const comment = TaskCommentBuilder.create()
        .withTask(task.id)
        .withAuthor(author.id)
        .withContent(`Comment ${i + 1} on ${task.title}`)
        .build();

      await this.prisma.taskComment.create({ data: comment });
      comments.push(comment);
    }

    return { owner, workspace, members, projects, tasks, comments };
  }

  /**
   * Create a scenario for testing task workflows
   */
  async createTaskWorkflowScenario(): Promise<{
    creator: any;
    assignee: any;
    reviewer: any;
    workspace: any;
    project: any;
    tasks: {
      todo: any;
      inProgress: any;
      inReview: any;
      done: any;
    };
  }> {
    // Create users
    const creator = await UserBuilder.create().withName('Task Creator').build();
    const assignee = await UserBuilder.create()
      .withName('Task Assignee')
      .build();
    const reviewer = await UserBuilder.create()
      .withName('Task Reviewer')
      .build();

    await this.prisma.user.createMany({
      data: [creator, assignee, reviewer],
    });

    // Create workspace
    const workspace = WorkspaceBuilder.create()
      .withOwner(creator.id)
      .withName('Task Workflow Workspace')
      .build();
    await this.prisma.workspace.create({ data: workspace });

    // Create memberships
    const memberships = [
      WorkspaceMemberBuilder.create()
        .withWorkspace(workspace.id)
        .withUser(creator.id)
        .withRole('OWNER')
        .build(),
      WorkspaceMemberBuilder.create()
        .withWorkspace(workspace.id)
        .withUser(assignee.id)
        .withRole('MEMBER')
        .build(),
      WorkspaceMemberBuilder.create()
        .withWorkspace(workspace.id)
        .withUser(reviewer.id)
        .withRole('ADMIN')
        .build(),
    ];

    await this.prisma.workspaceMember.createMany({ data: memberships });

    // Create project
    const project = ProjectBuilder.create()
      .withWorkspace(workspace.id)
      .withOwner(creator.id)
      .withName('Task Workflow Project')
      .build();
    await this.prisma.project.create({ data: project });

    // Create project memberships
    const projectMemberships = [
      {
        id: createId(),
        projectId: project.id,
        userId: creator.id,
        role: 'OWNER' as const,
        permissions: ['*'],
        addedBy: creator.id,
        addedAt: new Date(),
      },
      {
        id: createId(),
        projectId: project.id,
        userId: assignee.id,
        role: 'MEMBER' as const,
        permissions: ['task:view', 'task:update'],
        addedBy: creator.id,
        addedAt: new Date(),
      },
      {
        id: createId(),
        projectId: project.id,
        userId: reviewer.id,
        role: 'ADMIN' as const,
        permissions: ['*'],
        addedBy: creator.id,
        addedAt: new Date(),
      },
    ];

    await this.prisma.projectMember.createMany({ data: projectMemberships });

    // Create tasks in different states
    const todoTask = TaskBuilder.create()
      .withWorkspace(workspace.id)
      .withProject(project.id)
      .withCreator(creator.id)
      .withTitle('TODO Task')
      .withStatus('TODO')
      .withPriority('MEDIUM')
      .build();

    const inProgressTask = TaskBuilder.create()
      .withWorkspace(workspace.id)
      .withProject(project.id)
      .withCreator(creator.id)
      .withAssignee(assignee.id)
      .withTitle('In Progress Task')
      .withStatus('IN_PROGRESS')
      .withPriority('HIGH')
      .build();

    const inReviewTask = TaskBuilder.create()
      .withWorkspace(workspace.id)
      .withProject(project.id)
      .withCreator(creator.id)
      .withAssignee(assignee.id)
      .withTitle('In Review Task')
      .withStatus('IN_REVIEW')
      .withPriority('HIGH')
      .build();

    const doneTask = TaskBuilder.create()
      .withWorkspace(workspace.id)
      .withProject(project.id)
      .withCreator(creator.id)
      .withAssignee(assignee.id)
      .withTitle('Done Task')
      .withStatus('DONE')
      .withPriority('MEDIUM')
      .build();
    doneTask.completedAt = new Date();

    await this.prisma.task.createMany({
      data: [todoTask, inProgressTask, inReviewTask, doneTask],
    });

    return {
      creator,
      assignee,
      reviewer,
      workspace,
      project,
      tasks: {
        todo: todoTask,
        inProgress: inProgressTask,
        inReview: inReviewTask,
        done: doneTask,
      },
    };
  }

  /**
   * Create a scenario for testing multi-tenant isolation
   */
  async createMultiTenantScenario(): Promise<{
    workspaces: Array<{
      workspace: any;
      owner: any;
      members: any[];
      projects: any[];
      tasks: any[];
    }>;
  }> {
    const workspaces = [];

    for (let i = 0; i < 3; i++) {
      // Create workspace owner
      const owner = await UserBuilder.create()
        .withName(`Workspace ${i + 1} Owner`)
        .withEmail(`owner${i + 1}@workspace${i + 1}.com`)
        .build();
      await this.prisma.user.create({ data: owner });

      // Create workspace
      const workspace = WorkspaceBuilder.create()
        .withOwner(owner.id)
        .withName(`Workspace ${i + 1}`)
        .build();
      await this.prisma.workspace.create({ data: workspace });

      // Create owner membership
      const ownerMembership = WorkspaceMemberBuilder.create()
        .withWorkspace(workspace.id)
        .withUser(owner.id)
        .withRole('OWNER')
        .build();
      await this.prisma.workspaceMember.create({ data: ownerMembership });

      // Create members
      const members = [];
      for (let j = 0; j < 2; j++) {
        const member = await UserBuilder.create()
          .withName(`Member ${j + 1} of Workspace ${i + 1}`)
          .withEmail(`member${j + 1}@workspace${i + 1}.com`)
          .withActiveWorkspace(workspace.id)
          .build();
        await this.prisma.user.create({ data: member });

        const membership = WorkspaceMemberBuilder.create()
          .withWorkspace(workspace.id)
          .withUser(member.id)
          .withRole('MEMBER')
          .build();
        await this.prisma.workspaceMember.create({ data: membership });

        members.push(member);
      }

      // Create projects
      const projects = [];
      for (let j = 0; j < 2; j++) {
        const project = ProjectBuilder.create()
          .withWorkspace(workspace.id)
          .withOwner(j === 0 ? owner.id : members[0].id)
          .withName(`Project ${j + 1} in Workspace ${i + 1}`)
          .build();
        await this.prisma.project.create({ data: project });

        const projectMembership = {
          id: createId(),
          projectId: project.id,
          userId: project.ownerId,
          role: 'OWNER' as const,
          permissions: ['*'],
          addedBy: project.ownerId,
          addedAt: new Date(),
        };
        await this.prisma.projectMember.create({ data: projectMembership });

        projects.push(project);
      }

      // Create tasks
      const tasks = [];
      for (let j = 0; j < 4; j++) {
        const project = projects[j % projects.length];
        const creator = j % 2 === 0 ? owner : members[0];

        const task = TaskBuilder.create()
          .withWorkspace(workspace.id)
          .withProject(project.id)
          .withCreator(creator.id)
          .withTitle(`Task ${j + 1} in Workspace ${i + 1}`)
          .build();

        await this.prisma.task.create({ data: task });
        tasks.push(task);
      }

      workspaces.push({
        workspace,
        owner,
        members,
        projects,
        tasks,
      });
    }

    return { workspaces };
  }

  /**
   * Create a scenario for testing performance with large datasets
   */
  async createPerformanceScenario(): Promise<{
    workspace: any;
    users: any[];
    projects: any[];
    tasks: any[];
  }> {
    // Create workspace owner
    const owner = await UserBuilder.create()
      .withName('Performance Test Owner')
      .build();
    await this.prisma.user.create({ data: owner });

    // Create workspace
    const workspace = WorkspaceBuilder.create()
      .withOwner(owner.id)
      .withName('Performance Test Workspace')
      .build();
    await this.prisma.workspace.create({ data: workspace });

    // Create owner membership
    const ownerMembership = WorkspaceMemberBuilder.create()
      .withWorkspace(workspace.id)
      .withUser(owner.id)
      .withRole('OWNER')
      .build();
    await this.prisma.workspaceMember.create({ data: ownerMembership });

    // Create many users
    const users = [owner];
    const userBatch = [];
    const membershipBatch = [];

    for (let i = 0; i < 50; i++) {
      const user = await UserBuilder.create()
        .withName(`Performance User ${i + 1}`)
        .withEmail(`perf-user-${i + 1}@example.com`)
        .withActiveWorkspace(workspace.id)
        .build();

      userBatch.push(user);
      users.push(user);

      const membership = WorkspaceMemberBuilder.create()
        .withWorkspace(workspace.id)
        .withUser(user.id)
        .withRole('MEMBER')
        .build();

      membershipBatch.push(membership);

      // Batch insert every 10 users
      if (userBatch.length === 10) {
        await this.prisma.user.createMany({ data: userBatch });
        await this.prisma.workspaceMember.createMany({ data: membershipBatch });
        userBatch.length = 0;
        membershipBatch.length = 0;
      }
    }

    // Insert remaining users
    if (userBatch.length > 0) {
      await this.prisma.user.createMany({ data: userBatch });
      await this.prisma.workspaceMember.createMany({ data: membershipBatch });
    }

    // Create many projects
    const projects = [];
    const projectBatch = [];
    const projectMembershipBatch = [];

    for (let i = 0; i < 20; i++) {
      const project = ProjectBuilder.create()
        .withWorkspace(workspace.id)
        .withOwner(users[i % users.length].id)
        .withName(`Performance Project ${i + 1}`)
        .build();

      projectBatch.push(project);
      projects.push(project);

      const projectMembership = {
        id: createId(),
        projectId: project.id,
        userId: project.ownerId,
        role: 'OWNER' as const,
        permissions: ['*'],
        addedBy: project.ownerId,
        addedAt: new Date(),
      };

      projectMembershipBatch.push(projectMembership);

      // Batch insert every 5 projects
      if (projectBatch.length === 5) {
        await this.prisma.project.createMany({ data: projectBatch });
        await this.prisma.projectMember.createMany({
          data: projectMembershipBatch,
        });
        projectBatch.length = 0;
        projectMembershipBatch.length = 0;
      }
    }

    // Insert remaining projects
    if (projectBatch.length > 0) {
      await this.prisma.project.createMany({ data: projectBatch });
      await this.prisma.projectMember.createMany({
        data: projectMembershipBatch,
      });
    }

    // Create many tasks
    const tasks = [];
    const taskBatch = [];

    for (let i = 0; i < 1000; i++) {
      const project = projects[i % projects.length];
      const creator = users[i % users.length];
      const assignee = i % 3 === 0 ? users[(i + 1) % users.length] : null;

      const task = TaskBuilder.create()
        .withWorkspace(workspace.id)
        .withProject(project.id)
        .withCreator(creator.id)
        .withTitle(`Performance Task ${i + 1}`)
        .withStatus(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'][i % 4] as any)
        .withPriority(['LOW', 'MEDIUM', 'HIGH', 'URGENT'][i % 4] as any)
        .build();

      if (assignee) {
        task.assigneeId = assignee.id;
      }

      taskBatch.push(task);
      tasks.push(task);

      // Batch insert every 50 tasks
      if (taskBatch.length === 50) {
        await this.prisma.task.createMany({ data: taskBatch });
        taskBatch.length = 0;
      }
    }

    // Insert remaining tasks
    if (taskBatch.length > 0) {
      await this.prisma.task.createMany({ data: taskBatch });
    }

    return { workspace, users, projects, tasks };
  }

  /**
   * Clean up all test data created by scenarios
   */
  async cleanup(): Promise<void> {
    // Delete in reverse dependency order
    await this.prisma.taskComment.deleteMany({});
    await this.prisma.taskAttachment.deleteMany({});
    await this.prisma.taskActivity.deleteMany({});
    await this.prisma.taskDependency.deleteMany({});
    await this.prisma.task.deleteMany({});
    await this.prisma.projectMember.deleteMany({});
    await this.prisma.project.deleteMany({});
    await this.prisma.workspaceMember.deleteMany({});
    await this.prisma.workspaceInvitation.deleteMany({});
    await this.prisma.workspace.deleteMany({});
    await this.prisma.userSession.deleteMany({});
    await this.prisma.user.deleteMany({});
    await this.prisma.auditLog.deleteMany({});
    await this.prisma.notification.deleteMany({});
    await this.prisma.webhookDelivery.deleteMany({});
    await this.prisma.webhook.deleteMany({});
  }
}
