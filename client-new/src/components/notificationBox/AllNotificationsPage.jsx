import React, { useEffect, useState, useCallback } from "react";
import { APIlistAllNotifications, APImarkNotificationAsRead } from "../../api/notifications";
import "./AllNotificationsPage.css";
import { timeAgo } from "../../utils/timeParse";
import { toast } from "react-toastify";
import { getRoleName } from "../../utils/roleName";
import { currentRole } from '../../auth/access';
import LoadError from "../common/LoadError";

const AllNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  // Saying "No notifications yet" after a failed load would be untrue, so a
  // failure says so in place of the list and offers another try.
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "failed"

  const fetchNotifications = useCallback(async () => {
    const { success, response } = await APIlistAllNotifications();
    // After a role switch the old role's list must not linger in the unread count.
    setNotifications(success ? response : []);
    setStatus(success ? "ready" : "failed");
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const openNotification = (notification) => {
    const role = currentRole();
    if (!notification.link) return;
    if (role !== notification.role) {
      toast.warn("Switch to the " + getRoleName(notification.role) + " role to open this notification");
      return;
    }
    if (!notification.is_read) {
      APImarkNotificationAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }
    window.open(notification.link, "_blank");
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="all-notifications-page">
      <div className="notification-page-head">
        <h1 className="page-title">Notifications</h1>
        {unreadCount > 0 && (
          <span className="notification-unread-pill">{unreadCount} unread</span>
        )}
      </div>

      {status === "loading" ? (
        <p className="notification-muted">Loading…</p>
      ) : status === "failed" ? (
        <LoadError
          message="Could not load your notifications. Check your connection and try again."
          onRetry={() => {
            setStatus("loading");
            fetchNotifications();
          }}
        />
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          No notifications yet. Anything that needs your attention in this role
          will show up here.
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              type="button"
              className={`notification-card ${notification.is_read ? "is-read" : "is-unread"}`}
              key={notification.id}
              onClick={() => openNotification(notification)}
            >
              <span className="notification-card-main">
                <span className="notification-card-titlerow">
                  {!notification.is_read && <span className="notification-dot" />}
                  <span className="notification-title">{notification.title}</span>
                </span>
                <span className="notification-body">{notification.body}</span>
              </span>
              <span className="notif-date">{timeAgo(notification.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllNotificationsPage;
