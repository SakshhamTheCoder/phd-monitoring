import React from "react";
import { Link } from "react-router-dom";
import "./AdminHome.css";
import { getRoleName } from "../../utils/roleName";
import { buttonConfig } from "../navbar/CustomNavBar";
import { useFeatures } from "../../context/FeaturesContext";
import { useCapabilities } from "../../context/CapabilitiesContext";
import Page from "../page/Page";
import Panel from "../panel/Panel";
import { currentRole } from '../../auth/access';

// Path -> sidebar entry, so a tile's role and feature-flag gating come from
// the sidebar itself instead of a second list that can drift out of sync.
const NAV_BY_PATH = buttonConfig.reduce((map, item) => {
  map[item.path] = item;
  return map;
}, {});

// Quick links, shown per role. This is the curated subset of the sidebar worth
// a tile on the home page, with AdminHome's own labels. Roles and feature flags
// come from the sidebar (NAV_BY_PATH) unless overridden below.
//
// /forms/manage is the one path not in the sidebar nav at all: it's reached
// from a student's profile rather than a menu link, so its roles are set here
// to match the admin-only route gate in App.jsx.
const LINKS = [
  { path: "/students", label: "Students" },
  { path: "/faculty", label: "Faculty" },
  { path: "/departments", label: "Departments" },
  { path: "/forms", label: "Forms" },
  { path: "/presentation", label: "Presentations" },
  { path: "/courses", label: "Courses" },
  { path: "/projects", label: "Projects" },
  { path: "/urf", label: "URF" },
  { path: "/publications", label: "Publications" },
  { path: "/attendance", label: "Mark attendance" },
  { path: "/supervisor-doctoral-approvals", label: "Supervisor approvals" },
  { path: "/clerks", label: "Clerks" },
  { path: "/configuration", label: "Configuration" },
  { path: "/users", label: "Manage users" },
  { path: "/areasOfSpecialization", label: "Areas of specialization" },
  { path: "/outside-experts", label: "Outside experts" },
  { path: "/logs", label: "Activity logs" },
  { path: "/forms/manage", label: "Manage forms", roles: ["admin"], icon: "fa fa-pencil-square-o" },
];

const storedName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user")) || {};
    return (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "").trim();
  } catch {
    return "";
  }
};

const AdminHome = ({ data }) => {
  const features = useFeatures();
  const can = useCapabilities();
  const d = data || {}; // data can be null (default params only cover undefined)
  const role = d.role || currentRole() || "admin";
  const name = d.name || storedName() || "there";
  const tiles = LINKS.filter((l) => {
    const roles = l.roles || NAV_BY_PATH[l.path]?.roles || [];
    const feature = NAV_BY_PATH[l.path]?.feature;
    // Same capability rule as the sidebar: a tile the server would refuse
    // (URF for faculty who mentor nothing) is not offered.
    const capability = NAV_BY_PATH[l.path]?.capability;
    const holds = !capability || (Array.isArray(capability) ? capability.some(can) : can(capability));
    return roles.includes(role) && (!feature || features[feature]) && holds;
  });

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
                  <i className={t.icon || NAV_BY_PATH[t.path]?.icon || "fa fa-arrow-right"} />
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
