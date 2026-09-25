import React, { useState } from "react";
import { toast } from "react-toastify";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import FormLadder from "../formLadder/FormLadder";
import StatusNotice from "../../common/StatusNotice";
import CustomButton from "../fields/CustomButton";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";
import useDoneFlash from "../../../hooks/useDoneFlash";
import { formatDate } from "../../../utils/timeParse";
import ServerPanel from "./ServerPanel";
import { PanelSection } from "../../panel/Panel";

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

  // A record none of whose steps was answered here: its facts, not the chain.
  if (view.summary) {
    const { note, dates, rows } = view.summary;
    return (
      <>
        <FormTitleBar formName={view.title} formData={formData} />
        <p className="form-note">{note.replace(/\{(\w+)\}/g, (_, name) => formatDate(dates[name]))}</p>
        <div className="form-container">
          <ServerPanel formData={formData} rows={rows} wrapped={false} />
        </div>
      </>
    );
  }

  const steps = Object.keys(view.panels);
  const panels = Object.fromEntries(steps.map((step) => [step, ServerPanel]));
  const stepProps = {
    // How a step's plain recommendation is drawn (the Director may reject),
    // and where it posts when not to the form itself (a URF form's decision).
    ...Object.fromEntries(
      Object.entries(view.step_options || {}).map(([step, options]) => [step, {
        allowRejection: options.allow_rejection,
        ...(options.submit_path ? { submitPath: options.submit_path } : {}),
      }])
    ),
    ...Object.fromEntries(steps.map((step) => [step, view.panels[step]])),
  };

  return (
    <>
      <FormTitleBar formName={view.title} formData={formData} />
      {(view.notes || []).map((note, index) => (
        <p key={index} className="form-note">{note}</p>
      ))}
      {(view.notices || []).map((notice, index) => (
        <Notice key={index} notice={notice} />
      ))}
      <div className="form-container">
        {/* A chain that starts after the scholar is headed by their details. */}
        {view.lead && (
          <PanelSection title={view.lead.title} className="form-step">
            <ServerPanel formData={formData} rows={view.lead.rows} wrapped={view.lead.wrapped} />
          </PanelSection>
        )}
        <FormLadder formData={formData} panels={panels} stepProps={stepProps} />
      </div>
    </>
  );
};

export default ServerForm;
