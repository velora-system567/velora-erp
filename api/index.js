import { Request, Response } from 'express';
import { getNotifications, createNotification, markAsRead, deleteNotification, countUnreadNotifications } from './notifications.service';

export const notificationsController = {
  async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const notifications = await getNotifications(userId);
      res.status(200).json({ data: notifications });
    } catch (error) {
      console.error('Error getting notifications', error);
      res.status(500).json({ message: 'Failed to get notifications' });
    }
  },

  async createNotification(req: Request, res: Response) {
    try {
      const { title, content, type, userId } = req.body;
      const notification = await createNotification(title, content, type, userId);
      res.status(201).json({ data: notification });
    } catch (error) {
      console.error('Error creating notification', error);
      res.status(400).json({ message: 'Failed to create notification' });
    }
  },

  async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await markAsRead(id);
      res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Error marking notification as read', error);
      res.status(400).json({ message: 'Failed to mark notification as read' });
    }
  },

  async deleteNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await deleteNotification(id);
      res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Error deleting notification', error);
      res.status(400).json({ message: 'Failed to delete notification' });
    }
  },

  async countUnreadNotifications(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const unreadCount = await countUnreadNotifications(userId);
      res.status(200).json({ data: { unreadCount } });
    } catch (error) {
      console.error('Error counting unread notifications', error);
      res.status(500).json({ message: 'Failed to count unread notifications' });
    }
  },
};
