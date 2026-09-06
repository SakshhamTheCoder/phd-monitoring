import React, { useState, useEffect } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Student from "./roles/Student";
import Supervisor from "./roles/Supervisor";
import Hod from "./roles/Hod";
import Dordc from "./roles/Dordc";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";
import Recommendation from "../layouts/Recommendation";
const ConstituteOfIRB = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="CONSTITUTE OF INSTITUTE RESEARCH BOARD" formData={formData} />
      <div className="form-container">
        
      <RoleBasedWrapper 
      roleHierarchy={formData.steps}
      currentRole={formData.role}>
        <Student formData={formData} ></Student>
        <Supervisor formData={formData} />
        <Hod formData={formData} />
         <Recommendation
          formData={formData}
          role="adordc"
          allowRejection={false}
        ></Recommendation>
        <Dordc formData={formData} />
        </RoleBasedWrapper>
      </div>
    </>
  );
};

export default ConstituteOfIRB;
