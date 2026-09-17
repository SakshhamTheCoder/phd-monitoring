import React, { useState, useEffect } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import PhDCoordinator from "./roles/PhDCoordinator";
import FormLadder from "../formLadder/FormLadder";

const SupervisorAllocation = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="Supervisor Allocation" formData={formData} />
      <div className="form-container">
        <FormLadder
          formData={formData}
          panels={{ student: Student, phd_coordinator: PhDCoordinator }}
        />
      </div>
    </>
  );
};

export default SupervisorAllocation;
