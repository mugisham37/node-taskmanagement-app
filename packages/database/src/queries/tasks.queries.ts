import { eq, and, or, like, desc, asc, inArray, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../client';
import { tasks, users, projects } from '../schema';

export const taskQueries = {
  // Find task by ID
  async findById(id: string) {
    return await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        assignee: true,
        createdBy: true,
        project: true,
      },
    });
  },

  // Find tasks by project
  async findByProject(projectId: string, userId?: string) {
    const whereConditions = [eq(tasks.projectId, projectId)];
    
    if (userId) {
      // Only return tasks the user has access to
      whereConditions.push(
        or(
          eq(tasks.assigneeId, userId),
          eq(tasks.createdById, userId)
        )
      );
    }

    return await db.query.tasks.findMany({
      where: and(...whereConditions),
      with: {
        assignee: true,
        createdBy: true,
        project: true,
      },
      orderBy: [desc(tasks.createdAt)],
    });
  },

  // Find tasks assigned to user
  async findByAssignee(assigneeId: string) {
    return await db.query.tasks.findMany({
      where: eq(tasks.assigneeId, assigneeId),
      with: {
        project: true,
        createdBy: true,
      },
      orderBy: [desc(tasks.createdAt)],
    });
  },

  // Find tasks created by user
  async findByCreator(createdById: string) {
    return await db.query.tasks.findMany({
      where: eq(tasks.createdById, createdById),
      with: {
        assignee: true,
        project: true,
      },
      orderBy: [desc(tasks.createdAt)],
    });
  },

  // Find tasks by status
  async findByStatus(status: string | string[], projectId?: string) {
    const statusCondition = Array.isArray(status) 
      ? inArray(tasks.status, status as any)
      : eq(tasks.status, status as any);

    const whereConditions = [statusCondition];
    
    if (projectId) {
      whereConditions.push(eq(tasks.projectId, projectId));
    }

    return await db.query.tasks.findMany({
      where: and(...whereConditions),
      with: {
        assignee: true,
        createdBy: true,
        project: true,
      },
      orderBy: [desc(tasks.createdAt)],
    });
  },

  // Find overdue tasks
  async findOverdue(userId?: string) {
    const whereConditions = [
      isNotNull(tasks.dueDate),
      // dueDate < now and status not completed
      // Note: This would need proper date comparison in real implementation
    ];

    if (userId) {
      whereConditions.push(eq(tasks.assigneeId, userId));
    }

    return await db.query.tasks.findMany({
      where: and(...whereConditions),
      with: {
        assignee: true,
        createdBy: true,
        project: true,
      },
      orderBy: [asc(tasks.dueDate)],
    });
  },

  // Search tasks
  async search(query: string, projectId?: string, userId?: string) {
    const whereConditions = [
      or(
        like(tasks.title, `%${query}%`),
        like(tasks.description, `%${query}%`)
      )
    ];

    if (projectId) {
      whereConditions.push(eq(tasks.projectId, projectId));
    }

    if (userId) {
      whereConditions.push(
        or(
          eq(tasks.assigneeId, userId),
          eq(tasks.createdById, userId)
        )
      );
    }

    return await db.query.tasks.findMany({
      where: and(...whereConditions),
      with: {
        assignee: true,
        createdBy: true,
        project: true,
      },
      orderBy: [desc(tasks.createdAt)],
      limit: 50,
    });
  },

  // Create task
  async create(taskData: typeof tasks.$inferInsert) {
    return await db.insert(tasks).values(taskData).returning();
  },

  // Update task
  async update(id: string, taskData: Partial<typeof tasks.$inferInsert>) {
    return await db
      .update(tasks)
      .set({ ...taskData, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
  },

  // Delete task
  async delete(id: string) {
    return await db.delete(tasks).where(eq(tasks.id, id)).returning();
  },

  // Update task status
  async updateStatus(id: string, status: any, completedAt?: Date) {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'COMPLETED' && !completedAt) {
      updateData.completedAt = new Date();
    } else if (status !== 'COMPLETED') {
      updateData.completedAt = null;
    }

    return await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
  },

  // Assign task to user
  async assign(id: string, assigneeId: string) {
    return await db
      .update(tasks)
      .set({ assigneeId, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
  },

  // Unassign task
  async unassign(id: string) {
    return await db
      .update(tasks)
      .set({ assigneeId: null, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
  },

  // Get task statistics for a project
  async getProjectStats(projectId: string) {
    // This would need proper aggregation queries in real implementation
    const allTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId),
    });

    return {
      total: allTasks.length,
      byStatus: allTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: allTasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
};