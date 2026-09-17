import React from "react";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";
import Student from "./roles/Student";

// Thesis Extension used to render the Thesis Submission form, which shares none
// of its columns: the scholar was shown four fields that do not exist on this
// form and none of the three that do. The reason was never collected, and a
// second extension could not be submitted at all, because the API requires the
// previous grant's PDF and nothing rendered an upload for it.
//
// Only the scholar's step needs a panel of its own. Every approver above it
// answers with a plain recommendation, which FormLadder supplies.
const ThesisExtention = ({ formData }) => {
  return (
    <>
      <FormTitleBar formName="Extension for Submission of Thesis" formData={formData} />
      <div className="form-container">
        <FormLadder formData={formData} panels={{ student: Student }} />
      </div>
    </>
  );
};

export default ThesisExtention;
