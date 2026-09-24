import React from "react";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";
import ServerPanel from "./ServerPanel";

// A form the server describes in `formData.view`. The steps it sends panels for
// are drawn from them; every other step of the chain keeps FormLadder's plain
// recommendation. A form moved here needs no page of its own on the web.
const ServerForm = ({ formData }) => {
  const steps = Object.keys(formData.view.panels);
  const panels = Object.fromEntries(steps.map((step) => [step, ServerPanel]));
  const stepProps = Object.fromEntries(steps.map((step) => [step, { rows: formData.view.panels[step] }]));

  return (
    <>
      <FormTitleBar formName={formData.view.title} formData={formData} />
      <div className="form-container">
        <FormLadder formData={formData} panels={panels} stepProps={stepProps} />
      </div>
    </>
  );
};

export default ServerForm;
