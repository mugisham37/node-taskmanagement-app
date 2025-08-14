import { eq, and, or, like, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../client';
import { projects, users, workspaces, projectMembers } from '../schema';

export const projectQueries = {
  // Find project by ID
  async findById(id: string) {
    return await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        workspace: true,
        manager: true,
        members: {
          with: {
            user: true,
          },
        },
        tasks: {
          limit: 10,
          orderBy: [desc(projects.createdAt)],
          with: {
            assignee: true,
          },
        },
      },
    });
  },

  // Find projects by workspace
  async findByWorkspace(workspaceId: string, userId?: string) {
    const whereConditions = [eq(projects.workspaceId, workspaceId)];

    // If userId provided, only return projects where user is a member or manager
    if (userId) {
      // This would need a proper join in real implementation
      // For now, we'll get all projects and filter later
    }

    return await db.query.projects.findMany({
      where: and(...whereConditions),
      with: {
        manager: true,
        members: {
          with: {
            user: true,
          },
        },
      },
      orderBy: [desc(projects.createdAt)],
    });
  },

  // Find projects managed by user
  async findByManager(managerId: string) {
    return await db.query.projects.findMany({
      where: eq(projects.managerId, managerId),
      with: {
        workspace: true,
        members: {
          with: {
            user: true,
          },
        },
      },
      orderBy: [desc(projects.createdAt)],
    });
  },

  // Find projects by status
  async findByStatus(status: string | string[], workspaceId?: string) {
    const statusCondition = Array.isArray(status) 
      ? inArray(projects.status, status as any)
      : eq(projects.status, status as any);

    const whereConditions = [statusCondition];
    
    if (workspaceId) {
      whereConditions.push(eq(projects.workspaceId, workspaceId));
    }

    return await db.query.projects.findMany({
      where: and(...whereConditions),
      with: {
        manager: true,
        workspace: true,
      },
      orderBy: [desc(projects.createdAt)],
    });
  },

  // Search projects
  async search(query: string, workspaceId?: string, userId?: string) {
    const whereConditions = [
      or(
        like(projects.name, `%${query}%`),
        like(projects.description, `%${query}%`)
      )
    ];

    if (workspaceId) {
      whereConditions.push(eq(projects.workspaceId, workspaceId));
    }

    return await db.query.projects.findMany({
      where: and(...whereConditions),
      with: {
        manager: true,
        workspace: true,
        members: {
          with: {
            user: true,
          },
        },
      },
      orderBy: [desc(projects.createdAt)],
      limit: 50,
    });
  },

  // Create project
  async create(projectData: typeof projects.$inferInsert) {
    return await db.insert(projects).values(projectData).returning();
  },

  // Update project
  async update(id: string, projectData: Partial<typeof projects.$inferInsert>) {
    return await db
      .update(projects)
      .set({ ...projectData, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
  },

  // Delete project
  async delete(id: string) {
    return await db.delete(projects).where(eq(projects.id, id)).returning();
  },

  // Update project status
  async updateStatus(id: string, status: any) {
    return await db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
  },

  // Add member to project
  async addMember(projectId: string, userId: string, role: any = 'MEMBER') {
    return await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId,
      role,
    }).returning();
  },

  // Remove member from project
  async removeMember(projectId: string, userId: string) {
    return await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .returning();
  },

  // Update member role
  async updateMemberRole(projectId: string, userId: string, role: any) {
    return await db
      .update(projectMembers)
      .set({ role })
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .returning();
  },

  // Get project members
  async getMembers(projectId: string) {
    return await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, projectId),
      with: {
        user: true,
      },
      orderBy: [asc(projectMembers.joinedAt)],
    });
  },

  // Check if user is project member
  async isMember(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ),
    });
    return !!member;
  },

  // Get user's role in project
  async getUserRole(projectId: string, userId: string) {
    const member = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ),
    });
    return member?.role || null;
  },

  // Get project statistics
  async getStats(projectId: string) {
    // This would need proper aggregation queries in real implementation
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        tasks: true,
        members: true,
      },
    });

    if (!project) return null;

    return {
      totalTasks: project.tasks.length,
      completedTasks: project.tasks.filter(t => t.status === 'COMPLETED').length,
      totalMembers: project.members.length,
      tasksByStatus: project.tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      tasksByPriority: project.tasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
};