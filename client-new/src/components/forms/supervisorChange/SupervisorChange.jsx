import React, { useState, useEffect } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import PhDCoordinator from "./roles/PhDCoordinator";
import './SupervisorChange.css'
import FormLadder from "../formLadder/FormLadder";

const SupervisorChange = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="Supervisor Change" formData={formData} />
      <div className="form-container">
        <FormLadder
          formData={formData}
          panels={{ student: Student, phd_coordinator: PhDCoordinator }}
        />
      </div>
    </>
  );
};

export default SupervisorChange;
