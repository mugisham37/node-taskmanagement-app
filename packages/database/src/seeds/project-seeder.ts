import { DatabaseConnection } from '../connection';
import { projects, projectMembers } from '../schema';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import { SeededUser } from './user-seeder';
import { SeededWorkspace } from './workspace-seeder';

export interface SeededProject {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
  managerId: string;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
}

export class ProjectSeeder {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  async seed(
    workspaces: SeededWorkspace[],
    users: SeededUser[],
    projectsPerWorkspace: number
  ): Promise<SeededProject[]> {
    if (workspaces.length === 0 || users.length === 0) {
      throw new Error('No workspaces or users available for project seeding');
    }

    const seededProjects: SeededProject[] = [];

    for (const workspace of workspaces) {
      const projectCount = faker.number.int({
        min: 1,
        max: projectsPerWorkspace,
      });

      for (let i = 0; i < projectCount; i++) {
        const manager = faker.helpers.arrayElement(users);

        const project: SeededProject = {
          id: nanoid(),
          name: faker.lorem.words(3),
          description: faker.lorem.paragraph(),
          workspaceId: workspace.id,
          managerId: manager.id,
          status: faker.helpers.arrayElement([
            'PLANNING',
            'ACTIVE',
            'COMPLETED', 
            'ON_HOLD',
            'CANCELLED',
            'ARCHIVED',
          ]),
        };

        seededProjects.push(project);

        // Add project members
        await this.addProjectMembers(project, users);
      }

      console.log(`Seeded projects for workspace: ${workspace.name}`);
    }

    // Insert all projects
    const batchSize = 100;
    for (let i = 0; i < seededProjects.length; i += batchSize) {
      const batch = seededProjects.slice(i, i + batchSize);
      await this.connection.db.insert(projects).values(batch);
    }

    return seededProjects;
  }

  private async addProjectMembers(
    project: SeededProject,
    users: SeededUser[]
  ): Promise<void> {
    const memberCount = faker.number.int({ min: 2, max: 8 });
    const selectedUsers = faker.helpers.arrayElements(users, memberCount);

    const members = selectedUsers.map(user => ({
      id: nanoid(),
      projectId: project.id,
      userId: user.id,
      role: faker.helpers.arrayElement(['OWNER', 'MANAGER', 'MEMBER', 'VIEWER']),
      joinedAt: faker.date.past(),
    }));

    // Ensure project manager is a member
    if (!members.find(m => m.userId === project.managerId)) {
      members[0] = {
        id: nanoid(),
        projectId: project.id,
        userId: project.managerId,
        role: 'OWNER',
        joinedAt: faker.date.past(),
      };
    }

    await this.connection.db.insert(projectMembers).values(members);
  }
}

export default ProjectSeeder;
