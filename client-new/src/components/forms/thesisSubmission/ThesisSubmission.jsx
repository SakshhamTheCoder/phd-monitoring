import React, { useEffect, useState } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Recommendation from "../layouts/Recommendation";
import Supervisor from "./roles/Supervisor";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";


const ThesisSubmission=({formData}) => {
    console.log(formData);
    return (
      <>
        <FormTitleBar formName={"Thesis Submission"} formData={formData} />
        <div className="form-container">
           <RoleBasedWrapper
            roleHierarchy={formData.steps}
            currentRole={formData.role}
            > 
          <Student formData={formData}/>
          <Recommendation
            formData={formData}
            role="supervisor"
          ></Recommendation>
          <Recommendation
            formData={formData}
            role="phd_coordinator"
          ></Recommendation>
          <Recommendation
            formData={formData}
            role="hod"
          ></Recommendation>
          <Recommendation
            formData={formData}
            role="dra"
          ></Recommendation>
             <Recommendation
          formData={formData}
          role="adordc"
        ></Recommendation>
          <Recommendation
            formData={formData}
            role="dordc"
          ></Recommendation>
          </RoleBasedWrapper>
        </div>
      </>
    );
  };
  export default ThesisSubmission;
  