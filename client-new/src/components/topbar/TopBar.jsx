import React from "react";
import RouteBar from "../routebar/RouteBar";
import NotificationBox from "../notificationBox/NotificationBox";
import "./TopBar.css";
import ProfileBox from "../profileBox/ProfileBox";

// One thin row: where you are on the left, who you are on the right. The page
// itself owns its heading, so the topbar no longer prints a second one.
const TopBar = () => (
  <div className="topbar_sub">
    <RouteBar />
    <div className="topbar_right">
      <NotificationBox />
      <ProfileBox />
    </div>
  </div>
);

export default TopBar;
