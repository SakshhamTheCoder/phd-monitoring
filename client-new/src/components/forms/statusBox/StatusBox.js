import React from "react";
import StepTimeline from "../timeline/Timeline";
import HistoryTimeline from "../history/HistoryTimeline";
import "./StatusBox.css";

const StatusBox = ({formData}) => {
  return (
    <>
      <h1 className="modal-title">Form Status</h1>
      <div className="status-box-container">
        <div className="status-box-container-box first">
          <h2>History</h2>
          <HistoryTimeline formData={formData} />
        </div>
        <div className="status-box-container-box">
          <h2>Steps</h2>
          <StepTimeline formData={formData} />
        </div>
      </div>
    </>
  );
};
export default StatusBox;
