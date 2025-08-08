import { prisma } from '../prisma-client';
import { User, Project, Task } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedTasks(
  projects: Project[],
  users: User[]
): Promise<Task[]> {
  const tasks: Task[] = [];

  // Create tasks for each project
  for (const project of projects) {
    const projectTasks = await createProjectTasks(project, users);
    tasks.push(...projectTasks);
  }

  // Create some cross-project epic tasks
  const epicTasks = await createEpicTasks(projects, users);
  tasks.push(...epicTasks);

  // Create task dependencies
  await createTaskDependencies(tasks);

  // Create recurring tasks
  await createRecurringTasks(projects, users);

  return tasks;
}

async function createProjectTasks(
  project: Project,
  users: User[]
): Promise<Task[]> {
  const tasks: Task[] = [];
  const adminUser = users[0];

  // Get project-specific task templates
  const tasksData = getTasksDataForProject(project.name, project.status);

  for (const taskData of tasksData) {
    const assignee = faker.helpers.arrayElement(users);
    const creator = faker.helpers.arrayElement(users.slice(0, 3)); // First 3 users are more likely to create tasks
    const reporter = faker.datatype.boolean({ probability: 0.3 })
      ? faker.helpers.arrayElement(users)
      : creator;

    // Generate realistic dates
    const createdAt = faker.date.between({
      from: project.createdAt,
      to:
        project.status === 'COMPLETED'
          ? project.endDate || new Date()
          : new Date(),
    });

    const startDate =
      taskData.status !== 'TODO'
        ? faker.date.between({ from: createdAt, to: new Date() })
        : faker.datatype.boolean({ probability: 0.3 })
          ? faker.date.future({ years: 0.1 })
          : null;

    const dueDate = faker.datatype.boolean({ probability: 0.7 })
      ? faker.date.between({
          from: startDate || createdAt,
          to: project.endDate || faker.date.future({ years: 0.5 }),
        })
      : null;

    const completedAt =
      taskData.status === 'DONE'
        ? faker.date.between({
            from: startDate || createdAt,
            to: dueDate || new Date(),
          })
        : null;

    const task = await prisma.task.create({
      data: {
        ...taskData,
        workspaceId: project.workspaceId,
        projectId: project.id,
        assigneeId: faker.datatype.boolean({ probability: 0.8 })
          ? assignee.id
          : null,
        creatorId: creator.id,
        reporterId: reporter.id,
        startDate,
        dueDate,
        completedAt,
        tags: taskData.tags || [],
        labels: taskData.labels || [],
        watchers: generateWatchers(users, assignee, creator),
        customFields: {
          complexity:
            taskData.complexity ||
            faker.helpers.arrayElement(['low', 'medium', 'high']),
          category:
            taskData.category ||
            faker.helpers.arrayElement([
              'development',
              'design',
              'testing',
              'documentation',
            ]),
          department: faker.helpers.arrayElement([
            'Engineering',
            'Design',
            'Product',
            'QA',
          ]),
          clientFacing: faker.datatype.boolean({ probability: 0.3 }),
          ...taskData.customFields,
        },
        position: faker.number.int({ min: 0, max: 1000 }),
        createdAt,
        updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
        lastActivityAt: faker.date.recent({ days: 7 }),
      },
    });
    tasks.push(task);

    // Create realistic comments
    await createTaskComments(task, users, createdAt);

    // Create time entries for in-progress and completed tasks
    if (task.status === 'IN_PROGRESS' || task.status === 'DONE') {
      await createTimeEntries(task, users);
    }

    // Create activity logs
    await createTaskActivities(task, users, createdAt);
  }

  return tasks;
}

function generateWatchers(
  users: User[],
  assignee: User | null,
  creator: User
): string[] {
  const watchers = new Set<string>();

  // Always add creator
  watchers.add(creator.id);

  // Add assignee if exists
  if (assignee) {
    watchers.add(assignee.id);
  }

  // Add random watchers
  const additionalWatchers = faker.helpers.arrayElements(users, {
    min: 0,
    max: 3,
  });
  additionalWatchers.forEach(user => watchers.add(user.id));

  return Array.from(watchers);
}

