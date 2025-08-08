import type { Response, NextFunction } from 'express';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { successResponse } from '../../../shared/utils/response-formatter';
import { notificationService } from '../services/notification.service';
import type { AuthRequest } from '../../../shared/middleware/auth';

/**
 * @desc    Get all notifications for the authenticated user
 * @route   GET /api/v1/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const result = await notificationService.getNotifications(
      req.query,
      req.query,
      {
        userId,
        timestamp: new Date(),
      }
    );

    // Get unread count for additional metadata
    const stats = await notificationService.getNotificationStats(userId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(
      res,
      200,
      result.data,
      'Notifications retrieved successfully',
      {
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalPages: result.pagination.totalPages,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
        unreadCount: stats.unread,
      }
    );
  }
);

/**
 * @desc    Get a notification by ID
 * @route   GET /api/v1/notifications/:id
 * @access  Private
 */
export const getNotificationById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const notificationId = req.params.id;
    const notification = await notificationService.getNotificationById(
      notificationId,
      {
        userId,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      200,
      notification,
      'Notification retrieved successfully'
    );
  }
);

/**
 * @desc    Mark a notification as read
 * @route   PATCH /api/v1/notifications/:id/read
 * @access  Private
 */
export const markNotificationAsRead = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const notificationId = req.params.id;
    const notification = await notificationService.markAsRead(notificationId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, notification, 'Notification marked as read');
  }
);

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/v1/notifications/read-all
 * @access  Private
 */
export const markAllNotificationsAsRead = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const result = await notificationService.markAllAsRead(userId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, result, 'All notifications marked as read');
  }
);

/**
 * @desc    Delete a notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private
 */
export const deleteNotification = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const notificationId = req.params.id;
    await notificationService.deleteNotification(notificationId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(res, 200, {}, 'Notification deleted successfully');
  }
);

/**
 * @desc    Get notification statistics
 * @route   GET /api/v1/notifications/stats
 * @access  Private
 */
export const getNotificationStats = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const stats = await notificationService.getNotificationStats(userId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(
      res,
      200,
      stats,
      'Notification statistics retrieved successfully'
    );
  }
);

/**
 * @desc    Create a notification (Admin only)
 * @route   POST /api/v1/notifications
 * @access  Private (Admin only)
 */
export const createNotification = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    // Only allow admins to manually create notifications
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can manually create notifications',
      });
    }

    const notification = await notificationService.createNotification(
      req.body,
      {
        userId,
        userRole,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      201,
      notification,
      'Notification created successfully'
    );
  }
);

/**
 * @desc    Create a system notification for a user (Admin only)
 * @route   POST /api/v1/notifications/system
 * @access  Private (Admin only)
 */
export const createSystemNotification = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const userRole = req.user?.role as string;

    // Only allow admins to create system notifications
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create system notifications',
      });
    }

    const { targetUserId, title, message, data } = req.body;
    const notification = await notificationService.createSystemNotification(
      targetUserId,
      title,
      message,
      data || {},
      {
        userId,
        userRole,
        timestamp: new Date(),
      }
    );

    successResponse(
      res,
      201,
      notification,
      'System notification created successfully'
    );
  }
);

/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
export const getUnreadNotificationCount = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;
    const stats = await notificationService.getNotificationStats(userId, {
      userId,
      timestamp: new Date(),
    });

    successResponse(
      res,
      200,
      { count: stats.unread },
      'Unread notification count retrieved successfully'
    );
  }
);
