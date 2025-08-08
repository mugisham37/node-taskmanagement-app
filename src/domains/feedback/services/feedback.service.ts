import { eq, and, or, desc, asc, count, ilike, isNull, isNotNull, gte, lte, inArray } from 'drizzle-orm';
import { BaseService, ServiceContext, NotFoundError, ValidationError, ForbiddenError } from './base.service';
import { 
  feedbackRepository, 
  userRepository, 
  workspaceRepository, 
  teamRepository,
  projectRepository
} from '../db/repositories';
import { Feedback, NewFeedback } from '../db/schema/feedback';
import { PaginationOptions, PaginatedResult } from '../db/repositories/base/interfaces';
import { emailService } from './email.service';
import { notificationService, NotificationType } from './notification.service';
import { activityService } from './activity.service';

export enum FeedbackType {
  BUG = 'bug',
  FEATURE = 'feature',
  IMPROVEMENT = 'improvement',
  OTHER = 'other'
}

export enum FeedbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected'
}

export enum FeedbackPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface FeedbackFilters {
  type?: FeedbackType | FeedbackType[];
  status?: FeedbackStatus | FeedbackStatus[];
  priority?: FeedbackPriority | FeedbackPriority[];
  userId?: string;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  search?: string;
  hasScreenshots?: boolean;
  hasVotes?: boolean;
}

export interface FeedbackCreateData {
  type: FeedbackType;
  title: string;
  description: string;
  priority?: FeedbackPriority;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  screenshots?: string[];
  metadata?: {
    browser?: string;
    os?: string;
    device?: string;
    url?: string;
    userAgent?: string;
    version?: string;
  };
  tags?: string[];
}

export interface FeedbackUpdateData {
  type?: FeedbackType;
  title?: string;
  description?: string;
  priority?: FeedbackPriority;
  status?: FeedbackStatus;
  adminResponse?: string;
  screenshots?: string[];
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageResolutionTime: number;
  satisfactionScore: number;
  topContributors: Array<{
    userId: string;
    userName: string;
    feedbackCount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    count: number;
    resolved: number;
  }>;
}

export class FeedbackService extends BaseService {
  constructor() {
    super('FeedbackService', {
      enableCache: true,
      cacheTimeout: 300,
      enableAudit: true,
      enableMetrics: true
    });
  }

  // Core CRUD Operations
  async createFeedback(data: FeedbackCreateData, context?: ServiceContext): Promise<Feedback> {
    const ctx = this.createContext(context);
    this.logOperation('createFeedback', ctx, { 
      type: data.type, 
      title: data.title,
      hasScreenshots: (data.screenshots?.length || 0) > 0
    });

    try {
      // Validate input
      this.validateFeedbackData(data);

      // Verify workspace/team/project access if specified
      if (data.workspaceId) {
        await this.verifyWorkspaceAccess(data.workspaceId, ctx.userId!);
      }
      if (data.teamId) {
        await this.verifyTeamAccess(data.teamId, ctx.userId!);
      }
      if (data.projectId) {
        await this.verifyProjectAccess(data.projectId, ctx.userId!);
      }

      // Create feedback
      const newFeedback: NewFeedback = {
        type: data.type,
        title: data.title,
        description: data.description,
        priority: data.priority || FeedbackPriority.MEDIUM,
        status: FeedbackStatus.PENDING,
        userId: ctx.userId!,
        screenshots: data.screenshots || [],
        metadata: {
          ...data.metadata,
          submittedAt: new Date().toISOString(),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent
        },
        tags: data.tags || []
      };

      const feedback = await feedbackRepository.create(newFeedback);

      // Send notification to admins
      await this.notifyAdminsOfNewFeedback(feedback);

      // Log activity
      await activityService.createActivity({
        userId: ctx.userId!,
        type: 'task_created',
        data: {
          action: 'feedback_created',
          feedbackId: feedback.id,
          feedbackType: feedback.type,
          feedbackTitle: feedback.title,
          priority: feedback.priority
        },
        metadata: {
          feedbackId: feedback.id,
          hasScreenshots: (data.screenshots?.length || 0) > 0
        }
      }, ctx);

      await this.recordMetric('feedback.created', 1, { 
        type: feedback.type,
        priority: feedback.priority,
        hasScreenshots: (data.screenshots?.length || 0) > 0 ? 'true' : 'false'
      });

      return feedback;
    } catch (error) {
      this.handleError(error, 'createFeedback', ctx);
    }
  }

