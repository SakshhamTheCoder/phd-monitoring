import React, { useEffect, useState, useCallback } from "react";
import { APIlistAllNotifications, APImarkNotificationAsRead } from "../../api/notifications";
import "./AllNotificationsPage.css";
import Layout from "../dashboard/layout";
import { timeAgo } from "../../utils/timeParse";
import { toast } from "react-toastify";
import { getRoleName } from "../../utils/roleName";

const AllNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(() => {
    APIlistAllNotifications((data) => {
      setNotifications(data);
      setLoading(false);
    });
  }, []);

  // Fetch on mount and whenever the active role changes (no page reload needed).
  useEffect(() => {
    fetchNotifications();
    const onRoleChange = () => {
      setLoading(true);
      fetchNotifications();
    };
    window.addEventListener("rolechange", onRoleChange);
    return () => window.removeEventListener("rolechange", onRoleChange);
  }, [fetchNotifications]);

  const openNotification = (notification) => {
    const role = localStorage.getItem("userRole");
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
    <Layout>
      <div className="all-notifications-page">
        <div className="notification-page-head">
          <h1 className="page-title">Notifications</h1>
          {unreadCount > 0 && (
            <span className="notification-unread-pill">{unreadCount} unread</span>
          )}
        </div>

        {loading ? (
          <p className="notification-muted">Loading…</p>
        ) : notifications.length === 0 ? (
          <div className="notification-empty-page">
            <p>No notifications yet</p>
            <span>Anything that needs your attention in this role will show up here.</span>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <div
                className={`notification-card ${notification.is_read ? "is-read" : "is-unread"}`}
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                <div className="notification-card-main">
                  <div className="notification-card-titlerow">
                    {!notification.is_read && <span className="notification-dot" />}
                    <span className="notification-title">{notification.title}</span>
                  </div>
                  <div className="notification-body">{notification.body}</div>
                </div>
                <span className="notif-date">{timeAgo(notification.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AllNotificationsPage;
