import React, { useEffect, useState } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Recommendation from "../layouts/Recommendation";
import Supervisor from "./roles/Supervisor";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";


const SynopsisSubmission=({formData}) => {
    console.log(formData);
    return (
      <>
        <FormTitleBar formName={"Synopsis Submission"} formData={formData} />
        <div className="form-container">
          <RoleBasedWrapper
            roleHierarchy={formData.steps}
            currentRole={formData.role}
            >
          <Student formData={formData}/>
          <Supervisor formData={formData}/>
           <Recommendation
            formData={formData}
            role="doctoral"
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
          <Recommendation
            formData={formData}
            role="director"
          ></Recommendation>
          </RoleBasedWrapper>
        </div>
      </>
    );
  };
  export default SynopsisSubmission;
  