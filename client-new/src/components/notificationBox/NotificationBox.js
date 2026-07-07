import React, { useState, useEffect, useRef, useCallback } from "react";
import "./NotificationBox.css";
import { APIlistUnreadNotifications, APImarkNotificationAsRead, APImarkAllNotificationsAsRead } from "../../api/notifications";
import { toast } from "react-toastify";
import { getRoleName } from "../../utils/roleName";
import { timeAgo } from "../../utils/timeParse";

const NotificationBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [allRead, setAllRead] = useState(false);

  const fetchNotifications = useCallback(() => {
    setAllRead(false);
    APIlistUnreadNotifications(setNotifications);
  }, []);

  // Fetch on mount, and re-fetch whenever the active role changes so the bell
  // reflects the role the user just switched to — without reloading the page.
  useEffect(() => {
    fetchNotifications();
    window.addEventListener("rolechange", fetchNotifications);
    return () => window.removeEventListener("rolechange", fetchNotifications);
  }, [fetchNotifications]);

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

  const onNotificationClick = (notification) => {
    const role = localStorage.getItem("userRole");
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

  const isRead = (n) => allRead || n.is_read;
  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  const handleMarkAllAsRead = async (event) => {
    event.stopPropagation();
    if (unreadCount === 0) return;
    const result = await APImarkAllNotificationsAsRead();
    if (result && result.success) {
      // Keep them listed in the dropdown, just mark them read (dots vanish).
      setAllRead(true);
      toast.success("All notifications marked as read");
    } else {
      toast.error("Couldn't mark notifications as read");
    }
  };

  return (
    <div className="notification_wrapper" ref={notificationRef}>
      <div className="notification_icon" onClick={toggleNotifications}>
        <img src="/icons/notifications.svg" alt="Notifications" className="notif_icon" />
        {unreadCount > 0 && (
          <div className="notification_badge">{unreadCount > 9 ? "9+" : unreadCount}</div>
        )}
      </div>
      {isOpen && (
        <div className="notification_box">
          <div className="notification_header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <div className="notification_header_actions">
                <span className="notification_count">{unreadCount} new</span>
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
              <div className="notification_empty">
                <p>You're all caught up.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  className={`notification_item ${isRead(notification) ? "is_read" : ""}`}
                  key={notification.id}
                  onClick={() => onNotificationClick(notification)}
                >
                  <span className={`notification_unread_dot ${isRead(notification) ? "hidden_dot" : ""}`} />
                  <div className="notification_item_text">
                    <h4>{notification.title}</h4>
                    <p>{notification.body}</p>
                    <span className="notification_time">{timeAgo(notification.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="notification_footer">
            <a href="/notifications" className="see_all">See all</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBox;
