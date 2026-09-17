import React, { useState, useEffect } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import Dordc from "./roles/Dordc";
import FormLadder from "../formLadder/FormLadder";

const ListOfExaminers = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="List of Examiners" formData={formData} />
      <div className="form-container">

        <Student formData={formData}></Student>
        <FormLadder
          formData={formData}
          panels={{ faculty: Supervisor, dordc: Dordc }}
          stepProps={{ director: { allowRejection: true } }}
        />
      </div>
    </>
  );
};

export default ListOfExaminers;
