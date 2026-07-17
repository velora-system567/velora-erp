import { notificationService } from './notifications.service';

export const getNotifications = async (req, res) => {
  const userId = req.user.id; // Assume we have authenticated and set the user in the request object
  try {
    const notifications = await notificationService.getNotifications(userId);
    res.status(200).json({ data: notifications });
  } catch (error) {
    // Handle error, return appropriate status code and message
    console.log('Error getting notifications', error);
    res.status(500).json({ message: 'Failed to get notifications' });
  }
};
