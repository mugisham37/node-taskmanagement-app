import { DatabaseConnection } from '../connection';
import { workspaces } from '../schema';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import { SeededUser } from './user-seeder';

export interface SeededWorkspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  isActive: boolean;
}

export class WorkspaceSeeder {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  async seed(count: number, users: SeededUser[]): Promise<SeededWorkspace[]> {
    if (users.length === 0) {
      throw new Error('No users available for workspace seeding');
    }

    const seededWorkspaces: SeededWorkspace[] = [];
    const batchSize = 50;

    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const batch = this.createWorkspaceBatch(batchCount, users);

      // Insert batch
      await this.connection.db.insert(workspaces).values(batch);

      seededWorkspaces.push(...batch);

      console.log(
        `Seeded ${Math.min(i + batchSize, count)}/${count} workspaces`
      );
    }

    return seededWorkspaces;
  }

  private createWorkspaceBatch(
    count: number,
    users: SeededUser[]
  ): SeededWorkspace[] {
    const batch: SeededWorkspace[] = [];

    for (let i = 0; i < count; i++) {
      const owner = faker.helpers.arrayElement(users);

      const workspace: SeededWorkspace = {
        id: nanoid(),
        name: faker.company.name(),
        description: faker.lorem.paragraph(),
        ownerId: owner.id,
        isActive: faker.datatype.boolean(0.95), // 95% active workspaces
      };

      batch.push(workspace);
    }

    return batch;
  }
}

export default WorkspaceSeeder;
