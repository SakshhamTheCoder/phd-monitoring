import React, { useState, useEffect } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import Recommendation from "../layouts/Recommendation";
import Dordc from "./roles/Dordc";
import RoleBasedWrapper from "../roleWrapper/RoleBasedWrapper";

const ListOfExaminers = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="List of Examiners" formData={formData} />
      <div className="form-container">

        <Student formData={formData}></Student>
        <RoleBasedWrapper
          roleHierarchy={formData.steps}
          currentRole={formData.role}
        >
        <Supervisor formData={formData}></Supervisor>

        <Dordc formData={formData}></Dordc>

        <Recommendation
          formData={formData}
          role="director"
          allowRejection={true}
        ></Recommendation>
        
        </RoleBasedWrapper>
      </div>
    </>
  );
};

export default ListOfExaminers;
