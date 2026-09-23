import React, { useEffect, useState, useCallback } from "react";
import { APIlistAllNotifications, APImarkNotificationAsRead } from "../../api/notifications";
import "./AllNotificationsPage.css";
import { timeAgo } from "../../utils/timeParse";
import { toast } from "react-toastify";
import { getRoleName } from "../../utils/roleName";
import { currentRole } from '../../auth/access';
import LoadError from "../common/LoadError";
import StatusNotice from "../common/StatusNotice";
import Page from "../page/Page";
import Panel from "../panel/Panel";

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
    <Page
      title="Notifications"
      meta={unreadCount > 0 && <span className="badge badge--accent">{unreadCount} unread</span>}
    >
      {status === "loading" ? (
        <Panel><StatusNotice tone="loading" title="Loading notifications" /></Panel>
      ) : status === "failed" ? (
        <LoadError
          message="Could not load your notifications. Check your connection and try again."
          onRetry={() => {
            setStatus("loading");
            fetchNotifications();
          }}
        />
      ) : notifications.length === 0 ? (
        <StatusNotice tone="empty" title="No notifications yet">
          Anything that needs your attention in this role will show up here.
        </StatusNotice>
      ) : (
        <Panel flush>
          <ul className="notification-list reveal">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className={`notification-row ${notification.is_read ? "is-read" : "is-unread"}`}
                  onClick={() => openNotification(notification)}
                >
                  <span className="notification-row-main">
                    <span className="notification-row-titleline">
                      {!notification.is_read && <span className="notification-dot" aria-hidden="true" />}
                      {!notification.is_read && <span className="sr-only">Unread: </span>}
                      <span className="notification-title">{notification.title}</span>
                    </span>
                    <span className="notification-body">{notification.body}</span>
                  </span>
                  <span className="notif-date">{timeAgo(notification.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </Page>
  );
};

export default AllNotificationsPage;
