import React, { useState, useEffect } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
// import Supervisor from "./roles/Supervisor";
import Recommendation from "../layouts/Recommendation";
// import Dordc from "./roles/Dordc";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";

const ReviseTitle = ({ formData }) => {
  return (
    <>
      <FormTitleBar formName="Revise Title or Objectives" formData={formData} />
      <div className="form-container">
        <Student formData={formData}></Student>
        <RoleBasedWrapper
          roleHierarchy={formData.steps}
          currentRole={formData.role}
        >
          {/* <Supervisor formData={formData}></Supervisor> */}
          <Recommendation
            formData={formData}
            role="supervisor"
            allowRejection={false}
          ></Recommendation>

          <Recommendation
            formData={formData}
            role="hod"
            allowRejection={false}
          ></Recommendation>

          <Recommendation
            formData={formData}
            role="dra"
            allowRejection={false}
          ></Recommendation>
          <Recommendation
            formData={formData}
            role="dordc"
            allowRejection={false}
          ></Recommendation>
        </RoleBasedWrapper>
      </div>
    </>
  );
};

export default ReviseTitle;