async function createTaskComments(
  task: Task,
  users: User[],
  taskCreatedAt: Date
) {
  const commentCount = faker.number.int({ min: 0, max: 8 });

  for (let i = 0; i < commentCount; i++) {
    const author = faker.helpers.arrayElement(users);
    const createdAt = faker.date.between({
      from: taskCreatedAt,
      to: new Date(),
    });

    const comment = await prisma.comment.create({
      data: {
        content: generateRealisticComment(task.status, i === 0),
        authorId: author.id,
        taskId: task.id,
        mentions: faker.datatype.boolean({ probability: 0.2 })
          ? faker.helpers
              .arrayElements(users, { min: 1, max: 2 })
              .map(u => u.id)
          : [],
        attachments: faker.datatype.boolean({ probability: 0.1 })
          ? [
              {
                id: faker.string.uuid(),
                name: 'screenshot.png',
                url: faker.internet.url(),
              },
            ]
          : [],
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Create replies occasionally
    if (faker.datatype.boolean({ probability: 0.3 })) {
      await prisma.comment.create({
        data: {
          content: generateReplyComment(),
          authorId: faker.helpers.arrayElement(users).id,
          taskId: task.id,
          parentId: comment.id,
          mentions: [author.id],
          createdAt: faker.date.between({ from: createdAt, to: new Date() }),
        },
      });
    }
  }
}

async function createTimeEntries(task: Task, users: User[]) {
  const entryCount = faker.number.int({ min: 1, max: 5 });

  for (let i = 0; i < entryCount; i++) {
    const user = faker.helpers.arrayElement(users);
    const startTime = faker.date.recent({ days: 30 });
    const duration = faker.number.int({ min: 1800, max: 28800 }); // 30 minutes to 8 hours
    const endTime = new Date(startTime.getTime() + duration * 1000);

    await prisma.timeEntry.create({
      data: {
        taskId: task.id,
        userId: user.id,
        description: faker.helpers.arrayElement([
          'Working on implementation',
          'Code review and testing',
          'Bug fixes and improvements',
          'Research and planning',
          'Documentation updates',
          'Meeting and discussion',
        ]),
        startTime,
        endTime,
        duration,
        createdAt: startTime,
        updatedAt: endTime,
      },
    });
  }
}

async function createTaskActivities(
  task: Task,
  users: User[],
  taskCreatedAt: Date
) {
  const activities = [
    {
      type: 'TASK_CREATED',
      action: 'created',
      description: `Created task "${task.title}"`,
      userId: task.creatorId,
      createdAt: taskCreatedAt,
    },
  ];

  // Add status change activities
  if (task.status !== 'TODO') {
    activities.push({
      type: 'TASK_UPDATED',
      action: 'status_changed',
      description: `Changed status to ${task.status}`,
      userId: task.assigneeId || task.creatorId,
      createdAt: faker.date.between({ from: taskCreatedAt, to: new Date() }),
    });
  }

  // Add assignment activity
  if (task.assigneeId) {
    activities.push({
      type: 'TASK_UPDATED',
      action: 'assigned',
      description: `Assigned task to user`,
      userId: task.creatorId,
      createdAt: faker.date.between({ from: taskCreatedAt, to: new Date() }),
    });
  }

  for (const activity of activities) {
    await prisma.activity.create({
      data: {
        userId: activity.userId,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        type: activity.type as any,
        action: activity.action,
        description: activity.description,
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status,
        },
        createdAt: activity.createdAt,
      },
    });
  }
}

async function createEpicTasks(
  projects: Project[],
  users: User[]
): Promise<Task[]> {
  const epicTasks: Task[] = [];
  const adminUser = users[0];

  // Create 1-2 epic tasks per workspace
  const workspaceGroups = projects.reduce(
    (acc, project) => {
      if (!acc[project.workspaceId]) {
        acc[project.workspaceId] = [];
      }
      acc[project.workspaceId].push(project);
      return acc;
    },
    {} as Record<string, Project[]>
  );

  for (const [workspaceId, workspaceProjects] of Object.entries(
    workspaceGroups
  )) {
    const epicCount = faker.number.int({ min: 1, max: 2 });

    for (let i = 0; i < epicCount; i++) {
      const epic = await prisma.task.create({
        data: {
          workspaceId,
          projectId: null, // Epic spans multiple projects
          title: faker.helpers.arrayElement([
            'Platform Infrastructure Overhaul',
            'User Experience Enhancement Initiative',
            'Security and Compliance Implementation',
            'Performance Optimization Program',
            'Integration and API Standardization',
          ]),
          description: faker.lorem.paragraphs(2),
          status: faker.helpers.arrayElement([
            'TODO',
            'IN_PROGRESS',
            'IN_PROGRESS',
          ]),
          priority: faker.helpers.arrayElement(['HIGH', 'URGENT']),
          creatorId: adminUser.id,
          assigneeId: faker.helpers.arrayElement(users).id,
          estimatedHours: faker.number.int({ min: 200, max: 500 }),
          storyPoints: faker.number.int({ min: 50, max: 100 }),
          tags: ['epic', 'strategic'],
          labels: ['epic'],
          watchers: faker.helpers
            .arrayElements(users, { min: 3, max: 6 })
            .map(u => u.id),
          customFields: {
            complexity: 'high',
            category: 'strategic',
            department: 'Engineering',
            businessValue: 'High',
            riskLevel: 'Medium',
          },
          dueDate: faker.date.future({ years: 0.5 }),
          createdAt: faker.date.past({ years: 0.5 }),
          lastActivityAt: faker.date.recent({ days: 3 }),
        },
      });

      epicTasks.push(epic);

      // Create sub-tasks for the epic
      const subTaskCount = faker.number.int({ min: 3, max: 8 });
      for (let j = 0; j < subTaskCount; j++) {
        const subTask = await prisma.task.create({
          data: {
            workspaceId,
            projectId: faker.helpers.arrayElement(workspaceProjects).id,
            epicId: epic.id,
            title: `${epic.title} - Phase ${j + 1}`,
            description: faker.lorem.paragraph(),
            status: faker.helpers.arrayElement(['TODO', 'IN_PROGRESS', 'DONE']),
            priority: faker.helpers.arrayElement(['MEDIUM', 'HIGH']),
            creatorId: adminUser.id,
            assigneeId: faker.helpers.arrayElement(users).id,
            estimatedHours: faker.number.int({ min: 20, max: 80 }),
            storyPoints: faker.number.int({ min: 5, max: 21 }),
            tags: ['epic-subtask'],
            labels: ['subtask'],
            watchers: [epic.assigneeId!, adminUser.id],
            customFields: {
              complexity: faker.helpers.arrayElement(['medium', 'high']),
              category: 'development',
              epicId: epic.id,
            },
            dueDate: faker.date.between({
              from: new Date(),
              to: epic.dueDate!,
            }),
            createdAt: faker.date.between({
              from: epic.createdAt,
              to: new Date(),
            }),
            lastActivityAt: faker.date.recent({ days: 5 }),
          },
        });

        epicTasks.push(subTask);
      }
    }
  }

  return epicTasks;
}

async function createTaskDependencies(tasks: Task[]) {
  // Create realistic task dependencies
  const dependencyCount = Math.min(tasks.length * 0.2, 20); // 20% of tasks have dependencies

  for (let i = 0; i < dependencyCount; i++) {
    const dependentTask = faker.helpers.arrayElement(tasks);
    const possibleDependencies = tasks.filter(
      t =>
        t.id !== dependentTask.id &&
        t.projectId === dependentTask.projectId &&
        t.createdAt < dependentTask.createdAt
    );

    if (possibleDependencies.length > 0) {
      const dependsOnTask = faker.helpers.arrayElement(possibleDependencies);

      try {
        await prisma.taskDependency.create({
          data: {
            taskId: dependentTask.id,
            dependsOnId: dependsOnTask.id,
            type: faker.helpers.arrayElement([
              'FINISH_TO_START',
              'START_TO_START',
            ]),
            createdAt: faker.date.between({
              from: dependentTask.createdAt,
              to: new Date(),
            }),
          },
        });
      } catch (error) {
        // Ignore duplicate dependencies
      }
    }
  }
}

async function createRecurringTasks(projects: Project[], users: User[]) {
  const adminUser = users[0];

  // Create recurring tasks for each workspace
  const workspaceGroups = projects.reduce(
    (acc, project) => {
      if (!acc[project.workspaceId]) {
        acc[project.workspaceId] = [];
      }
      acc[project.workspaceId].push(project);
      return acc;
    },
    {} as Record<string, Project[]>
  );

  for (const [workspaceId, workspaceProjects] of Object.entries(
    workspaceGroups
  )) {
    const recurringTasks = [
      {
        pattern: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1], // Monday
        taskTemplate: {
          title: 'Weekly Team Standup',
          description: 'Weekly team synchronization and planning meeting',
          priority: 'MEDIUM',
          estimatedHours: 1,
          tags: ['meeting', 'recurring'],
          labels: ['standup'],
        },
      },
      {
        pattern: 'MONTHLY',
        interval: 1,
        daysOfMonth: [1],
        taskTemplate: {
          title: 'Monthly Security Review',
          description: 'Monthly security audit and compliance check',
          priority: 'HIGH',
          estimatedHours: 4,
          tags: ['security', 'audit', 'recurring'],
          labels: ['security'],
        },
      },
      {
        pattern: 'DAILY',
        interval: 1,
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        taskTemplate: {
          title: 'Daily Backup Verification',
          description: 'Verify daily backup completion and integrity',
          priority: 'HIGH',
          estimatedHours: 0.5,
          tags: ['backup', 'maintenance', 'recurring'],
          labels: ['ops'],
        },
      },
    ];

    for (const recurringData of recurringTasks) {
      await prisma.recurringTask.create({
        data: {
          workspaceId,
          projectId: faker.helpers.arrayElement(workspaceProjects).id,
          pattern: recurringData.pattern as any,
          interval: recurringData.interval,
          daysOfWeek: recurringData.daysOfWeek || [],
          daysOfMonth: recurringData.daysOfMonth || [],
          startDate: faker.date.past({ years: 0.1 }),
          endDate: faker.date.future({ years: 1 }),
          nextDueDate: faker.date.future({ days: 7 }),
          taskTemplate: recurringData.taskTemplate,
          isActive: true,
          createdAt: faker.date.past({ years: 0.2 }),
        },
      });
    }
  }
}

function getTasksDataForProject(projectName: string) {
  const baseTasks = [
    {
      title: 'Project Setup and Planning',
      description:
        'Initial project setup, requirements gathering, and planning phase',
      status: 'DONE' as const,
      priority: 'HIGH' as const,
      estimatedHours: 16,
      actualHours: 18,
      storyPoints: 8,
      tags: ['setup', 'planning'],
      labels: ['epic'],
      complexity: 'high',
      category: 'planning',
    },
    {
      title: 'Design System Creation',
      description:
        'Create comprehensive design system with components and guidelines',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      estimatedHours: 40,
      actualHours: 25,
      storyPoints: 13,
      tags: ['design', 'ui'],
      labels: ['design'],
      complexity: 'high',
      category: 'design',
    },
    {
      title: 'Database Schema Design',
      description: 'Design and implement database schema for the application',
      status: 'IN_REVIEW' as const,
      priority: 'MEDIUM' as const,
      estimatedHours: 24,
      actualHours: 20,
      storyPoints: 8,
      tags: ['database', 'backend'],
      labels: ['backend'],
      complexity: 'medium',
      category: 'development',
    },
    {
      title: 'API Development',
      description: 'Develop RESTful API endpoints with proper authentication',
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      estimatedHours: 60,
      storyPoints: 21,
      tags: ['api', 'backend'],
      labels: ['backend'],
      complexity: 'high',
      category: 'development',
    },
    {
      title: 'Frontend Components',
      description:
        'Implement reusable frontend components based on design system',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      estimatedHours: 80,
      storyPoints: 34,
      tags: ['frontend', 'components'],
      labels: ['frontend'],
      complexity: 'high',
      category: 'development',
    },
    {
      title: 'Testing Implementation',
      description: 'Write comprehensive unit and integration tests',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      estimatedHours: 32,
      storyPoints: 13,
      tags: ['testing', 'quality'],
      labels: ['testing'],
      complexity: 'medium',
      category: 'testing',
    },
    {
      title: 'Documentation',
      description: 'Create user and developer documentation',
      status: 'TODO' as const,
      priority: 'LOW' as const,
      estimatedHours: 16,
      storyPoints: 5,
      tags: ['documentation'],
      labels: ['docs'],
      complexity: 'low',
      category: 'documentation',
    },
  ];

  // Add project-specific tasks
  if (projectName.includes('Website')) {
    baseTasks.push(
      {
        title: 'SEO Optimization',
        description: 'Implement SEO best practices and meta tags',
        status: 'TODO' as const,
        priority: 'MEDIUM' as const,
        estimatedHours: 12,
        storyPoints: 5,
        tags: ['seo', 'optimization'],
        labels: ['frontend'],
        complexity: 'medium',
        category: 'optimization',
      },
      {
        title: 'Performance Optimization',
        description: 'Optimize website performance and loading times',
        status: 'TODO' as const,
        priority: 'HIGH' as const,
        estimatedHours: 20,
        storyPoints: 8,
        tags: ['performance', 'optimization'],
        labels: ['frontend'],
        complexity: 'high',
        category: 'optimization',
      }
    );
  }

  if (projectName.includes('Mobile')) {
    baseTasks.push(
      {
        title: 'iOS App Development',
        description: 'Develop native iOS application',
        status: 'TODO' as const,
        priority: 'HIGH' as const,
        estimatedHours: 120,
        storyPoints: 55,
        tags: ['ios', 'mobile'],
        labels: ['mobile'],
        complexity: 'high',
        category: 'development',
      },
      {
        title: 'Android App Development',
        description: 'Develop native Android application',
        status: 'TODO' as const,
        priority: 'HIGH' as const,
        estimatedHours: 120,
        storyPoints: 55,
        tags: ['android', 'mobile'],
        labels: ['mobile'],
        complexity: 'high',
        category: 'development',
      }
    );
  }

  return baseTasks;
}

function getRandomComment(): string {
  const comments = [
    'Great progress on this task!',
    'I have some questions about the implementation approach.',
    'This looks good to me, ready for review.',
    'We might need to consider edge cases here.',
    'The design looks fantastic, well done!',
    "I've updated the requirements based on client feedback.",
    'This is blocked by the API development task.',
    'We should add more test coverage for this feature.',
    'The performance improvements are significant.',
    'Documentation has been updated accordingly.',
  ];

  return comments[Math.floor(Math.random() * comments.length)];
}

function getTasksDataForProject(projectName: string, projectStatus: string) {
  const baseTasks = [
    {
      title: 'Project Setup and Planning',
      description: 'Initial project setup, requ