  async getFeedbackById(id: string, context?: ServiceContext): Promise<Feedback> {
    const ctx = this.createContext(context);
    this.logOperation('getFeedbackById', ctx, { feedbackId: id });

    try {
      const feedback = await feedbackRepository.findById(id);
      if (!feedback) {
        throw new NotFoundError('Feedback', id);
      }

      // Check access permissions
      await this.verifyFeedbackAccess(feedback, ctx.userId!);

      return feedback;
    } catch (error) {
      this.handleError(error, 'getFeedbackById', ctx);
    }
  }

  async getFeedbacks(
    filters: FeedbackFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Feedback>> {
    const ctx = this.createContext(context);
    this.logOperation('getFeedbacks', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);
      
      // Build where conditions
      const whereConditions = this.buildFeedbackWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const result = await feedbackRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getFeedbacks', ctx);
    }
  }

  async updateFeedback(id: string, data: FeedbackUpdateData, context?: ServiceContext): Promise<Feedback> {
    const ctx = this.createContext(context);
    this.logOperation('updateFeedback', ctx, { feedbackId: id, updates: Object.keys(data) });

    try {
      const existingFeedback = await feedbackRepository.findById(id);
      if (!existingFeedback) {
        throw new NotFoundError('Feedback', id);
      }

      // Check permissions
      await this.verifyFeedbackAccess(existingFeedback, ctx.userId!);

      // Validate updates
      this.validateFeedbackUpdateData(data);

      const updatedFeedback = await feedbackRepository.update(id, {
        ...data,
        updatedAt: new Date()
      });

      if (!updatedFeedback) {
        throw new NotFoundError('Feedback', id);
      }

      // Send notification if status changed
      if (data.status && data.status !== existingFeedback.status) {
        await this.notifyUserOfStatusChange(updatedFeedback);
      }

      await this.recordMetric('feedback.updated', 1, { 
        statusChanged: data.status !== undefined ? 'true' : 'false'
      });

      return updatedFeedback;
    } catch (error) {
      this.handleError(error, 'updateFeedback', ctx);
    }
  }

