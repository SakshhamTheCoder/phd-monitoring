import React, { useState } from "react";
import { toast } from "react-toastify";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";
import StatusNotice from "../../common/StatusNotice";
import CustomButton from "../fields/CustomButton";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";
import useDoneFlash from "../../../hooks/useDoneFlash";
import ServerPanel from "./ServerPanel";

// A notice above the form, with the action the server offers this reader.
const Notice = ({ notice }) => {
  const [busy, setBusy] = useState(false);
  const [done, flashDone] = useDoneFlash();
  const { action } = notice;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await customFetch(baseURL + action.endpoint, "POST", {}, false, false);
      if (res?.success) {
        toast.success(res.response?.message || action.done);
        flashDone();
      } else {
        toast.error(res?.response?.message || action.failed);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <StatusNotice
      tone={notice.tone}
      action={action && (
        <CustomButton text={action.label} variant="secondary" size="sm" onClick={run} busy={busy} done={done} />
      )}
    >
      {notice.text}
    </StatusNotice>
  );
};

// A form the server describes in `formData.view`. The steps it sends panels for
// are drawn from them; every other step of the chain keeps FormLadder's plain
// recommendation. A form moved here needs no page of its own on the web.
const ServerForm = ({ formData }) => {
  const { view } = formData;
  const steps = Object.keys(view.panels);
  const panels = Object.fromEntries(steps.map((step) => [step, ServerPanel]));
  const stepProps = Object.fromEntries(steps.map((step) => [step, view.panels[step]]));

  return (
    <>
      <FormTitleBar formName={view.title} formData={formData} />
      {(view.notices || []).map((notice, index) => (
        <Notice key={index} notice={notice} />
      ))}
      <div className="form-container">
        <FormLadder formData={formData} panels={panels} stepProps={stepProps} />
      </div>
    </>
  );
};

export default ServerForm;
