import { faker } from '@faker-js/faker';
import { IdGenerator } from '@/shared/utils/id-generator';
import { User } from '@/domain/entities/user';
import { Project } from '@/domain/entities/project';
import { Task } from '@/domain/entities/task';
import { Workspace } from '@/domain/entities/workspace';
import { Email } from '@/domain/value-objects/email';
import { UserId } from '@/domain/value-objects/user-id';
import { ProjectId } from '@/domain/value-objects/project-id';
import { TaskId } from '@/domain/value-objects/task-id';
import { WorkspaceId } from '@/domain/value-objects/workspace-id';
import { UserStatus } from '@/domain/value-objects/user-status';
import { TaskStatus } from '@/domain/value-objects/task-status';
import { ProjectStatus } from '@/domain/value-objects/project-status';
import { Priority } from '@/domain/value-objects/priority';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';

export class TestDataFactory {
  static createUser(overrides: Partial<any> = {}): User {
    const userId = new UserId(IdGenerator.generate());
    const email = new Email(faker.internet.email());
    const status = new UserStatus('ACTIVE');

    return new User(
      userId,
      email,
      faker.person.firstName(),
      faker.person.lastName(),
      faker.internet.password(),
      status,
      {
        ...overrides,
      }
    );
  }

  static createWorkspace(overrides: Partial<any> = {}): Workspace {
    const workspaceId = new WorkspaceId(IdGenerator.generate());

    return new Workspace(
      workspaceId,
      faker.company.name(),
      faker.lorem.slug(),
      faker.lorem.sentence(),
      {
        ...overrides,
      }
    );
  }

  static createProject(
    workspaceId: WorkspaceId,
    ownerId: UserId,
    overrides: Partial<any> = {}
  ): Project {
    const projectId = new ProjectId(IdGenerator.generate());
    const status = new ProjectStatus('ACTIVE');

    return new Project(
      projectId,
      workspaceId,
      ownerId,
      faker.lorem.words(3),
      faker.lorem.paragraph(),
      status,
      faker.date.future(),
      faker.date.future(),
      {
        ...overrides,
      }
    );
  }

  static createTask(
    projectId: ProjectId,
    assigneeId: UserId,
    creatorId: UserId,
    overrides: Partial<any> = {}
  ): Task {
    const taskId = new TaskId(IdGenerator.generate());
    const status = new TaskStatus('TODO');
    const priority = new Priority('MEDIUM');

    return new Task(
      taskId,
      projectId,
      assigneeId,
      creatorId,
      faker.lorem.words(5),
      faker.lorem.paragraph(),
      status,
      priority,
      faker.date.future(),
      faker.number.int({ min: 1, max: 40 }),
      0,
      {
        ...overrides,
      }
    );
  }

  static createUserData(overrides: Partial<any> = {}) {
    return {
      id: IdGenerator.generate(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      passwordHash: faker.internet.password(),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createProjectData(
    workspaceId: string,
    ownerId: string,
    overrides: Partial<any> = {}
  ) {
    return {
      id: IdGenerator.generate(),
      workspaceId,
      ownerId,
      name: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      status: 'ACTIVE',
      startDate: faker.date.past(),
      endDate: faker.date.future(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createTaskData(
    projectId: string,
    assigneeId: string,
    creatorId: string,
    overrides: Partial<any> = {}
  ) {
    return {
      id: IdGenerator.generate(),
      projectId,
      assigneeId,
      creatorId,
      title: faker.lorem.words(5),
      description: faker.lorem.paragraph(),
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: faker.date.future(),
      estimatedHours: faker.number.int({ min: 1, max: 40 }),
      actualHours: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createWorkspaceData(overrides: Partial<any> = {}) {
    return {
      id: IdGenerator.generate(),
      name: faker.company.name(),
      slug: faker.lorem.slug(),
      description: faker.lorem.sentence(),
      settings: {},
      planType: 'FREE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
}

export class TestAssertions {
  static assertValidId(id: string) {
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  }

  static assertValidEmail(email: string) {
    expect(email).toBeDefined();
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  }

  static assertValidDate(date: Date | string) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    expect(dateObj).toBeInstanceOf(Date);
    expect(dateObj.getTime()).not.toBeNaN();
  }

  static assertValidTimestamp(timestamp: Date | string) {
    this.assertValidDate(timestamp);
    const dateObj =
      typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    expect(dateObj.getTime()).toBeLessThanOrEqual(Date.now());
  }
}

// Re-export helpers from separate files
export { MockHelpers } from './mock-helpers';
export { DatabaseHelpers } from './database-helpers';
export { ApiHelpers } from './api-helpers';
