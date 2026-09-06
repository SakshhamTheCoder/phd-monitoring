import React from "react";
import { useNavigate } from "react-router-dom";
import "./AdminHome.css";
import { getRoleName } from "../../utils/roleName";
import GridContainer from "../forms/fields/GridContainer";
import CustomButton from "../forms/fields/CustomButton";

// Quick links, shown per role. Mirrors the sidebar's role gating so the
// buttons never point somewhere the user can't actually go.
const LINKS = [
  { path: "/students", label: "Students",
    roles: ["hod", "phd_coordinator", "faculty", "dordc", "adordc", "dra", "director", "doctoral", "external", "admin"] },
  { path: "/faculty", label: "Faculty",
    roles: ["hod", "phd_coordinator", "dordc", "adordc", "dra", "director", "admin"] },
  { path: "/departments", label: "Departments",
    roles: ["dordc", "adordc", "dra", "director", "admin"] },
  { path: "/forms", label: "Forms",
    roles: ["hod", "phd_coordinator", "faculty", "dordc", "adordc", "dra", "director", "doctoral", "external", "admin"] },
  { path: "/presentation", label: "Presentations",
    roles: ["hod", "phd_coordinator", "faculty", "dordc", "adordc", "dra", "director", "doctoral", "admin"] },
  { path: "/courses", label: "Courses",
    roles: ["hod", "phd_coordinator", "admin"] },
  { path: "/users", label: "Manage Users",
    roles: ["admin"] },
  { path: "/areasOfSpecialization", label: "Areas of Specialization",
    roles: ["admin"] },
  { path: "/outside-experts", label: "Outside Experts",
    roles: ["admin"] },
  { path: "/logs", label: "Activity Logs",
    roles: ["admin"] },
  { path: "/attendance", label: "Mark Attendance",
    roles: ["clerk"] },
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
  const d = data || {}; // data can be null (default params only cover undefined)
  const role = d.role || localStorage.getItem("userRole") || "admin";
  const name = d.name || storedName() || "there";
  const tiles = LINKS.filter((l) => l.roles.includes(role));

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
