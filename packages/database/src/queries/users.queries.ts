import { eq, and, or, like, desc, asc } from 'drizzle-orm';
import { db } from '../client';
import { users } from '../schema';

export const userQueries = {
  // Find user by ID
  async findById(id: string) {
    return await db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  // Find user by email
  async findByEmail(email: string) {
    return await db.query.users.findFirst({
      where: eq(users.email, email),
    });
  },

  // Find active users
  async findActive() {
    return await db.query.users.findMany({
      where: eq(users.isActive, true),
      orderBy: [asc(users.name)],
    });
  },

  // Search users by name or email
  async search(query: string, limit = 10) {
    return await db.query.users.findMany({
      where: and(
        eq(users.isActive, true),
        or(
          like(users.name, `%${query}%`),
          like(users.email, `%${query}%`)
        )
      ),
      limit,
      orderBy: [asc(users.name)],
    });
  },

  // Create user
  async create(userData: typeof users.$inferInsert) {
    return await db.insert(users).values(userData).returning();
  },

  // Update user
  async update(id: string, userData: Partial<typeof users.$inferInsert>) {
    return await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
  },

  // Soft delete user (deactivate)
  async deactivate(id: string) {
    return await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
  },

  // Update last login
  async updateLastLogin(id: string) {
    return await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
  },

  // Get user with relationships
  async findWithRelations(id: string) {
    return await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        createdTasks: {
          limit: 10,
          orderBy: [desc(users.createdAt)],
        },
        assignedTasks: {
          limit: 10,
          orderBy: [desc(users.createdAt)],
        },
        managedProjects: {
          limit: 10,
          orderBy: [desc(users.createdAt)],
        },
        ownedWorkspaces: {
          limit: 10,
          orderBy: [desc(users.createdAt)],
        },
      },
    });
  },
};