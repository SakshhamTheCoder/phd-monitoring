// src/api/notifications.js

import { baseURL } from "./urls";
import { customFetch } from "./base";

// The list helpers hand back customFetch's { success, response }, newest first,
// so a caller can tell a failed load from an empty list.

// Unread notifications, for the bell. Silent: it loads on every page, and a
// toast on each one would bury the page's own messages.
export const APIlistUnreadNotifications = async () => {
  const result = await customFetch(baseURL + "/notifications/unread", "GET", null, false);
  if (result.success) result.response.reverse();
  return result;
};

// Mark a specific notification as read
export const APImarkNotificationAsRead = (notificationId) =>
  customFetch(baseURL + "/notifications/mark-as-read/" + notificationId, "PUT", null, false);

// Mark ALL notifications as read (dropdown "Mark all as read" action)
export const APImarkAllNotificationsAsRead = () =>
  customFetch(baseURL + "/notifications/mark-all-as-read", "PUT", null, false);

// Every notification, for the full page. A failure toasts, since the page has
// nothing else to show.
export const APIlistAllNotifications = async () => {
  const result = await customFetch(baseURL + "/notifications", "GET", null);
  if (result.success) result.response.reverse();
  return result;
};
