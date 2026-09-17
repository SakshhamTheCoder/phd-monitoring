import React, { useState, useEffect } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Student from "./roles/Student";
import Supervisor from "./roles/Supervisor";
import Hod from "./roles/Hod";
import Dordc from "./roles/Dordc";
import FormLadder from "../formLadder/FormLadder";
const ConstituteOfIRB = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="CONSTITUTE OF INSTITUTE RESEARCH BOARD" formData={formData} />
      <div className="form-container">
        
      <FormLadder
        formData={formData}
        panels={{ student: Student, faculty: Supervisor, hod: Hod, dordc: Dordc }}
      />
      </div>
    </>
  );
};

export default ConstituteOfIRB;
