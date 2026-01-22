import { User } from "../../../models/User.js";
import { Notification } from "../../../models/Notification.js";

/**
 * Notifications Controller
 * Handles user notification operations
 */

/**
 * Get unread notifications for the authenticated user
 */
export const unreadNotifications = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          association: "notifications",
          where: { is_read: false },
          required: false,
          include: ["role"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const ret = user.notifications?.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      created_at: notification.created_at,
      role: notification.role?.role,
    }));

    return res.json(ret || []);
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * Mark a specific notification as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = await Notification.findOne({
      where: {
        id: id,
        user_id: user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.is_read = true;
    await notification.save();

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read for the authenticated user
 */
export const markAllAsRead = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await Notification.update(
      { is_read: true },
      {
        where: {
          user_id: user.id,
          is_read: false,
        },
      }
    );

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * Delete a specific notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = await Notification.findOne({
      where: {
        id: id,
        user_id: user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await notification.destroy();

    return res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};

/**
 * Get all notifications for the authenticated user
 */
export const allNotifications = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          association: "notifications",
          include: ["role"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const ret = user.notifications?.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      is_read: notification.is_read,
      created_at: notification.created_at,
      role: notification.role?.role,
    }));

    return res.json(ret || []);
  } catch (error) {
    console.error("Error fetching all notifications:", error);
    return res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
};
