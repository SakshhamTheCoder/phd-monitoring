import React from "react";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import FormLadder from "../formLadder/FormLadder";

const PresentationForm = ({formData, refetchData = null,}) => {
  return (
    <>
      <FormTitleBar formName={"Progress Monitoring " + formData.period_of_report} formData={formData} />
      <div className="form-container">
          
    <FormLadder
      formData={formData}
      panels={{ student: Student, faculty: Supervisor }}
      stepProps={{ student: { refetchData } }}
    />
      </div>
    </>
  );
};
export default PresentationForm;
