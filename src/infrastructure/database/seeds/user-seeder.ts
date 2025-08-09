import { DatabaseConnection } from '../connection';
import { users } from '../schema';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';

export interface SeededUser {
  id: string;
  email: string;
  name: string;
  hashedPassword: string;
  isActive: boolean;
}

export class UserSeeder {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  async seed(count: number): Promise<SeededUser[]> {
    const seededUsers: SeededUser[] = [];
    const batchSize = 100;

    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const batch = await this.createUserBatch(batchCount);

      // Insert batch
      await this.connection.db.insert(users).values(batch);

      seededUsers.push(...batch);

      console.log(`Seeded ${Math.min(i + batchSize, count)}/${count} users`);
    }

    return seededUsers;
  }

  async getExistingUsers(): Promise<SeededUser[]> {
    const result = await this.connection.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        hashedPassword: users.hashedPassword,
        isActive: users.isActive,
      })
      .from(users);

    return result;
  }

  private async createUserBatch(count: number): Promise<SeededUser[]> {
    const batch: SeededUser[] = [];

    for (let i = 0; i < count; i++) {
      const user: SeededUser = {
        id: nanoid(),
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        hashedPassword: await this.hashPassword('password123'), // Default password for seeded users
        isActive: faker.datatype.boolean(0.9), // 90% active users
      };

      batch.push(user);
    }

    return batch;
  }

  private async hashPassword(password: string): Promise<string> {
    // In a real implementation, this would use argon2 or bcrypt
    // For seeding purposes, we'll use a simple hash
    return `hashed_${password}`;
  }
}

export default UserSeeder;
