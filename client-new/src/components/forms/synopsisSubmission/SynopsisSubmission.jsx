import React from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import PhDCoordinator from "./roles/PhDCoordinator";
import FormLadder from "../formLadder/FormLadder";

const SynopsisSubmission = ({ formData }) => {
  return (
    <>
      <FormTitleBar formName={"Synopsis Submission"} formData={formData} />
      {formData?.round >= 2 && (
        <p className="form-note">
          The written synopsis has been approved. This round confirms the viva,
          and starts with the PhD Coordinator uploading its minutes.
        </p>
      )}
      <div className="form-container">
        <FormLadder
          formData={formData}
          panels={{
            student: Student,
            faculty: Supervisor,
            phd_coordinator: PhDCoordinator,
          }}
        />
      </div>
    </>
  );
};
export default SynopsisSubmission;
