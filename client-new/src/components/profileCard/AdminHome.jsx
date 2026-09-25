import React from "react";
import { Link } from "react-router-dom";
import "./AdminHome.css";
import { getRoleName } from "../../utils/roleName";
import { useAccess } from "../../context/CapabilitiesContext";
import Page from "../page/Page";
import Panel from "../panel/Panel";
import { currentRole } from '../../auth/access';

const storedName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user")) || {};
    return (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "").trim();
  } catch {
    return "";
  }
};

const AdminHome = ({ data }) => {
  // The quick links for this role, from the server (config/navigation.php),
  // gated like the sidebar entries they follow.
  const { tiles } = useAccess();
  const d = data || {}; // data can be null (default params only cover undefined)
  const role = d.role || currentRole() || "admin";
  const name = d.name || storedName() || "there";

  return (
    <Page
      title={`Welcome back, ${name}`}
      description={`Signed in as ${getRoleName(role)}. Jump straight to what you manage.`}
    >
      <Panel title="Quick access">
        <ul className="adminhome-tiles">
          {tiles.map((t) => (
            <li key={t.path}>
              <Link to={t.path} className="adminhome-tile">
                <span className="adminhome-tile-icon" aria-hidden="true">
                  <i className={`fa fa-${t.icon}`} />
                </span>
                <span className="adminhome-tile-label">{t.label}</span>
                <i className="fa fa-angle-right adminhome-tile-go" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
};

export default AdminHome;
