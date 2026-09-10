import React from "react";
import { useNavigate } from "react-router-dom";
import "./AdminHome.css";
import { getRoleName } from "../../utils/roleName";
import { buttonConfig } from "../navbar/CustomNavBar";
import { useFeatures } from "../../context/FeaturesContext";
import GridContainer from "../forms/fields/GridContainer";
import CustomButton from "../forms/fields/CustomButton";

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
  { path: "/attendance", label: "Mark Attendance" },
  { path: "/supervisor-doctoral-approvals", label: "Supervisor Approvals" },
  { path: "/clerks", label: "Clerks" },
  { path: "/configuration", label: "Configuration" },
  { path: "/users", label: "Manage Users" },
  { path: "/areasOfSpecialization", label: "Areas of Specialization" },
  { path: "/outside-experts", label: "Outside Experts" },
  { path: "/logs", label: "Activity Logs" },
  { path: "/forms/manage", label: "Manage Forms", roles: ["admin"] },
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
  const navigate = useNavigate();
  const features = useFeatures();
  const d = data || {}; // data can be null (default params only cover undefined)
  const role = d.role || localStorage.getItem("userRole") || "admin";
  const name = d.name || storedName() || "there";
  const tiles = LINKS.filter((l) => {
    const roles = l.roles || NAV_BY_PATH[l.path]?.roles || [];
    const feature = NAV_BY_PATH[l.path]?.feature;
    return roles.includes(role) && (!feature || features[feature]);
  });

  return (
    <div className="adminhome-container">
      <h2>Welcome back, {name}</h2>
      <p className="adminhome-sub">
        Signed in as {getRoleName(role)}. Jump straight to what you manage.
      </p>

      <GridContainer
        label="Quick Access"
        elements={tiles.map((t) => (
          <CustomButton text={t.label} onClick={() => navigate(t.path)} />
        ))}
      />
    </div>
  );
};

export default AdminHome;
