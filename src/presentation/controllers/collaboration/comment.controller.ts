import type { Response, NextFunction } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { successResponse } from '../../../shared/utils/response-formatter';
import { commentService } from '../services/comment.service';
import type { AuthRequest } from '../../../shared/middleware/auth';
import type { Express } from 'express';
import { ValidationError } from '../../../shared/services/base.service';

/**
 * @desc    Create a new comment on a task
 * @route   POST /api/v1/tasks/:taskId/comments
 * @access  Private
 */
export const createComment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const taskId = req.params.taskId;
    const comment = await commentService.createComment(
      {
        ...req.body,
        taskId,
      },
      {
        userId,
        timestamp: new Date(),
      }
    );

    successResponse(res, 201, comment, 'Comment created successfully');
  }
);

/**
 * @desc    Get comments for a task
 * @route   GET /api/v1/tasks/:taskId/comments
 * @access  Private
 */
export const getTaskComments = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const taskId = req.params.taskId;
    const result = await commentService.getTaskComments(taskId, req.query, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, result.data, 'Comments retrieved successfully', {
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.totalPages,
      hasNext: result.pagination.hasNext,
      hasPrev: result.pagination.hasPrev,
    });
  }
);

/**
 * @desc    Get a comment by ID
 * @route   GET /api/v1/comments/:id
 * @access  Private
 */
export const getComment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    const comment = await commentService.getCommentById(commentId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, comment, 'Comment retrieved successfully');
  }
);

/**
 * @desc    Update a comment
 * @route   PUT /api/v1/comments/:id
 * @access  Private
 */
export const updateComment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    const comment = await commentService.updateComment(commentId, req.body, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, comment, 'Comment updated successfully');
  }
);

/**
 * @desc    Delete a comment
 * @route   DELETE /api/v1/comments/:id
 * @access  Private
 */
export const deleteComment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    await commentService.deleteComment(commentId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, {}, 'Comment deleted successfully');
  }
);

/**
 * @desc    Add attachment to a comment
 * @route   POST /api/v1/comments/:id/attachments
 * @access  Private
 */
export const addCommentAttachment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    const file = req.file as Express.Multer.File;

    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    const attachment = {
      filename: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
    };

    const comment = await commentService.addCommentAttachment(
      commentId,
      attachment,
      {
        userId,
        timestamp: new Date(),
      }
    );

    successResponse(res, 200, comment, 'Attachment added successfully');
  }
);

/**
 * @desc    Remove attachment from a comment
 * @route   DELETE /api/v1/comments/:id/attachments/:attachmentId
 * @access  Private
 */
export const removeCommentAttachment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    const attachmentId = req.params.attachmentId;

    const comment = await commentService.removeCommentAttachment(
      commentId,
      attachmentId,
      {
        userId,
        timestamp: new Date(),
      }
    );

    successResponse(res, 200, comment, 'Attachment removed successfully');
  }
);

/**
 * @desc    Add reaction to a comment
 * @route   POST /api/v1/comments/:id/reactions
 * @access  Private
 */
export const addCommentReaction = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      throw new ValidationError('Emoji is required');
    }

    const comment = await commentService.addReaction(commentId, emoji, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, comment, 'Reaction added successfully');
  }
);

/**
 * @desc    Remove reaction from a comment
 * @route   DELETE /api/v1/comments/:id/reactions/:emoji
 * @access  Private
 */
export const removeCommentReaction = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const commentId = req.params.id;
    const emoji = req.params.emoji;

    const comment = await commentService.removeReaction(commentId, emoji, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, comment, 'Reaction removed successfully');
  }
);

/**
 * @desc    Get comment statistics
 * @route   GET /api/v1/comments/stats
 * @access  Private
 */
export const getCommentStats = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const taskId = req.query.taskId as string;
    const projectId = req.query.projectId as string;

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;

    const stats = await commentService.getCommentStats(
      taskId,
      projectId,
      dateRange,
      {
        userId,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      200,
      stats,
      'Comment statistics retrieved successfully'
    );
  }
);

/**
 * @desc    Get all comments (with filters)
 * @route   GET /api/v1/comments
 * @access  Private
 */
export const getComments = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const result = await commentService.getComments(req.query, req.query, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, result.data, 'Comments retrieved successfully', {
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.totalPages,
      hasNext: result.pagination.hasNext,
      hasPrev: result.pagination.hasPrev,
    });
  }
);

/**
 * @desc    Get project comments
 * @route   GET /api/v1/projects/:projectId/comments
 * @access  Private
 */
export const getProjectComments = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const projectId = req.params.projectId;
    const result = await commentService.getProjectComments(
      projectId,
      req.query,
      {
        userId,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      200,
      result.data,
      'Project comments retrieved successfully',
      {
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalPages: result.pagination.totalPages,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
      }
    );
  }
);
