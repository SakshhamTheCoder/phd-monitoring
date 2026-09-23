import React, { useEffect, useState } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";


const ThesisSubmission=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Thesis submission"} formData={formData} />
        <div className="form-container">
           <FormLadder
             formData={formData}
             panels={{ student: Student }}
           />
        </div>
      </>
    );
  };
  export default ThesisSubmission;
  