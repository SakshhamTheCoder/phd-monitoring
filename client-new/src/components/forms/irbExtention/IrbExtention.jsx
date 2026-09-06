import React, { useEffect, useState } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Recommendation from "../layouts/Recommendation";
import Student from "./roles/Student";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";



const IrbExtention=({formData}) => {
    return (
      <>
        <FormTitleBar formName={"Extension for Submission of Research Proposal"} formData={formData} />
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
            role="dordc"
            allowRejection={false}
          ></Recommendation>
           <Recommendation
            formData={formData}
            role="director"
            allowRejection={false}
          ></Recommendation>
          </RoleBasedWrapper>
        </div>
      </>
    );
  };
  export default IrbExtention;
  