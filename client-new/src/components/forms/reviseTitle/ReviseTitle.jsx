import React from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";

// Served by ReviseTitleController. Every step after the scholar's is a plain
// recommendation, so only the student panel is mapped.
const ReviseTitle = ({ formData }) => {
  return (
    <>
      <FormTitleBar formName="Revise title or objectives" formData={formData} />
      <div className="form-container">
        <FormLadder
          formData={formData}
          panels={{ student: Student }}
        />
      </div>
    </>
  );
};

export default ReviseTitle;
