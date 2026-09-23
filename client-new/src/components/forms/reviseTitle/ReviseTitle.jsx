import React from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";

// revise-title is routed to routes/base/synopsis_submission.php, so it is served
// by SynopsisSubmissionController and carries that controller's chain, which
// begins at 'student'. The student panel therefore belongs inside the ladder;
// rendering it outside left the 'student' step with no panel of its own and it
// fell through to a plain Recommendation, which asked the scholar to recommend
// their own application.
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
