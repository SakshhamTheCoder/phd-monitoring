import React from "react";
import "../../components/dashboard/layout.css";
import "../../components/navbar/NavBar.css";
import "../../components/topbar/TopBar.css";
import "../../components/routebar/RouteBar.css";
import "./ExternalReview.css";

// Portal shell for the external (no-login) review page: the same Thapar-logo sidebar and
// two-tier topbar (heading + branded right block + breadcrumb strip) a normal user sees, but
// with NO nav links and no profile/bell — the outside expert must not get any navigation into
// the rest of the app.
const ExternalLayout = ({ heading = "Outside Expert Review", children }) => (
  <div className="layout">
    <div className="sidebar">
      <div className="side-left-menu">
        <div className="tietlogo">
          <img src="/images/tiet_logo.png" alt="Thapar Institute" />
        </div>
      </div>
    </div>
    <div className="main-content">
      <header className="topbar">
        <div className="topbar_sub">
          <h2>{heading}</h2>
          <div className="topbar_right">
            <div className="xr-brand">
              <span className="user_name">PhD Monitoring Portal</span>
              <span className="user_role">Thapar Institute of Engineering &amp; Technology</span>
            </div>
          </div>
        </div>
        <nav className="route-bar">
          <ul>
            <li>Review the submission below and record your recommendation</li>
          </ul>
        </nav>
      </header>
      <div className="content">{children}</div>
    </div>
  </div>
);

export default ExternalLayout;
