// src/controllers/job-notification.controller.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { JobNotificationService } from '../services/job-notification.service';

export class JobNotificationController {
  private notificationService: JobNotificationService;

  constructor() {
    this.notificationService = new JobNotificationService();
  }

  /**
   * Get notifications for user (both employer and jobseeker)
   */
  getNotifications = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 10, read } = req.query;

      console.log('🔔 Getting notifications for user:', userId);

      const params = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        read: (() => {
          if (read === undefined) return undefined;
          if (Array.isArray(read)) return String(read[0]) === 'true';
          return String(read) === 'true';
        })()
      };

      const result = await this.notificationService.getNotifications(userId, params);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      next(error);
    }
  };

  /**
   * Mark notification as read
   */
  markNotificationRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      if (!notificationId) {
        res.status(400).json({
          success: false,
          message: 'Notification ID is required'
        });
        return;
      }

      console.log('✅ Marking notification as read:', notificationId);

      // @ts-ignore
      await this.notificationService.markNotificationRead(notificationId, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      next(error);
    }
  };

  /**
   * Mark all notifications as read for user
   */
  markAllNotificationsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;

      console.log('✅ Marking all notifications as read for user:', userId);

      await this.notificationService.markAllNotificationsRead(userId);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      next(error);
    }
  };

  /**
   * Delete notification
   */
  deleteNotification = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      if (!notificationId) {
        res.status(400).json({
          success: false,
          message: 'Notification ID is required'
        });
        return;
      }

      console.log('🗑️ Deleting notification:', notificationId);

      // @ts-ignore
      await this.notificationService.deleteNotification(notificationId, userId);

      res.status(200).json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      next(error);
    }
  };

  /**
   * Get unread notification count
   */
  getUnreadCount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;

      const result = await this.notificationService.getNotifications(userId, { 
        read: false, 
        page: 1, 
        limit: 1000 // Get all unread
      });

      const unreadCount = result.notifications.length;

      res.status(200).json({
        success: true,
        data: {
          unread_count: unreadCount
        }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      next(error);
    }
  };
}
