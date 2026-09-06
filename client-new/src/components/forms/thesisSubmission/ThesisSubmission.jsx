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
            allowRejection={false}
          ></Recommendation>
          <Recommendation
            formData={formData}
            role="phd_coordinator"
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
          role="adordc"
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
  export default ThesisSubmission;
  