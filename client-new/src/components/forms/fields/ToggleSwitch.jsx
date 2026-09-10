import React from "react";
import "./ToggleSwitch.css";

/**
 * A switch, not a styled div: keyboard users need to reach and flip it, and
 * a screen reader needs to hear its on/off state. Every caller gets that
 * from the element itself rather than repeating the wiring.
 */
const ToggleSwitch = ({ isOn, onToggle, label = "", disabled = false }) => {
  return (
    <div className="toggle-container">
      {label && <span>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={!!isOn}
        aria-label={label || undefined}
        disabled={disabled}
        className={`toggle-switch ${isOn ? "on" : "off"}`}
        onClick={onToggle}
      >
        <span className="toggle-handle" />
      </button>
    </div>
  );
};

export default ToggleSwitch;
