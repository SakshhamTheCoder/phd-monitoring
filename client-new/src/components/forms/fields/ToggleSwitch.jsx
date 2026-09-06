// src/components/forms/fields/ToggleSwitch.js
import React from "react";
import "./ToggleSwitch.css";

const ToggleSwitch = ({ isOn, onToggle, label = "" }) => {
  return (
    <div className="toggle-container">
      {label && <span>{label}</span>}
      <div className={`toggle-switch ${isOn ? "on" : "off"}`} onClick={onToggle}>
        <div className="toggle-handle" />
      </div>
    </div>
  );
};

export default ToggleSwitch;
