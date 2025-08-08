import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  ilike,
  isNull,
  isNotNull,
  gte,
  lte,
  inArray,
} from 'drizzle-orm';
import {
  BaseService,
  ServiceContext,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from './base.service';
import { commentRepository } from '../repositories/comment.repository';
import {
  userRepository,
  taskRepository,
  projectRepository,
  notificationRepository,
} from '../../../infrastructure/database/drizzle/repositories';
import { Comment, NewComment } from '../schemas/comments';
import {
  PaginationOptions,
  PaginatedResult,
} from '../../../infrastructure/database/drizzle/repositories/base/interfaces';
import { notificationService, NotificationType } from './notification.service';
import { activityService } from './activity.service';

export interface CommentFilters {
  taskId?: string;
  userId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  search?: string;
}

export interface CommentCreateData {
  content: string;
  taskId: string;
  parentId?: string;
  mentions?: string[];
  attachments?: Array<{
    filename: string;
    url: string;
    size: number;
    mimeType: string;
  }>;
}

export interface CommentUpdateData {
  content?: string;
  mentions?: string[];
  attachments?: Array<{
    filename: string;
    url: string;
    size: number;
    mimeType: string;
  }>;
}

export interface CommentStats {
  totalComments: number;
  commentsThisWeek: number;
  commentsThisMonth: number;
  topCommenters: Array<{
    userId: string;
    userName: string;
    commentCount: number;
  }>;
  averageCommentsPerTask: number;
  mostCommentedTasks: Array<{
    taskId: string;
    taskTitle: string;
    commentCount: number;
  }>;
}

export interface MentionData {
  userId: string;
  userName: string;
  position: number;
  length: number;
}

export class CommentService extends BaseService {
  constructor() {
    super('CommentService', {
      enableCache: true,
      cacheTimeout: 180, // 3 minutes cache for comments
      enableAudit: true,
      enableMetrics: true,
    });
  }

  // Core CRUD Operations
  async createComment(
    data: CommentCreateData,
    context?: ServiceContext
  ): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('createComment', ctx, {
      content: data.content.substring(0, 100),
      taskId: data.taskId,
      mentionCount: data.mentions?.length || 0,
    });

    try {
      // Validate input
      this.validateCommentData(data);

      // Verify task access
      await this.verifyTaskAccess(data.taskId, ctx.userId!);

      // Verify parent comment exists if specified
      if (data.parentId) {
        await this.verifyParentComment(data.parentId, data.taskId);
      }

      // Extract and validate mentions
      const mentions = await this.processMentions(data.content, data.mentions);

      // Create comment
      const newComment: NewComment = {
        content: data.content,
        authorId: ctx.userId!,
        taskId: data.taskId!,
        parentId: data.parentId,
        mentions: mentions.map(m => m.userId),
        attachments: data.attachments || [],
      };

      const comment = await commentRepository.create(newComment);

      // Send notifications to mentioned users
      if (mentions.length > 0) {
        await this.sendMentionNotifications(comment, mentions, ctx.userId!);
      }

      // Send notification to task/project owner if different from commenter
      await this.sendOwnerNotification(comment, ctx.userId!);

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_commented',
          taskId: data.taskId,
          data: {
            action: 'comment_created',
            commentId: comment.id,
            contentPreview: data.content.substring(0, 100),
            mentionCount: mentions.length,
            hasAttachments: (data.attachments?.length || 0) > 0,
          },
          metadata: {
            commentId: comment.id,
          },
        },
        ctx
      );

      await this.recordMetric('comment.created', 1, {
        hasTaskId: data.taskId ? 'true' : 'false',
        hasMentions: mentions.length > 0 ? 'true' : 'false',
        hasAttachments: (data.attachments?.length || 0) > 0 ? 'true' : 'false',
        isReply: data.parentId ? 'true' : 'false',
      });

      return comment;
    } catch (error) {
      this.handleError(error, 'createComment', ctx);
    }
  }

  async getCommentById(id: string, context?: ServiceContext): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('getCommentById', ctx, { commentId: id });

    try {
      const comment = await commentRepository.findById(id);
      if (!comment) {
        throw new NotFoundError('Comment', id);
      }

      // Check access permissions
      await this.verifyCommentAccess(comment, ctx.userId!);

      return comment;
    } catch (error) {
      this.handleError(error, 'getCommentById', ctx);
    }
  }

  async getComments(
    filters: CommentFilters = {},
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Comment>> {
    const ctx = this.createContext(context);
    this.logOperation('getComments', ctx, { filters, options });

    try {
      const paginationOptions = this.validatePagination(options);

      // Build where conditions
      const whereConditions = this.buildCommentWhereConditions(
        filters,
        ctx.userId!
      );

      const result = await commentRepository.findMany({
        ...paginationOptions,
        where: whereConditions,
        sortBy: 'createdAt',
        sortOrder: 'desc', // Most recent first
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getComments', ctx);
    }
  }

  async getTaskComments(
    taskId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Comment>> {
    const ctx = this.createContext(context);
    this.logOperation('getTaskComments', ctx, { taskId, options });

    try {
      // Verify task access
      await this.verifyTaskAccess(taskId, ctx.userId!);

      const paginationOptions = this.validatePagination(options);

      const result = await commentRepository.findMany({
        ...paginationOptions,
        where: eq(commentRepository['table']?.taskId, taskId),
        sortBy: 'createdAt',
        sortOrder: 'asc', // Chronological order for task comments
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getTaskComments', ctx);
    }
  }

  async getProjectComments(
    projectId: string,
    options: PaginationOptions = {},
    context?: ServiceContext
  ): Promise<PaginatedResult<Comment>> {
    const ctx = this.createContext(context);
    this.logOperation('getProjectComments', ctx, { projectId, options });

    try {
      // Verify project access
      await this.verifyProjectAccess(projectId, ctx.userId!);

      const paginationOptions = this.validatePagination(options);

      // Get all tasks in the project first
      const tasks = await taskRepository.findMany({
        where: eq(taskRepository['table']?.projectId, projectId),
        limit: 10000,
      });

      const taskIds = tasks.data.map(task => task.id);

      if (taskIds.length === 0) {
        return {
          data: [],
          pagination: {
            page: paginationOptions.page,
            limit: paginationOptions.limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      const result = await commentRepository.findMany({
        ...paginationOptions,
        where: inArray(commentRepository['table']?.taskId, taskIds),
        sortBy: 'createdAt',
        sortOrder: 'desc', // Most recent first for project comments
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getProjectComments', ctx);
    }
  }

  async updateComment(
    id: string,
    data: CommentUpdateData,
    context?: ServiceContext
  ): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('updateComment', ctx, {
      commentId: id,
      updates: Object.keys(data),
    });

    try {
      const existingComment = await commentRepository.findById(id);
      if (!existingComment) {
        throw new NotFoundError('Comment', id);
      }

      // Check permissions - only author can update
      if (existingComment.authorId !== ctx.userId) {
        throw new ForbiddenError(
          'Only the comment author can update this comment'
        );
      }

      // Validate updates
      this.validateCommentUpdateData(data);

      // Process mentions if content is being updated
      let mentions: MentionData[] = [];
      if (data.content) {
        mentions = await this.processMentions(data.content, data.mentions);
      }

      // Track changes for notifications
      const isContentChanged = data.content !== undefined;
      const previousMentions = (existingComment.mentions as string[]) || [];
      const newMentions = mentions.map(m => m.userId);
      const addedMentions = newMentions.filter(
        id => !previousMentions.includes(id)
      );

      const updatedComment = await commentRepository.update(id, {
        content: data.content,
        mentions: data.content ? newMentions : undefined,
        attachments: data.attachments,
        isEdited: isContentChanged,
        editedAt: isContentChanged ? new Date() : undefined,
        updatedAt: new Date(),
      });

      if (!updatedComment) {
        throw new NotFoundError('Comment', id);
      }

      // Send notifications to newly mentioned users
      if (addedMentions.length > 0) {
        const newMentionData = mentions.filter(m =>
          addedMentions.includes(m.userId)
        );
        await this.sendMentionNotifications(
          updatedComment,
          newMentionData,
          ctx.userId!
        );
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_commented',
          taskId: updatedComment.taskId,
          data: {
            action: 'comment_updated',
            commentId: updatedComment.id,
            contentChanged: isContentChanged,
            newMentions: addedMentions.length,
          },
          metadata: {
            commentId: updatedComment.id,
          },
        },
        ctx
      );

      await this.recordMetric('comment.updated', 1, {
        contentChanged: isContentChanged ? 'true' : 'false',
        newMentions: addedMentions.length.toString(),
      });

      return updatedComment;
    } catch (error) {
      this.handleError(error, 'updateComment', ctx);
    }
  }

  async deleteComment(id: string, context?: ServiceContext): Promise<void> {
    const ctx = this.createContext(context);
    this.logOperation('deleteComment', ctx, { commentId: id });

    try {
      const comment = await commentRepository.findById(id);
      if (!comment) {
        throw new NotFoundError('Comment', id);
      }

      // Check permissions - only author or admin can delete
      if (comment.authorId !== ctx.userId && ctx.userRole !== 'admin') {
        throw new ForbiddenError(
          'Only the comment author or admin can delete this comment'
        );
      }

      const success = await commentRepository.delete(id);
      if (!success) {
        throw new NotFoundError('Comment', id);
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_commented',
          taskId: comment.taskId,
          data: {
            action: 'comment_deleted',
            commentId: id,
            contentPreview: comment.content.substring(0, 100),
          },
          metadata: {
            commentId: id,
          },
        },
        ctx
      );

      await this.recordMetric('comment.deleted', 1);
    } catch (error) {
      this.handleError(error, 'deleteComment', ctx);
    }
  }

  // Reaction Management
  async addReaction(
    commentId: string,
    emoji: string,
    context?: ServiceContext
  ): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('addReaction', ctx, { commentId, emoji });

    try {
      const comment = await commentRepository.findById(commentId);
      if (!comment) {
        throw new NotFoundError('Comment', commentId);
      }

      // Check access permissions
      await this.verifyCommentAccess(comment, ctx.userId!);

      // Update reactions
      const reactions = (comment.reactions as Record<string, string[]>) || {};
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      // Add user to reaction if not already present
      if (!reactions[emoji].includes(ctx.userId!)) {
        reactions[emoji].push(ctx.userId!);
      }

      const updatedComment = await commentRepository.update(commentId, {
        reactions,
        updatedAt: new Date(),
      });

      if (!updatedComment) {
        throw new NotFoundError('Comment', commentId);
      }

      await this.recordMetric('comment.reaction.added', 1, { emoji });

      return updatedComment;
    } catch (error) {
      this.handleError(error, 'addReaction', ctx);
    }
  }

  async removeReaction(
    commentId: string,
    emoji: string,
    context?: ServiceContext
  ): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('removeReaction', ctx, { commentId, emoji });

    try {
      const comment = await commentRepository.findById(commentId);
      if (!comment) {
        throw new NotFoundError('Comment', commentId);
      }

      // Check access permissions
      await this.verifyCommentAccess(comment, ctx.userId!);

      // Update reactions
      const reactions = (comment.reactions as Record<string, string[]>) || {};
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(
          userId => userId !== ctx.userId
        );
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }

      const updatedComment = await commentRepository.update(commentId, {
        reactions,
        updatedAt: new Date(),
      });

      if (!updatedComment) {
        throw new NotFoundError('Comment', commentId);
      }

      await this.recordMetric('comment.reaction.removed', 1, { emoji });

      return updatedComment;
    } catch (error) {
      this.handleError(error, 'removeReaction', ctx);
    }
  }

  // Attachment Management
  async addCommentAttachment(
    commentId: string,
    attachmentData: {
      filename: string;
      path: string;
      mimetype: string;
      size: number;
    },
    context?: ServiceContext
  ): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('addCommentAttachment', ctx, {
      commentId,
      filename: attachmentData.filename,
    });

    try {
      // Validate comment exists and user has access
      const comment = await this.getCommentById(commentId, ctx);

      // Validate attachment data
      this.validateAttachmentData(attachmentData);

      // Create attachment object with unique ID
      const attachment = {
        id: this.generateAttachmentId(),
        filename: attachmentData.filename,
        path: attachmentData.path,
        mimetype: attachmentData.mimetype,
        size: attachmentData.size,
        uploadedAt: new Date(),
        uploadedBy: ctx.userId!,
      };

      // Get existing attachments and add new one
      const existingAttachments = (comment.attachments as any[]) || [];
      const updatedAttachments = [...existingAttachments, attachment];

      // Update comment with new attachment
      const updatedComment = await commentRepository.update(commentId, {
        attachments: updatedAttachments,
        updatedAt: new Date(),
      });

      if (!updatedComment) {
        throw new NotFoundError('Comment', commentId);
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_commented',
          taskId: comment.taskId,
          data: {
            action: 'attachment_added',
            commentId,
            filename: attachmentData.filename,
            fileSize: attachmentData.size,
          },
          metadata: {
            commentId,
            attachmentId: attachment.id,
          },
        },
        ctx
      );

      await this.recordMetric('comment.attachment.added', 1, {
        fileType: attachmentData.mimetype.split('/')[0],
        fileSize: this.getFileSizeCategory(attachmentData.size),
      });

      return updatedComment;
    } catch (error) {
      this.handleError(error, 'addCommentAttachment', ctx);
    }
  }

  async removeCommentAttachment(
    commentId: string,
    attachmentId: string,
    context?: ServiceContext
  ): Promise<Comment> {
    const ctx = this.createContext(context);
    this.logOperation('removeCommentAttachment', ctx, {
      commentId,
      attachmentId,
    });

    try {
      // Validate comment exists and user has access
      const comment = await this.getCommentById(commentId, ctx);

      // Get existing attachments
      const existingAttachments = (comment.attachments as any[]) || [];

      // Find the attachment to remove
      const attachmentIndex = existingAttachments.findIndex(
        att => att.id === attachmentId
      );
      if (attachmentIndex === -1) {
        throw new NotFoundError('Attachment', attachmentId);
      }

      const attachmentToRemove = existingAttachments[attachmentIndex];

      // Check permissions - only comment author or attachment uploader can remove
      if (
        comment.authorId !== ctx.userId &&
        attachmentToRemove.uploadedBy !== ctx.userId &&
        ctx.userRole !== 'admin'
      ) {
        throw new ForbiddenError(
          'Only the comment author, attachment uploader, or admin can remove this attachment'
        );
      }

      // Remove attachment from array
      const updatedAttachments = existingAttachments.filter(
        att => att.id !== attachmentId
      );

      // Update comment
      const updatedComment = await commentRepository.update(commentId, {
        attachments: updatedAttachments,
        updatedAt: new Date(),
      });

      if (!updatedComment) {
        throw new NotFoundError('Comment', commentId);
      }

      // Log activity
      await activityService.createActivity(
        {
          userId: ctx.userId!,
          type: 'task_commented',
          taskId: comment.taskId,
          data: {
            action: 'attachment_removed',
            commentId,
            filename: attachmentToRemove.filename,
          },
          metadata: {
            commentId,
            attachmentId,
          },
        },
        ctx
      );

      await this.recordMetric('comment.attachment.removed', 1);

      return updatedComment;
    } catch (error) {
      this.handleError(error, 'removeCommentAttachment', ctx);
    }
  }

  // Statistics
  async getCommentStats(
    taskId?: string,
    projectId?: string,
    dateRange?: { startDate: Date; endDate: Date },
    context?: ServiceContext
  ): Promise<CommentStats> {
    const ctx = this.createContext(context);
    this.logOperation('getCommentStats', ctx, { taskId, projectId, dateRange });

    try {
      // Set default date range (last 30 days)
      const range = dateRange || {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      };

      // Build query conditions
      const conditions = [];

      if (taskId) {
        await this.verifyTaskAccess(taskId, ctx.userId!);
        conditions.push(eq(commentRepository['table']?.taskId, taskId));
      }

      conditions.push(
        gte(commentRepository['table']?.createdAt, range.startDate)
      );
      conditions.push(
        lte(commentRepository['table']?.createdAt, range.endDate)
      );

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get all comments for analysis
      const allComments = await commentRepository.findMany({
        where: whereClause,
        limit: 10000, // Large limit for comprehensive stats
      });

      const comments = allComments.data;
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate statistics
      const stats: CommentStats = {
        totalComments: comments.length,
        commentsThisWeek: comments.filter(
          c => new Date(c.createdAt) >= oneWeekAgo
        ).length,
        commentsThisMonth: comments.filter(
          c => new Date(c.createdAt) >= oneMonthAgo
        ).length,
        topCommenters: await this.getTopCommenters(comments),
        averageCommentsPerTask:
          await this.calculateAverageCommentsPerTask(comments),
        mostCommentedTasks: await this.getMostCommentedTasks(comments),
      };

      return stats;
    } catch (error) {
      this.handleError(error, 'getCommentStats', ctx);
    }
  }

  // Private Helper Methods
  private async verifyCommentAccess(
    comment: Comment,
    userId: string
  ): Promise<void> {
    // User can access comment if they have access to the task
    await this.verifyTaskAccess(comment.taskId, userId);
  }

  private async verifyTaskAccess(
    taskId: string,
    userId: string
  ): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    // Add task access check logic here
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    // Add project access check logic here
  }

  private async verifyParentComment(
    parentId: string,
    taskId?: string,
    projectId?: string
  ): Promise<void> {
    const parentComment = await commentRepository.findById(parentId);
    if (!parentComment) {
      throw new NotFoundError('Parent Comment', parentId);
    }

    // Verify parent comment belongs to the same task/project
    if (taskId && parentComment.taskId !== taskId) {
      throw new ValidationError('Parent comment must belong to the same task');
    }
  }

  private buildCommentWhereConditions(
    filters: CommentFilters,
    userId: string
  ): any {
    const conditions = [];

    if (filters.taskId) {
      conditions.push(eq(commentRepository['table']?.taskId, filters.taskId));
    }

    if (filters.userId) {
      conditions.push(eq(commentRepository['table']?.authorId, filters.userId));
    }

    if (filters.createdFrom) {
      conditions.push(
        gte(commentRepository['table']?.createdAt, filters.createdFrom)
      );
    }

    if (filters.createdTo) {
      conditions.push(
        lte(commentRepository['table']?.createdAt, filters.createdTo)
      );
    }

    if (filters.search) {
      conditions.push(
        ilike(commentRepository['table']?.content, `%${filters.search}%`)
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private validateCommentData(data: CommentCreateData): void {
    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError('Comment content is required');
    }

    if (data.content.length > 2000) {
      throw new ValidationError(
        'Comment content must be less than 2000 characters'
      );
    }

    if (!data.taskId) {
      throw new ValidationError('taskId must be provided');
    }
  }

  private validateCommentUpdateData(data: CommentUpdateData): void {
    if (data.content !== undefined) {
      if (!data.content || data.content.trim().length === 0) {
        throw new ValidationError('Comment content is required');
      }
      if (data.content.length > 2000) {
        throw new ValidationError(
          'Comment content must be less than 2000 characters'
        );
      }
    }
  }

  private async processMentions(
    content: string,
    explicitMentions?: string[]
  ): Promise<MentionData[]> {
    const mentions: MentionData[] = [];

    // Extract @username mentions from content
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      const position = match.index;
      const length = match[0].length;

      // Find user by username
      const user = await userRepository.findByUsername(username);
      if (user) {
        mentions.push({
          userId: user.id,
          userName: username,
          position,
          length,
        });
      }
    }

    // Add explicit mentions if provided
    if (explicitMentions) {
      for (const userId of explicitMentions) {
        if (!mentions.some(m => m.userId === userId)) {
          const user = await userRepository.findById(userId);
          if (user) {
            mentions.push({
              userId: user.id,
              userName: user.username || user.email,
              position: -1, // Explicit mention, not in content
              length: 0,
            });
          }
        }
      }
    }

    return mentions;
  }

  private async sendMentionNotifications(
    comment: Comment,
    mentions: MentionData[],
    authorId: string
  ): Promise<void> {
    for (const mention of mentions) {
      // Don't notify the author
      if (mention.userId === authorId) continue;

      try {
        await notificationService.createNotification({
          userId: mention.userId,
          type: NotificationType.TASK_COMMENTED,
          title: 'You were mentioned in a comment',
          message: `You were mentioned in a comment: "${comment.content.substring(0, 100)}..."`,
          data: {
            commentId: comment.id,
            taskId: comment.taskId,
            authorId,
          },
        });
      } catch (error) {
        console.error(
          `Failed to send mention notification to ${mention.userId}:`,
          error
        );
      }
    }
  }

  private async sendOwnerNotification(
    comment: Comment,
    authorId: string
  ): Promise<void> {
    try {
      const task = await taskRepository.findById(comment.taskId);
      if (!task) return;

      // Notify task assignee if different from commenter
      if (task.assigneeId && task.assigneeId !== authorId) {
        await notificationService.createNotification({
          userId: task.assigneeId,
          type: NotificationType.TASK_COMMENTED,
          title: 'New comment on your task',
          message: `Someone commented on your task: "${comment.content.substring(0, 100)}..."`,
          data: {
            commentId: comment.id,
            taskId: comment.taskId,
            authorId,
          },
        });
      }
    } catch (error) {
      console.error('Failed to send owner notification:', error);
    }
  }

  private async getTopCommenters(
    comments: Comment[]
  ): Promise<
    Array<{ userId: string; userName: string; commentCount: number }>
  > {
    const commentCounts: Record<string, number> = {};

    comments.forEach(comment => {
      commentCounts[comment.authorId] =
        (commentCounts[comment.authorId] || 0) + 1;
    });

    const topCommenters = [];
    const sortedEntries = Object.entries(commentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [userId, count] of sortedEntries) {
      const user = await userRepository.findById(userId);
      if (user) {
        topCommenters.push({
          userId,
          userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
          commentCount: count,
        });
      }
    }

    return topCommenters;
  }

  private async calculateAverageCommentsPerTask(
    comments: Comment[]
  ): Promise<number> {
    const taskIds = [...new Set(comments.map(c => c.taskId))];
    return taskIds.length > 0 ? comments.length / taskIds.length : 0;
  }

  private async getMostCommentedTasks(
    comments: Comment[]
  ): Promise<
    Array<{ taskId: string; taskTitle: string; commentCount: number }>
  > {
    const taskCommentCounts: Record<string, number> = {};

    comments.forEach(comment => {
      taskCommentCounts[comment.taskId] =
        (taskCommentCounts[comment.taskId] || 0) + 1;
    });

    const mostCommented = [];
    const sortedEntries = Object.entries(taskCommentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [taskId, count] of sortedEntries) {
      const task = await taskRepository.findById(taskId);
      if (task) {
        mostCommented.push({
          taskId,
          taskTitle: task.title,
          commentCount: count,
        });
      }
    }

    return mostCommented;
  }

  // Attachment Helper Methods
  private validateAttachmentData(attachmentData: {
    filename: string;
    path: string;
    mimetype: string;
    size: number;
  }): void {
    if (
      !attachmentData.filename ||
      attachmentData.filename.trim().length === 0
    ) {
      throw new ValidationError('Attachment filename is required');
    }

    if (!attachmentData.path || attachmentData.path.trim().length === 0) {
      throw new ValidationError('Attachment path is required');
    }

    if (
      !attachmentData.mimetype ||
      attachmentData.mimetype.trim().length === 0
    ) {
      throw new ValidationError('Attachment mimetype is required');
    }

    if (!attachmentData.size || attachmentData.size <= 0) {
      throw new ValidationError('Attachment size must be greater than 0');
    }

    // File size limit (50MB)
    const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes
    if (attachmentData.size > maxFileSize) {
      throw new ValidationError('Attachment size cannot exceed 50MB');
    }

    // Validate filename length
    if (attachmentData.filename.length > 255) {
      throw new ValidationError(
        'Attachment filename cannot exceed 255 characters'
      );
    }

    // Basic security check for filename
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(attachmentData.filename)) {
      throw new ValidationError(
        'Attachment filename contains invalid characters'
      );
    }
  }

  private generateAttachmentId(): string {
    // Generate a unique ID for the attachment
    // Using timestamp + random string for uniqueness
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `att_${timestamp}_${randomStr}`;
  }

  private getFileSizeCategory(size: number): string {
    if (size < 1024) {
      return 'bytes';
    } else if (size < 1024 * 1024) {
      return 'kb';
    } else if (size < 1024 * 1024 * 1024) {
      return 'mb';
    } else {
      return 'gb';
    }
  }
}

// Export singleton instance
export const commentService = new CommentService();
