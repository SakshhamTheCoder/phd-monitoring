import React, { useEffect, useState } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Student from "./roles/Student";
import FormLadder from "../formLadder/FormLadder";



const SemesterOff=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Application for Semester Off"} formData={formData} />
        <div className="form-container">
          <FormLadder
            formData={formData}
            panels={{ student: Student }}
          />
        </div>
      </>
    );
  };
  export default SemesterOff;
  