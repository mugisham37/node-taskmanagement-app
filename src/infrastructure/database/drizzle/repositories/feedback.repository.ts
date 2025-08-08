import { eq, and, or, ilike, isNull, isNotNull, desc, asc, inArray, count } from 'drizzle-orm';
import { BaseRepository } from './base/base.repository';
import { 
  feedback, 
  Feedback, 
  NewFeedback,
  feedbackComments,
  FeedbackComment,
  NewFeedbackComment
} from '../schema/feedback';
import { PaginationOptions, PaginatedResult, SearchOptions } from './base/interfaces';
import { RepositoryException } from './base/types';

export class FeedbackRepository extends BaseRepository<Feedback, NewFeedback> {
  protected table = feedback;
  protected primaryKey = 'id';

  constructor() {
    super(
      { enabled: true, ttl: 180, keyPrefix: 'feedback' }, // Enable caching for feedback
      { enabled: true, trackChanges: true } // Enable audit logging
    );
  }

  // Feedback specific methods
  async findByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.userId, userId),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByUser');
    }
  }

  async findByType(type: string, options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.type, type),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByType');
    }
  }

  async findByStatus(status: string, options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.status, status),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByStatus');
    }
  }

  async findByPriority(priority: string, options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.priority, priority),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByPriority');
    }
  }

  async findByCategory(category: string, options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.category, category),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByCategory');
    }
  }

  async findByAdminUser(adminUserId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.adminUserId, adminUserId),
        ...options,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findByAdminUser');
    }
  }

  async findPendingFeedback(options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: eq(feedback.status, 'pending'),
        ...options,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      });
    } catch (error) {
      throw this.handleError(error, 'findPendingFeedback');
    }
  }

  async findHighPriorityFeedback(options: PaginationOptions = {}): Promise<PaginatedResult<Feedback>> {
    try {
      return await this.findMany({
        where: or(
          eq(feedback.priority, 'high'),
          eq(feedback.priority, 'critical')
        ),
        ...options,
        sortBy: 'priority',
        sortOrder: 'desc'
      });
    } catch (error) {
      throw this.handleError(error, 'findHighPriorityFeedback');
    }
  }

  async updateStatus(feedbackId: string, status: string, adminUserId?: string): Promise<Feedback | null> {
    try {
      const updateData: any = { 
        status,
        updatedAt: new Date()
      };

      if (adminUserId) {
        updateData.adminUserId = adminUserId;
      }

      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      return await this.update(feedbackId, updateData);
    } catch (error) {
      throw this.handleError(error, 'updateStatus');
    }
  }

  async updatePriority(feedbackId: string, priority: string): Promise<Feedback | null> {
    try {
      return await this.update(feedbackId, {
        priority,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'updatePriority');
    }
  }

  async addAdminResponse(feedbackId: string, response: string, adminUserId: string): Promise<Feedback | null> {
    try {
      return await this.update(feedbackId, {
        adminResponse: response,
        adminUserId,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'addAdminResponse');
    }
  }

  async addVote(feedbackId: string, userId: string, voteType: 'up' | 'down'): Promise<Feedback | null> {
    try {
      const feedbackItem = await this.findById(feedbackId);
      if (!feedbackItem) return null;

      const votes = (feedbackItem.votes as any) || { up: 0, down: 0, users: [] };
      const userVotes = votes.users || [];

      // Remove existing vote from this user
      const existingVoteIndex = userVotes.findIndex((vote: any) => vote.userId === userId);
      if (existingVoteIndex !== -1) {
        const existingVote = userVotes[existingVoteIndex];
        if (existingVote.type === 'up') votes.up--;
        if (existingVote.type === 'down') votes.down--;
        userVotes.splice(existingVoteIndex, 1);
      }

      // Add new vote
      userVotes.push({ userId, type: voteType, timestamp: new Date() });
      if (voteType === 'up') votes.up++;
      if (voteType === 'down') votes.down++;

      votes.users = userVotes;

      return await this.update(feedbackId, {
        votes,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'addVote');
    }
  }

  async removeVote(feedbackId: string, userId: string): Promise<Feedback | null> {
    try {
      const feedbackItem = await this.findById(feedbackId);
      if (!feedbackItem) return null;

      const votes = (feedbackItem.votes as any) || { up: 0, down: 0, users: [] };
      const userVotes = votes.users || [];

      const existingVoteIndex = userVotes.findIndex((vote: any) => vote.userId === userId);
      if (existingVoteIndex !== -1) {
        const existingVote = userVotes[existingVoteIndex];
        if (existingVote.type === 'up') votes.up--;
        if (existingVote.type === 'down') votes.down--;
        userVotes.splice(existingVoteIndex, 1);
      }

      votes.users = userVotes;

      return await this.update(feedbackId, {
        votes,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'removeVote');
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<Feedback>> {
    try {
      const { query, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const searchPattern = `%${query}%`;

      const whereCondition = or(
        ilike(feedback.title, searchPattern),
        ilike(feedback.description, searchPattern)
      );

      return await this.findMany({
        where: whereCondition,
        page,
        limit,
        sortBy,
        sortOrder
      });
    } catch (error) {
      throw this.handleError(error, 'search');
    }
  }

  async getFeedbackStats(adminUserId?: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const baseWhere = adminUserId ? eq(feedback.adminUserId, adminUserId) : undefined;

      const [
        total,
        pending,
        inProgress,
        resolved,
        rejected
      ] = await Promise.all([
        this.count({ where: baseWhere }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(feedback.status, 'pending')) : eq(feedback.status, 'pending')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(feedback.status, 'in-progress')) : eq(feedback.status, 'in-progress')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(feedback.status, 'resolved')) : eq(feedback.status, 'resolved')
        }),
        this.count({ 
          where: baseWhere ? and(baseWhere, eq(feedback.status, 'rejected')) : eq(feedback.status, 'rejected')
        })
      ]);

      // For byType and byPriority stats, we'd need to group by those fields
      const byType: Record<string, number> = {}; // Placeholder
      const byPriority: Record<string, number> = {}; // Placeholder

      return {
        total,
        pending,
        inProgress,
        resolved,
        rejected,
        byType,
        byPriority
      };
    } catch (error) {
      throw this.handleError(error, 'getFeedbackStats');
    }
  }

  // Feedback Comments Management
  async addComment(feedbackId: string, userId: string, content: string, isInternal: boolean = false): Promise<FeedbackComment> {
    try {
      const commentData: NewFeedbackComment = {
        feedbackId,
        userId,
        content,
        isInternal
      };

      const result = await this.db
        .insert(feedbackComments)
        .values(commentData)
        .returning();

      return result[0] as FeedbackComment;
    } catch (error) {
      throw this.handleError(error, 'addComment');
    }
  }

  async getFeedbackComments(feedbackId: string, includeInternal: boolean = false): Promise<FeedbackComment[]> {
    try {
      const whereCondition = includeInternal 
        ? eq(feedbackComments.feedbackId, feedbackId)
        : and(
            eq(feedbackComments.feedbackId, feedbackId),
            eq(feedbackComments.isInternal, false)
          );

      const result = await this.db
        .select()
        .from(feedbackComments)
        .where(whereCondition)
        .orderBy(asc(feedbackComments.createdAt));

      return result as FeedbackComment[];
    } catch (error) {
      throw this.handleError(error, 'getFeedbackComments');
    }
  }

  async updateComment(commentId: string, content: string): Promise<FeedbackComment | null> {
    try {
      const result = await this.db
        .update(feedbackComments)
        .set({ 
          content,
          updatedAt: new Date()
        })
        .where(eq(feedbackComments.id, commentId))
        .returning();

      return (result[0] as FeedbackComment) || null;
    } catch (error) {
      throw this.handleError(error, 'updateComment');
    }
  }

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(feedbackComments)
        .where(eq(feedbackComments.id, commentId));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      throw this.handleError(error, 'deleteComment');
    }
  }

  async bulkUpdateStatus(feedbackIds: string[], status: string, adminUserId?: string): Promise<{ success: boolean; count: number }> {
    try {
      const updateData: any = { 
        status,
        updatedAt: new Date()
      };

      if (adminUserId) {
        updateData.adminUserId = adminUserId;
      }

      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      return await this.updateMany(feedbackIds, updateData);
    } catch (error) {
      throw this.handleError(error, 'bulkUpdateStatus');
    }
  }

  async bulkUpdatePriority(feedbackIds: string[], priority: string): Promise<{ success: boolean; count: number }> {
    try {
      return await this.updateMany(feedbackIds, {
        priority,
        updatedAt: new Date()
      } as any);
    } catch (error) {
      throw this.handleError(error, 'bulkUpdatePriority');
    }
  }

  async bulkDeleteByUser(userId: string): Promise<{ success: boolean; count: number }> {
    try {
      const userFeedback = await this.findByUser(userId, { limit: 1000 });
      const feedbackIds = userFeedback.data.map(item => item.id);
      
      if (feedbackIds.length === 0) {
        return { success: true, count: 0 };
      }

      return await this.deleteMany(feedbackIds);
    } catch (error) {
      throw this.handleError(error, 'bulkDeleteByUser');
    }
  }

  // Override create to add validation
  async create(data: NewFeedback): Promise<Feedback> {
    try {
      // Add any feedback-specific validation here
      if (!data.title || data.title.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Feedback title cannot be empty');
      }

      if (!data.description || data.description.trim().length === 0) {
        throw new RepositoryException('VALIDATION_ERROR', 'Feedback description cannot be empty');
      }

      return await super.create(data);
    } catch (error) {
      if (error instanceof RepositoryException) {
        throw error;
      }
      throw this.handleError(error, 'create');
    }
  }

  // Helper method to access db from base class
  private get db() {
    return (this as any).db || require('../../connection').db;
  }
}

// Export singleton instance
export const feedbackRepository = new FeedbackRepository();
