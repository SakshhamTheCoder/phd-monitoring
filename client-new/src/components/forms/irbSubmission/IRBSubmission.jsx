import React, { useState } from "react";
import { toast } from "react-toastify";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import FormLadder from "../formLadder/FormLadder";
import StatusNotice from "../../common/StatusNotice";
import CustomButton from "../fields/CustomButton";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";

// Roles allowed to resend the external review request (mirror of the backend gate).
const RESEND_ROLES = ["dordc", "phd_coordinator", "admin"];

const IRBSubmission = ({ formData }) => {
  const [resending, setResending] = useState(false);

  const canResend =
    formData?.stage === "external" && RESEND_ROLES.includes(formData?.role);

  const resend = async () => {
    if (resending) return;
    setResending(true);
    try {
      const res = await customFetch(
        `${baseURL}/irb-submissions/${formData.form_id}/resend-external-review`,
        "POST",
        {},
        false,
        false
      );
      if (res?.success) {
        toast.success(res.response?.message || "Review request resent to the expert.");
      } else {
        toast.error(res?.response?.message || "Could not resend the review request.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <FormTitleBar formName="IRB submission" formData={formData} />
      {canResend && (
        <StatusNotice
          tone="info"
          action={(
            <CustomButton
              text={resending ? "Resending…" : "Resend review request"}
              variant="secondary"
              size="sm"
              onClick={resend}
              disabled={resending}
            />
          )}
        >
          This submission is awaiting the outside expert's review.
        </StatusNotice>
      )}
      <div className="form-container">
      <FormLadder
        formData={formData}
        panels={{ student: Student, faculty: Supervisor }}
      />
      </div>
    </>
  );
};

export default IRBSubmission;
