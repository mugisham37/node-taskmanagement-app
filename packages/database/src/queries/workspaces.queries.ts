import { eq, and, like, desc, asc } from 'drizzle-orm';
import { db } from '../client';
import { workspaces, users, projects } from '../schema';

export const workspaceQueries = {
  // Find workspace by ID
  async findById(id: string) {
    return await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
      with: {
        owner: true,
        projects: {
          with: {
            manager: true,
          },
          orderBy: [desc(projects.createdAt)],
        },
      },
    });
  },

  // Find workspaces by owner
  async findByOwner(ownerId: string) {
    return await db.query.workspaces.findMany({
      where: eq(workspaces.ownerId, ownerId),
      with: {
        projects: {
          limit: 5,
          orderBy: [desc(projects.createdAt)],
        },
      },
      orderBy: [desc(workspaces.createdAt)],
    });
  },

  // Find active workspaces
  async findActive() {
    return await db.query.workspaces.findMany({
      where: eq(workspaces.isActive, true),
      with: {
        owner: true,
      },
      orderBy: [asc(workspaces.name)],
    });
  },

  // Search workspaces
  async search(query: string, ownerId?: string) {
    const whereConditions = [
      eq(workspaces.isActive, true),
      like(workspaces.name, `%${query}%`)
    ];

    if (ownerId) {
      whereConditions.push(eq(workspaces.ownerId, ownerId));
    }

    return await db.query.workspaces.findMany({
      where: and(...whereConditions),
      with: {
        owner: true,
        projects: {
          limit: 3,
          orderBy: [desc(projects.createdAt)],
        },
      },
      orderBy: [asc(workspaces.name)],
      limit: 20,
    });
  },

  // Create workspace
  async create(workspaceData: typeof workspaces.$inferInsert) {
    return await db.insert(workspaces).values(workspaceData).returning();
  },

  // Update workspace
  async update(id: string, workspaceData: Partial<typeof workspaces.$inferInsert>) {
    return await db
      .update(workspaces)
      .set({ ...workspaceData, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
  },

  // Soft delete workspace (deactivate)
  async deactivate(id: string) {
    return await db
      .update(workspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
  },

  // Reactivate workspace
  async reactivate(id: string) {
    return await db
      .update(workspaces)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
  },

  // Delete workspace permanently
  async delete(id: string) {
    return await db.delete(workspaces).where(eq(workspaces.id, id)).returning();
  },

  // Get workspace statistics
  async getStats(id: string) {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
      with: {
        projects: {
          with: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    if (!workspace) return null;

    const totalTasks = workspace.projects.reduce((sum, project) => sum + project.tasks.length, 0);
    const completedTasks = workspace.projects.reduce(
      (sum, project) => sum + project.tasks.filter(t => t.status === 'COMPLETED').length, 
      0
    );
    const totalMembers = new Set(
      workspace.projects.flatMap(project => project.members.map(m => m.userId))
    ).size;

    return {
      totalProjects: workspace.projects.length,
      activeProjects: workspace.projects.filter(p => p.status === 'ACTIVE').length,
      totalTasks,
      completedTasks,
      totalMembers,
      projectsByStatus: workspace.projects.reduce((acc, project) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },

  // Check if user has access to workspace
  async hasAccess(workspaceId: string, userId: string) {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    if (!workspace) return false;
    if (workspace.ownerId === userId) return true;

    // Check if user is a member of any project in the workspace
    const projects = await db.query.projects.findMany({
      where: eq(projects.workspaceId, workspaceId),
      with: {
        members: true,
      },
    });

    return projects.some(project => 
      project.managerId === userId || 
      project.members.some(member => member.userId === userId)
    );
  },
};