import React from "react";
import { Link } from "react-router-dom";
import "../../components/dashboard/layout.css";
import "../../components/navbar/NavBar.css";
import "../../components/topbar/TopBar.css";
import "../../components/routebar/RouteBar.css";
import "./ExternalReview.css";

// Portal shell for pages with no login: the same sidebar, topbar and breadcrumb
// a signed-in user sees, but with no nav links, no bell and no profile. The page
// owns its own heading, exactly as it does inside the portal.
const ExternalLayout = ({ crumbs = [], children }) => (
  <div className="layout">
    <div className="sidebar">
      <div className="side-left-menu">
        <div className="tietlogo">
          <img src="/images/tiet_logo.png" alt="Thapar Institute" />
        </div>
        <div className="xr-sidebar-foot">
          <Link to="/login">Portal sign in</Link>
        </div>
      </div>
    </div>
    <div className="main-content">
      <header className="topbar">
        <div className="topbar_sub">
          <nav className="route-bar" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((crumb, i) => (
                <li key={crumb.to || crumb.label}>
                  {i > 0 && <span className="route-sep" aria-hidden="true">/</span>}
                  {crumb.to && i < crumbs.length - 1
                    ? <Link to={crumb.to}>{crumb.label}</Link>
                    : <span aria-current="page">{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <div className="topbar_right">
            <div className="xr-brand">
              <span className="user_name">PhD Monitoring Portal</span>
              <span className="user_role">Thapar Institute of Engineering &amp; Technology</span>
            </div>
          </div>
        </div>
      </header>
      <div className="content">{children}</div>
    </div>
  </div>
);

export default ExternalLayout;
