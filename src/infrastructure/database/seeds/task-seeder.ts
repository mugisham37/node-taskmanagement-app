import { DatabaseConnection } from '../connection';
import { tasks, taskDependencies } from '../schema';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import { SeededUser } from './user-seeder';
import { SeededProject } from './project-seeder';

export interface SeededTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  projectId: string;
  createdById: string;
}

export class TaskSeeder {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  async seed(
    projects: SeededProject[],
    users: SeededUser[],
    tasksPerProject: number
  ): Promise<SeededTask[]> {
    if (projects.length === 0 || users.length === 0) {
      throw new Error('No projects or users available for task seeding');
    }

    const seededTasks: SeededTask[] = [];

    for (const project of projects) {
      const taskCount = faker.number.int({ min: 5, max: tasksPerProject });

      for (let i = 0; i < taskCount; i++) {
        const creator = faker.helpers.arrayElement(users);
        const assignee = faker.datatype.boolean(0.8)
          ? faker.helpers.arrayElement(users)
          : null;

        const task: SeededTask = {
          id: nanoid(),
          title: faker.lorem.sentence({ min: 3, max: 8 }),
          description: faker.lorem.paragraph(),
          status: faker.helpers.arrayElement([
            'TODO',
            'IN_PROGRESS',
            'IN_REVIEW',
            'COMPLETED',
            'CANCELLED',
          ]),
          priority: faker.helpers.arrayElement([
            'LOW',
            'MEDIUM',
            'HIGH',
            'URGENT',
          ]),
          assigneeId: assignee?.id || null,
          projectId: project.id,
          createdById: creator.id,
        };

        seededTasks.push(task);
      }

      console.log(`Seeded tasks for project: ${project.name}`);
    }

    // Insert all tasks
    const batchSize = 200;
    for (let i = 0; i < seededTasks.length; i += batchSize) {
      const batch = seededTasks.slice(i, i + batchSize);
      await this.connection.db.insert(tasks).values(batch);
    }

    // Add some task dependencies
    await this.addTaskDependencies(seededTasks);

    return seededTasks;
  }

  private async addTaskDependencies(tasks: SeededTask[]): Promise<void> {
    const dependencies = [];

    // Group tasks by project
    const tasksByProject = tasks.reduce(
      (acc, task) => {
        if (!acc[task.projectId]) {
          acc[task.projectId] = [];
        }
        acc[task.projectId].push(task);
        return acc;
      },
      {} as Record<string, SeededTask[]>
    );

    // Create dependencies within each project
    for (const projectTasks of Object.values(tasksByProject)) {
      const dependencyCount = Math.min(
        faker.number.int({ min: 1, max: 5 }),
        Math.floor(projectTasks.length / 2)
      );

      for (let i = 0; i < dependencyCount; i++) {
        const task = faker.helpers.arrayElement(projectTasks);
        const dependsOn = faker.helpers.arrayElement(
          projectTasks.filter(t => t.id !== task.id)
        );

        dependencies.push({
          id: nanoid(),
          taskId: task.id,
          dependsOnId: dependsOn.id,
          createdAt: new Date(),
        });
      }
    }

    if (dependencies.length > 0) {
      await this.connection.db.insert(taskDependencies).values(dependencies);
      console.log(`Created ${dependencies.length} task dependencies`);
    }
  }
}

export default TaskSeeder;
