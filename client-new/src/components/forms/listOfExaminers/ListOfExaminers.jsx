import React, { useState, useEffect } from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import Dordc from "./roles/Dordc";
import FormLadder from "../formLadder/FormLadder";
import { PanelSection } from "../../panel/Panel";

const ListOfExaminers = ({formData}) => {
 

  return (
    <>
      <FormTitleBar formName="List of examiners" formData={formData} />
      <div className="form-container">

        {/* The scholar's details head the form, sectioned like the steps
            below even though the chain starts at the supervisor. */}
        <PanelSection title="Student" className="form-step">
          <Student formData={formData} />
        </PanelSection>
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
