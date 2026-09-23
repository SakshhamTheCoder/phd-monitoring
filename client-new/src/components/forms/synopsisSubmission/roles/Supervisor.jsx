import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import GridContainer from "../../fields/GridContainer";
import StatusNotice from "../../../common/StatusNotice";
import InputField from "../../fields/InputField";
import RadioButtonGroup from "../../fields/RadioButtonGroup";
import TableComponent from "../../table/TableComponent";
import Recommendation from "../../layouts/Recommendation";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { toast } from "react-toastify";
import { stepAnswered } from '../../../../utils/formSteps';

const Supervisor = ({ formData }) => {
  // Progress is scored once, on the written round. After the viva the
  // supervisor is confirming that the viva happened and went well, not
  // re-scoring the work, so the figures are shown as a record and the server
  // ignores them either way.
  const scoring = (formData.round ?? 1) < 2;
  const [lock, setLock] = useState(formData.locks?.supervisor);
  const [body, setBody] = useState({});
  const [isLoaded, setIsLoaded] = useState(true);
  const [totalProgress, setTotalProgress] = useState(0);
  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    setLock(formData.locks?.supervisor);
    setBody({
      // The approval column defaults to 0, which would submit as "Not Recommend"
      // if Submit is pressed before choosing. Unanswered means nothing chosen.
      approval: stepAnswered(formData, 'supervisor') ? formData.approvals.supervisor : null,
      attendance: formData.attendance,
      contact_hours: formData.contact_hours,
      current_progress: formData.current_progress,
      progress: formData.progress,
      total_progress: formData.total_progress,
      checklist_option_id: formData.checklist_option_id ?? null,
    });
    setTotalProgress(
      parseFloat(formData.current_progress) + parseFloat(formData.progress)
    );
    setIsLoaded(true);
  }, [formData]);

  // Update total_progress whenever current_progress or progress changes
  useEffect(() => {
    setBody((prev) => ({
      ...prev,
      total_progress:
        parseFloat(prev.current_progress) + parseFloat(prev.progress || 0),
    }));
    setTotalProgress(
      parseFloat(body.current_progress) + parseFloat(body.progress || 0)
    );
  }, [body.progress]);

  const handleApprovalChange = (value) => {
    setBody((prevBody) => ({
      ...prevBody,
      approval: value.approval,
      comments: value.comments,
    }));
  };
  // Both of these come off the form as strings, so they have to be read as
  // numbers before they can be added. Added as they arrive, "55" and 15 make
  // "5515", which is over 100 for any figure anyone could type: the warning
  // fired on every keystroke and the entry was rewritten every time.
  useEffect(() => {
    // A locked panel is a record, not an entry. previous_progress is the
    // scholar's overall progress today, which on an approved form already
    // includes this increase, so checking it there fired on page load.
    if (lock || !scoring) {
      return;
    }

    const increase = parseFloat(body.current_progress);
    const previous = parseFloat(formData.previous_progress) || 0;

    if (!Number.isFinite(increase) || increase + previous <= 100) {
      return;
    }

    // Clamped through state rather than by assignment, so the box shows the
    // figure that will actually be submitted.
    setBody((prev) => ({ ...prev, current_progress: 100 - previous }));
    toast.error("Total progress cannot exceed 100%");
  }, [body.current_progress, formData.previous_progress, lock, scoring]);

  return (
    <>
      {isLoaded && formData && (
        <>
          <Recommendation
            formData={formData}
            role="supervisor"
            allowRejection={false}
            moreFields={true}
            handleRecommendationChange={handleApprovalChange}
          />
          {!!body.approval && (
            <>
              <GridContainer
                elements={[
                  <InputField
                    label={"Previous quantum progress percentage"}
                    initialValue={formData.previous_progress}
                    isLocked={true}
                  />,
                ]}
                space={2}
              />
              <GridContainer
                elements={[
                  <InputField required={scoring}
                    label={"Increase in quantum progress percentage"}
                    initialValue={body.current_progress}
                    isLocked={lock || !scoring}
                    onChange={(updated) => {
                      setBody((prev) => ({
                        ...prev,
                        current_progress: updated,
                      }));
                    }}
                  />,
                ]}
                space={2}
              />
              {scoring && parseFloat(body.current_progress || 0) > 20 && (
                <GridContainer
                  elements={[
                    <StatusNotice tone="warning">
                      Supervisor has marked progress of student more than 20%
                    </StatusNotice>,
                  ]}
                  space={2}
                />
              )}
              <GridContainer
                elements={[
                  <InputField
                    label={"Total quantum progress percentage"}
                    // The stored total is 0 until the supervisor submits, so while
                    // entering, show what the server will store: previous plus increase.
                    initialValue={lock || !scoring
                      ? formData.total_progress
                      : (parseFloat(formData.previous_progress) || 0) + (parseFloat(body.current_progress) || 0)}
                    isLocked={true}
                  />,
                ]}
                space={2}
              />
            </>
          )}
          {/* The categories on offer are the ones this scholar's department and
              admission date qualify them for. A scholar no condition covers is
              asked for nothing, and the server agrees. */}
          {scoring && !!body.approval && (formData.checklist_options?.length || 0) > 0 && (
            <GridContainer
              label="Publication category met"
              elements={[
                lock ? (
                  <InputField
                    label="Declared"
                    initialValue={formData.checklist_choice || "Not declared"}
                    isLocked={true}
                  />
                ) : (
                  <RadioButtonGroup
                    name="synopsis-checklist"
                    titles={formData.checklist_options.map((option) => option.label)}
                    values={formData.checklist_options.map((option) => option.id)}
                    defaultValue={body.checklist_option_id}
                    onSelect={(id) => {
                      setBody((prev) => ({ ...prev, checklist_option_id: id }));
                    }}
                  />
                ),
              ]}
              space={2}
            />
          )}
          {formData.role === "faculty" && !lock && (
            <>
              <GridContainer
                elements={[
                  <CustomButton
                    text="Submit"
                    onClick={() => {
                      if (body.approval === null || body.approval === undefined) {
                        toast.error("Choose Recommend or Not Recommend first.");
                        return;
                      }
                      if (
                        scoring &&
                        !!body.approval &&
                        (formData.checklist_options?.length || 0) > 0 &&
                        !body.checklist_option_id
                      ) {
                        toast.error("Choose the publication category the scholar has met.");
                        return;
                      }
                      submitForm(body, location, setLoading);
                    }}
                  />,
                ]}
              />
            </>
          )}
        </>
      )}
    </>
  );
};

export default Supervisor;