  async deleteFeedback(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteFeedback', ctx, { feedbackId: id });

    try {
      const feedback = await feedbackRepository.findById(id);
      if (!feedback) {
        throw new NotFoundError('Feedback', id);
      }

      // Check permissions - only owner or admin can delete
      if (feedback.userId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError('Only the feedback owner or admin can delete this feedback');
      }

      const success = await feedbackRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Feedback', id);
      }

      await this.recordMetric('feedback.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteFeedback', ctx);
    }
  }

  // Statistics
  async getFeedbackStats(
    filters: FeedbackFilters = {},
    context?: ServiceContext
  ): Promise<FeedbackStats> {
    const ctx = this.createContext(context);
    this.logOperation('getFeedbackStats', ctx, { filters });

    try {
      // Only admins can view global stats
      if (!filters.userId && ctx.userRole !== 'admin') {
        filters.userId = ctx.userId!;
      }

      const whereConditions = this.buildFeedbackWhereConditions(filters, ctx.userId!, ctx.userRole);
      
      const allFeedbacks = await feedbackRepository.findMany({
        where: whereConditions,
        limit: 10000
      });

      const feedbacks = allFeedbacks.data;

      // Calculate stats
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      feedbacks.forEach(feedback => {
        byType[feedback.type] = (byType[feedback.type] || 0) + 1;
        byStatus[feedback.status] = (byStatus[feedback.status] || 0) + 1;
        byPriority[feedback.priority] = (byPriority[feedback.priority] || 0) + 1;
      });

      // Calculate average resolution time
      const resolvedFeedbacks = feedbacks.filter(f => f.status === FeedbackStatus.RESOLVED && f.resolvedAt);
      let averageResolutionTime = 0;
      if (resolvedFeedbacks.length > 0) {
        const totalTime = resolvedFeedbacks.reduce((sum, feedback) => {
          const resolutionTime = feedback.resolvedAt!.getTime() - feedback.createdAt.getTime();
          return sum + resolutionTime;
        }, 0);
        averageResolutionTime = totalTime / resolvedFeedbacks.length / (1000 * 60 * 60); // Convert to hours
      }

      const stats: FeedbackStats = {
        total: feedbacks.length,
        byType,
        byStatus,
        byPriority,
        averageResolutionTime,
        satisfactionScore: 0, // Would calculate based on votes
        topContributors: await this.getTopContributors(feedbacks),
        monthlyTrends: await this.getMonthlyTrends(feedbacks)
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getFeedbackStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyFeedbackAccess(feedback: Feedback, userId: string): Promise<void> {
    // User can access feedback if they are:
    // 1. The owner
    // 2. Admin
    
    if (feedback.userId === userId) {
      return;
    }

    const user = await userRepository.findById(userId);
    if (user?.role === 'admin') {
      return;
    }

    throw new ForbiddenError('You do not have access to this feedback');
  }

  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }
    // Add workspace member check logic here
  }

  private async verifyTeamAccess(teamId: string, userId: string): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team) {
      throw new NotFoundError('Team', teamId);
    }
    // Add team member check logic here
  }

  private async verifyProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    // Add project access check logic here
  }

  private buildFeedbackWhereConditions(filters: FeedbackFilters, userId: string, userRole?: string): any {
    const conditions = [];

    // Non-admin users can only see their own feedback
    if (userRole !== 'admin' && !filters.userId) {
      conditions.push(eq(feedbackRepository['table']?.userId, userId));
    }

    if (filters.userId) {
      conditions.push(eq(feedbackRepository['table']?.userId, filters.userId));
    }

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        conditions.push(inArray(feedbackRepository['table']?.type, filters.type));
      } else {
        conditions.push(eq(feedbackRepository['table']?.type, filters.type));
      }
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(feedbackRepository['table']?.status, filters.status));
      } else {
        conditions.push(eq(feedbackRepository['table']?.status, filters.status));
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        conditions.push(inArray(feedbackRepository['table']?.priority, filters.priority));
      } else {
        conditions.push(eq(feedbackRepository['table']?.priority, filters.priority));
      }
    }

    if (filters.createdFrom) {
      conditions.push(gte(feedbackRepository['table']?.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(feedbackRepository['table']?.createdAt, filters.createdTo));
    }

    if (filters.search) {
      conditions.push(or(
        ilike(feedbackRepository['table']?.title, `%${filters.search}%`),
        ilike(feedbackRepository['table']?.description, `%${filters.search}%`)
      ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateFeedbackData(data: FeedbackCreateData): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Feedback title is required');
    }

    if (data.title.length > 200) {
      throw new ValidationError('Feedback title must be less than 200 characters');
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError('Feedback description is required');
    }

    if (data.description.length > 2000) {
      throw new ValidationError('Feedback description must be less than 2000 characters');
    }

    if (!Object.values(FeedbackType).includes(data.type)) {
      throw new ValidationError('Invalid feedback type');
    }
  }

  private validateFeedbackUpdateData(data: FeedbackUpdateData): void {
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new ValidationError('Feedback title is required');
      }
      if (data.title.length > 200) {
        throw new ValidationError('Feedback title must be less than 200 characters');
      }
    }

    if (data.description !== undefined) {
      if (!data.description || data.description.trim().length === 0) {
        throw new ValidationError('Feedback description is required');
      }
      if (data.description.length > 2000) {
        throw new ValidationError('Feedback description must be less than 2000 characters');
      }
    }

    if (data.type && !Object.values(FeedbackType).includes(data.type)) {
      throw new ValidationError('Invalid feedback type');
    }

    if (data.status && !Object.values(FeedbackStatus).includes(data.status)) {
      throw new ValidationError('Invalid feedback status');
    }

    if (data.priority && !Object.values(FeedbackPriority).includes(data.priority)) {
      throw new ValidationError('Invalid feedback priority');
    }
  }

  private async notifyAdminsOfNewFeedback(feedback: Feedback): Promise<void> {
    try {
      // Get all admin users
      const adminUsers = await userRepository.findMany({
        where: eq(userRepository['table']?.role, 'admin'),
        limit: 100
      });

      // Send notifications to all admins
      for (const admin of adminUsers.data) {
        await notificationService.createNotification({
          userId: admin.id,
          type: NotificationType.SYSTEM,
          title: 'New Feedback Submitted',
          message: `New ${feedback.type} feedback: "${feedback.title}"`,
          data: {
            feedbackId: feedback.id,
            feedbackType: feedback.type,
            priority: feedback.priority
          }
        });
      }

      // Send email notification
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@taskmanagement.com',
        subject: `New Feedback: ${feedback.title}`,
        html: `
          <h2>New Feedback Submitted</h2>
          <p><strong>Type:</strong> ${feedback.type}</p>
          <p><strong>Priority:</strong> ${feedback.priority}</p>
          <p><strong>Title:</strong> ${feedback.title}</p>
          <p><strong>Description:</strong> ${feedback.description}</p>
          <p><strong>Submitted by:</strong> User ${feedback.userId}</p>
          <p><strong>Submitted at:</strong> ${feedback.createdAt.toISOString()}</p>
        `
      });
    } catch (error) {
      console.error('Failed to notify admins of new feedback:', error);
    }
  }

  private async notifyUserOfStatusChange(feedback: Feedback): Promise<void> {
    try {
      await notificationService.createNotification({
        userId: feedback.userId,
        type: NotificationType.SYSTEM,
        title: 'Feedback Status Updated',
        message: `Your feedback "${feedback.title}" status has been updated to ${feedback.status}`,
        data: {
          feedbackId: feedback.id,
          newStatus: feedback.status,
          adminResponse: feedback.adminResponse
        }
      });

      // Send email notification
      const user = await userRepository.findById(feedback.userId);
      if (user) {
        await emailService.sendEmail({
          to: user.email,
          subject: `Feedback Status Update: ${feedback.title}`,
          html: `
            <h2>Feedback Status Update</h2>
            <p>Your feedback "${feedback.title}" has been updated.</p>
            <p><strong>New Status:</strong> ${feedback.status}</p>
            ${feedback.adminResponse ? `<p><strong>Admin Response:</strong> ${feedback.adminResponse}</p>` : ''}
            <p>Thank you for your feedback!</p>
          `
        });
      }
    } catch (error) {
      console.error('Failed to notify user of status change:', error);
    }
  }

  private async getTopContributors(feedbacks: Feedback[]): Promise<Array<{ userId: string; userName: string; feedbackCount: number }>> {
    const userCounts: Record<string, number> = {};
    
    feedbacks.forEach(feedback => {
      userCounts[feedback.userId] = (userCounts[feedback.userId] || 0) + 1;
    });

    const topContributors = [];
    const sortedEntries = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [userId, count] of sortedEntries) {
      const user = await userRepository.findById(userId);
      if (user) {
        topContributors.push({
          userId,
          userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
          feedbackCount: count
        });
      }
    }

    return topContributors;
  }

  private async getMonthlyTrends(feedbacks: Feedback[]): Promise<Array<{ month: string; count: number; resolved: number }>> {
    const monthlyData: Record<string, { count: number; resolved: number }> = {};
    
    feedbacks.forEach(feedback => {
      const month = feedback.createdAt.toISOString().substring(0, 7); // YYYY-MM format
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, resolved: 0 };
      }
      monthlyData[month].count++;
      if (feedback.status === FeedbackStatus.RESOLVED) {
        monthlyData[month].resolved++;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();
