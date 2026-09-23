import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import "./NotificationBox.css";
import { APIlistUnreadNotifications, APImarkNotificationAsRead, APImarkAllNotificationsAsRead } from "../../api/notifications";
import { toast } from "react-toastify";
import { getRoleName } from "../../utils/roleName";
import { timeAgo } from "../../utils/timeParse";
import { currentRole } from '../../auth/access';
import LoadError from "../common/LoadError";
import usePresence from '../../hooks/usePresence';

const NotificationBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  // Held open for the closing fade.
  const menu = usePresence(isOpen, 100);
  const notificationRef = useRef(null);
  const toggleRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  // An empty list after a failed load is not "all caught up".
  const [loadFailed, setLoadFailed] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const { success, response } = await APIlistUnreadNotifications();
    if (success) setNotifications(response);
    setLoadFailed(!success);
  }, []);

  // The shell no longer remounts per page, which is what used to refresh the
  // badge. Asking again on each navigation keeps it current, e.g. after items
  // are read on the notifications page.
  const { pathname } = useLocation();
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications, pathname]);

  const toggleNotifications = () => {
    if (!isOpen) fetchNotifications(); // always show the latest when opening
    setIsOpen((prev) => !prev);
  };

  const handleClickOutside = (event) => {
    if (notificationRef.current && !notificationRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const onNotificationClick = (notification) => {
    const role = currentRole();
    if (notification && notification.link) {
      if (role !== notification.role) {
        toast.warn("Switch to the " + getRoleName(notification.role) + " role to open this notification");
        return;
      }
      APImarkNotificationAsRead(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      window.open(notification.link, "_blank");
    }
  };

  const isRead = (n) => n.is_read;
  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  const handleMarkAllAsRead = async (event) => {
    event.stopPropagation();
    if (unreadCount === 0) return;
    const result = await APImarkAllNotificationsAsRead();
    if (result && result.success) {
      // Keep them listed in the dropdown, just mark them read (dots vanish).
      // Marked on the items themselves, so the next refetch cannot bring the
      // badge back while it is in flight.
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } else {
      toast.error("Couldn't mark notifications as read");
    }
  };

  return (
    <div className="notification_wrapper" ref={notificationRef}>
      <button
        type="button"
        ref={toggleRef}
        className="notification_icon"
        onClick={toggleNotifications}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <img src="/icons/notifications.svg" alt="" aria-hidden="true" className="notif_icon" />
        {unreadCount > 0 && (
          <span className="notification_badge" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
      {menu.mounted && (
        <div className={`notification_box${menu.closing ? ' is-closing' : ''}`}>
          <div className="notification_header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <div className="notification_header_actions">
                <span className="badge badge--accent">{unreadCount} new</span>
                <button
                  type="button"
                  className="notification_mark_all"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
          <div className="notification_content">
            {notifications.length === 0 ? (
              loadFailed ? (
                <LoadError
                  message="Could not load your notifications. Check your connection and try again."
                  onRetry={fetchNotifications}
                />
              ) : (
                <div className="notification_empty">
                  <p>You're all caught up.</p>
                </div>
              )
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  className={`notification_item ${isRead(notification) ? "is_read" : ""}`}
                  key={notification.id}
                  onClick={() => onNotificationClick(notification)}
                >
                  <span className={`notification_unread_dot ${isRead(notification) ? "hidden_dot" : ""}`} />
                  <span className="notification_item_text">
                    <span className="notification_item_title">{notification.title}</span>
                    <span className="notification_item_body">{notification.body}</span>
                    <span className="notification_time">{timeAgo(notification.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="notification_footer">
            <Link to="/notifications" className="see_all" onClick={() => setIsOpen(false)}>See all</Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBox;
