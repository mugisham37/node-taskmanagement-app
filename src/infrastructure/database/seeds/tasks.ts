import { prisma } from '../prisma-client';
import { User, Project, Task } from '@prisma/client';

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

  return tasks;
}

async function createProjectTasks(
  project: Project,
  users: User[]
): Promise<Task[]> {
  const tasks: Task[] = [];

  const tasksData = getTasksDataForProject(project.name);

  for (const taskData of tasksData) {
    const assigneeIndex = Math.floor(Math.random() * users.length);
    const assignee = users[assigneeIndex];
    const creator = users[0]; // Admin user creates all tasks

    const task = await prisma.task.create({
      data: {
        ...taskData,
        workspaceId: project.workspaceId,
        projectId: project.id,
        assigneeId: assignee.id,
        creatorId: creator.id,
        reporterId: creator.id,
        tags: taskData.tags || [],
        labels: taskData.labels || [],
        watchers: [assignee.id, creator.id],
        customFields: {
          complexity: taskData.complexity || 'medium',
          category: taskData.category || 'development',
        },
      },
    });
    tasks.push(task);

    // Create some comments for tasks
    if (Math.random() > 0.5) {
      await prisma.comment.create({
        data: {
          content: getRandomComment(),
          authorId: users[Math.floor(Math.random() * users.length)].id,
          taskId: task.id,
          mentions: [],
        },
      });
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        userId: creator.id,
        workspaceId: project.workspaceId,
        projectId: project.id,
        taskId: task.id,
        type: 'TASK_CREATED',
        action: 'created',
        description: `Created task "${task.title}"`,
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
        },
      },
    });
  }

  return tasks;
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
