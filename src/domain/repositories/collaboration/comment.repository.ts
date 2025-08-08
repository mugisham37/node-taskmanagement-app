import {
  eq,
  and,
  or,
  ilike,
  isNull,
  isNotNull,
  desc,
  asc,
  inArray,
} from 'drizzle-orm';
import { BaseRepository } from '../../../infrastructure/database/drizzle/repositories/base/base.repository';
import { comments, Comment, NewComment } from '../schemas/comments';
import {
  PaginationOptions,
  PaginatedResult,
  SearchOptions,
} from '../../../infrastructure/database/drizzle/repositories/base/interfaces';
import { RepositoryException } from '../../../infrastructure/database/drizzle/repositories/base/types';

export class CommentRepository extends BaseRepository<Comment, NewComment> {
  protected table = comments;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 180, keyPrefix: 'comment' }, // Enable caching for comments
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Comment-specific methods
  async findByTask(
    taskId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Comment>> {
    try {
      return await this.findMany({
        where: eq(comments.taskId, taskId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'asc', // Comments usually shown chronologically
      });
    } catch (error) {
      throw this.handleError(error, 'findByTask');
    }
  }

  async findByAuthor(
    authorId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Comment>> {
    try {
      return await this.findMany({
        where: eq(comments.authorId, authorId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findByAuthor');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Comment>> {
    try {
      const {
        query,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = ilike(comments.content, searchPattern);

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder,
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  async getCommentStats(
    taskId?: string,
    authorId?: string
  ): Promise<{
    total: number;
    recent: number;
  }> {
    try {
      let baseWhere;

      if (taskId && authorId) {
        baseWhere = and(
          eq(comments.taskId, taskId),
          eq(comments.authorId, authorId)
        );
      } else if (taskId) {
        baseWhere = eq(comments.taskId, taskId);
      } else if (authorId) {
        baseWhere = eq(comments.authorId, authorId);
      }

      const [total] = await Promise.all([this.count({ where: baseWhere })]);

      // For recent comments, we'd need proper date comparison
      const recent = 0; // Placeholder

      return {
        total,
        recent,
      };
    } catch (error) {
      throw this.handleError(error, 'getCommentStats');
    }
  }

  async findRecentComments(
    days: number = 7,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Comment>> {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);

      // Note: You'd need to implement proper date comparison here with Drizzle
      return await this.findMany({
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (error) {
      throw this.handleError(error, 'findRecentComments');
    }
  }

  async bulkDeleteByTask(
    taskId: string
  ): Promise<{ success: boolean; count: number }> {
    try {
      const commentsToDelete = await this.findByTask(taskId, { limit: 1000 }); // Get all comments for the task
      const commentIds = commentsToDelete.data.map(comment => comment.id);

      if (commentIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(commentIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByTask');
    }
  }

  async bulkDeleteByAuthor(
    authorId: string
  ): Promise<{ success: boolean; count: number }> {
    try {
      const commentsToDelete = await this.findByAuthor(authorId, {
        limit: 1000,
      }); // Get all comments by author
      const commentIds = commentsToDelete.data.map(comment => comment.id);

      if (commentIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(commentIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByAuthor');
    }
  }

  // Override create to add validation
  async create(data: NewComment): Promise<Comment> {
    try {
      // Add any comment-specific validation here
      if (!data.content || data.content.trim().length === 0) {
        throw new RepositoryException(
          'VALIDATION_ERROR',
          'Comment content cannot be empty'
        );
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }

  // Override update to prevent changing core fields
  async update(id: string, data: Partial<NewComment>): Promise<Comment | null> {
    try {
      // Prevent changing taskId and authorId after creation
      const updateData = { ...data };
      delete (updateData as any).taskId;
      delete (updateData as any).authorId;

      if (!updateData.content || updateData.content.trim().length === 0) {
        throw new RepositoryException(
          'VALIDATION_ERROR',
          'Comment content cannot be empty'
        );
      }

      return await super.update(id, updateData);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'update');
    }
  }
}

// Export singleton instance
export const commentRepository = new CommentRepository();
