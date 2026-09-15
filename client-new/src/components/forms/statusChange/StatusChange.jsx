import React, { useEffect, useState } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Recommendation from "../layouts/Recommendation";
import Student from "./roles/Student";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";



const StatusChange=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Application for Status Change"} formData={formData} />
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
  export default StatusChange;
  