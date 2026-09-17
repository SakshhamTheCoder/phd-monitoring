import React, { useEffect, useState } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import FormLadder from "../formLadder/FormLadder";


const SynopsisSubmission=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Synopsis Submission"} formData={formData} />
        <div className="form-container">
          <FormLadder
            formData={formData}
            panels={{ student: Student, faculty: Supervisor }}
          />
        </div>
      </>
    );
  };
  export default SynopsisSubmission;
  