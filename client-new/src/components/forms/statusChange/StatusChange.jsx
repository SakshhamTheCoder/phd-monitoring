import React, { useEffect, useState } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Student from "./roles/Student";
import FormLadder from "../formLadder/FormLadder";



const StatusChange=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Application for Status Change"} formData={formData} />
        <div className="form-container">
          <FormLadder
            formData={formData}
            panels={{ student: Student }}
          />
        </div>
      </>
    );
  };
  export default StatusChange;
  