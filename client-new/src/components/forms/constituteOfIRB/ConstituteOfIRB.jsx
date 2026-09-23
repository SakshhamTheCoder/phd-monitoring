import React, { useState, useEffect } from "react";

import FormTitleBar from "../formTitleBar/FormTitleBar";
import Student from "./roles/Student";
import Supervisor from "./roles/Supervisor";
import Hod from "./roles/Hod";
import Dordc from "./roles/Dordc";
import FormLadder from "../formLadder/FormLadder";
import GridContainer from "../fields/GridContainer";
import TableComponent from "../table/TableComponent";
import { formatDate } from "../../../utils/timeParse";

const ConstituteOfIRB = ({formData}) => {

  // An IRB constituted before the portal existed. The form has to exist,
  // because irbCompleted() and phdTitleLocked() read it rather than the
  // committee, but nobody answered a step in it: drawing the ladder would show
  // six blank recommendations, which reads as six approvals given here. So the
  // known facts are shown and the steps are not drawn at all.
  if (formData?.carried_over_at) {
    return (
      <>
        <FormTitleBar formName="Constitution of Institute Research Board" formData={formData} />
        <p className="form-note">
          {formData.date_of_irb
            ? `This IRB was constituted on ${formatDate(formData.date_of_irb)}, before the portal.`
            : "This IRB was constituted before the portal."}
          {" "}The record was brought in from the office's sheet
          {formData.carried_over_at ? ` on ${formatDate(formData.carried_over_at)}` : ""},
          so no step here was answered.
        </p>
        <div className="form-container">
          <GridContainer
            label="Committee"
            elements={[
              <TableComponent
                data={formData.doctoral || []}
                keys={["name", "designation", "email"]}
                titles={["Name", "Designation", "Email"]}
              />,
            ]}
            space={3}
          />
          {formData.outside_expert && (
            <GridContainer
              label="External expert"
              elements={[
                <TableComponent
                  data={[formData.outside_expert]}
                  keys={["name", "designation", "institution", "email"]}
                  titles={["Name", "Designation", "Institution", "Email"]}
                />,
              ]}
              space={3}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <FormTitleBar formName="Constitution of Institute Research Board" formData={formData} />
      <div className="form-container">
        
      <FormLadder
        formData={formData}
        panels={{ student: Student, faculty: Supervisor, hod: Hod, dordc: Dordc }}
      />
      </div>
    </>
  );
};

export default ConstituteOfIRB;
