import React, { useState, useEffect, useRef, useCallback } from "react";
import "./NotificationBox.css";
import { APIlistUnreadNotifications, APImarkNotificationAsRead } from "../../api/notifications";
import { toast } from "react-toastify";
import { getRoleName } from "../../utils/roleName";
import { timeAgo } from "../../utils/timeParse";

const NotificationBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(() => {
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

  const count = notifications.length;

  return (
    <div className="notification_wrapper" ref={notificationRef}>
      <div className="notification_icon" onClick={toggleNotifications}>
        <img src="/icons/notifications.svg" alt="Notifications" className="notif_icon" />
        {count > 0 && (
          <div className="notification_badge">{count > 9 ? "9+" : count}</div>
        )}
      </div>
      {isOpen && (
        <div className="notification_box">
          <div className="notification_header">
            <span>Notifications</span>
            {count > 0 && <span className="notification_count">{count} new</span>}
          </div>
          <div className="notification_content">
            {count === 0 ? (
              <div className="notification_empty">
                <p>You're all caught up.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  className="notification_item"
                  key={notification.id}
                  onClick={() => onNotificationClick(notification)}
                >
                  <span className="notification_unread_dot" />
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
