import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { baseURL } from "../../api/urls";
import ExternalLayout from "./ExternalLayout";
import GridContainer from "../../components/forms/fields/GridContainer";
import InputField from "../../components/forms/fields/InputField";
import RecommendationField from "../../components/forms/fields/RecommendationField";
import CustomButton from "../../components/forms/fields/CustomButton";
import "../../components/forms/formTitleBar/FormTitleBar.css";
import "../forms/forms.css";
import "./ExternalReview.css";

// Public, token-authenticated page. Uses plain fetch (NOT the authed customFetch) so a 401
// elsewhere can never redirect the expert to login — there is no account. Rendered inside the
// portal shell (ExternalLayout) with the real form components so it matches an in-portal form.
const ExternalReview = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [decision, setDecision] = useState(null); // 'recommend' | 'not_recommend'
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${baseURL}/external-review/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) setError(body.message || "This review link is not valid.");
        else setData(body);
      })
      .catch(() => active && setError("Could not load the review. Please try again."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const submit = async () => {
    setSubmitError(null);
    if (!decision) {
      setSubmitError("Please choose Recommend or Not Recommend.");
      return;
    }
    if (decision === "not_recommend" && !comment.trim()) {
      setSubmitError("A comment is required when not recommending.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${baseURL}/external-review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setSubmitError(body.message || "Could not record your review. Please try again.");
    } catch (e) {
      setSubmitError("Could not record your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const TitleBar = () => (
    <div className="form-title-bar">
      <h1 className="form-title-bar-t">IRB Submission Review</h1>
      {data?.form_id && (
        <div className="form-title-bar-right">
          <span className="form-title-bar-right-item">Ref #{data.form_id}</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <ExternalLayout>
        <div className="form-container"><p>Loading…</p></div>
      </ExternalLayout>
    );
  }

  if (error) {
    return (
      <ExternalLayout>
        <TitleBar />
        <div className="form-container"><div className="xr-note xr-note-error">{error}</div></div>
      </ExternalLayout>
    );
  }

  if (done || data?.state === "responded") {
    const dec = done ? decision : data?.decision;
    const cmt = done ? comment.trim() : data?.comment;
    return (
      <ExternalLayout>
        <TitleBar />
        <div className="form-container">
          <div className="xr-note xr-note-success">
            {done
              ? "Your review has been recorded. Thank you."
              : "You have already responded to this review."}
          </div>
          {dec && (
            <p><strong>Your recommendation:</strong> {dec === "recommend" ? "Recommend" : "Not Recommend"}</p>
          )}
          {cmt && <p><strong>Remarks:</strong> {cmt}</p>}
          <p className="xr-muted">You can safely close this page.</p>
        </div>
      </ExternalLayout>
    );
  }

  if (data?.state === "closed") {
    return (
      <ExternalLayout>
        <TitleBar />
        <div className="form-container">
          <div className="xr-note">This submission is no longer awaiting your review. No action is needed.</div>
        </div>
      </ExternalLayout>
    );
  }

  // pending
  return (
    <ExternalLayout>
      <TitleBar />
      <div className="form-container">
        <GridContainer
          elements={[
            <InputField label="Student" initialValue={data?.student_name || "—"} isLocked={true} />,
            <InputField label="Department" initialValue={data?.department || "—"} isLocked={true} />,
          ]}
        />
        <GridContainer
          space={2}
          elements={[
            <InputField label="Title of PhD Thesis" initialValue={data?.title || "—"} isLocked={true} />,
          ]}
        />

        {data?.pdf_url && (
          <GridContainer
            space={3}
            label="Submission Document"
            elements={[
              <div className="xr-pdf">
                <iframe title="IRB Submission PDF" src={data.pdf_url} className="xr-pdf-frame" />
                <a href={data.pdf_url} target="_blank" rel="noopener noreferrer" className="xr-pdf-link">
                  Open PDF in a new tab
                </a>
              </div>,
            ]}
          />
        )}

        <RecommendationField
          role="Outside Expert"
          allowRejection={false}
          initialValue={{}}
          lock={false}
          onRecommendationChange={(d) =>
            setDecision(d.approval ? "recommend" : "not_recommend")
          }
        />

        <GridContainer
          space={2}
          elements={[
            <InputField
              label="Remarks"
              required={decision === "not_recommend"}
              initialValue={comment}
              isLocked={false}
              hint="Add remarks for the committee…"
              onChange={setComment}
            />,
          ]}
        />

        {submitError && <div className="xr-note xr-note-error">{submitError}</div>}

        <GridContainer
          space={2}
          elements={[
            <CustomButton
              text={submitting ? "Submitting…" : "Submit Recommendation"}
              onClick={submit}
              disabled={submitting}
            />,
          ]}
        />
      </div>
    </ExternalLayout>
  );
};

export default ExternalReview;
