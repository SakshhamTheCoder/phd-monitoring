import React, { useState } from "react";
import { toast } from "react-toastify";
import Student from "./roles/Student";
import FormTitleBar from "../formTitleBar/FormTitleBar";
import Supervisor from "./roles/Supervisor";
import FormLadder from "../formLadder/FormLadder";
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
      <FormTitleBar formName="IRB Submission" formData={formData} />
      {canResend && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap", background: "#fdf6f6", border: "1px solid #f0d9d9",
          borderRadius: 8, padding: "10px 14px", margin: "10px 0",
        }}>
          <span style={{ color: "#7a1f1f", fontSize: 14 }}>
            This submission is awaiting the outside expert's review.
          </span>
          <button onClick={resend} disabled={resending} style={{
            padding: "8px 14px", background: "var(--primary-color)", color: "#fff", border: "none",
            borderRadius: 6, cursor: resending ? "not-allowed" : "pointer",
            opacity: resending ? 0.6 : 1, fontWeight: 600,
          }}>
            {resending ? "Resending…" : "Resend review request"}
          </button>
        </div>
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
