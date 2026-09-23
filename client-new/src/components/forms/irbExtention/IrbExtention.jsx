import React, { useEffect, useState } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Student from "./roles/Student";
import FormLadder from "../formLadder/FormLadder";



const IrbExtention=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Extension for submission of research proposal"} formData={formData} />
        <div className="form-container">
          <FormLadder
            formData={formData}
            panels={{ student: Student }}
          />
        </div>
      </>
    );
  };
  export default IrbExtention;
  