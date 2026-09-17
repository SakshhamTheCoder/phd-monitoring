import React, { useState, useEffect, useRef } from "react";
import "./ProfileBox.css";
import { generateAvatar } from "../../utils/profileImage";
import CustomModal from "../forms/modal/CustomModal";
import SwitchRole from "../switchRole/SwitchRole";
import ChangePassword from "./ChangePassword";
import { getRoleName } from "../../utils/roleName";
import { logoutAPI } from "../../api/login";
import { toast } from "react-toastify";
const ProfileBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const profileRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user")) || {};

  const name =
    user && user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : "Name";
  const [role, setRole] = useState(getRoleName(localStorage.getItem("userRole")) || "Role");

  useEffect(() => {
    const onRoleChange = () =>
      setRole(getRoleName(localStorage.getItem("userRole")) || "Role");
    window.addEventListener("rolechange", onRoleChange);
    return () => window.removeEventListener("rolechange", onRoleChange);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const image = user.profile_image
    ? user.profile_image
    : generateAvatar(user.first_name, user.last_name);

  const toggleProfileMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event) => {
    if (profileRef.current && !profileRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="profile_wrapper" ref={profileRef}>
      <button
        type="button"
        className="user_section"
        onClick={toggleProfileMenu}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <img
          src={image || ""}
          alt=""
          aria-hidden="true"
          className="user_profile_image"
        />
        <div className="user_info">
          <span className="user_name">{name}</span>
          <span className="user_role">{role}</span>
        </div>
      </button>

      {isOpen && (
        <div className="profile_box">
          <div className="profile_header">
            <h3>User Menu</h3>
          </div>
          <div className="profile_content">
            {/* "Profile" was a placeholder that only raised an alert. Home is
                where each role's profile already is, one click away in the sidebar. */}
            {/* Single-role accounts have nothing to switch to. */}
            {!["Student", "UG Student"].includes(role) && (
              <button type="button" className="profile_item" onClick={() => { handleOpenModal(); setIsOpen(false); }}>
                <h4>Switch Role</h4>
              </button>
            )}
            <button type="button" className="profile_item" onClick={() => setPasswordOpen(true)}>
              <h4>{user.password_set === false ? "Set Password" : "Change Password"}</h4>
            </button>
            <button type="button" className="profile_item" onClick={() => {
              logoutAPI();
              toast.success("Logged out");
              window.location.href = "/login";
            }}>
              <h4>Logout</h4>
            </button>
          </div>
        </div>
      )}

      {/* Outside the menu: a click inside a dialog is outside the menu, which
          closed the menu and took the dialog with it. */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        minWidth="400px"
        maxWidth="500px"
        minHeight="200px"
        maxHeight="400px"
      >
        <SwitchRole/>
      </CustomModal>

      <CustomModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        minWidth="400px"
        maxWidth="520px"
      >
        <ChangePassword onDone={() => { setPasswordOpen(false); setIsOpen(false); }} />
      </CustomModal>
    </div>
  );
};

export default ProfileBox;
