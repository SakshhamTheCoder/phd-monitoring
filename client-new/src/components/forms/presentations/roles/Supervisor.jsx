import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import GridContainer from "../../fields/GridContainer";
import StatusNotice from "../../../common/StatusNotice";
import InputField from "../../fields/InputField";
import TableComponent from "../../table/TableComponent";
import Recommendation from "../../layouts/Recommendation";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { set } from "react-hook-form";
import { toast } from "react-toastify";

const Supervisor = ({ formData }) => {
  const [lock, setLock] = useState(formData.locks?.supervisor);
  const [body, setBody] = useState({});
  const [isLoaded, setIsLoaded] = useState(true);
  const [totalProgress, setTotalProgress] = useState(0);
  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    setLock(formData.locks?.supervisor);
    if (formData.role === "faculty") {
      setBody({
        // An unreviewed presentation has no progress yet. Reading that as
        // "unsatisfactory" let a bare Submit record it.
        approval: formData.current_review?.progress
          ? formData.current_review.progress === "satisfactory"
          : null,
        comments: formData.current_review?.comments || "",
        attendance: formData.attendance,
        contact_hours: formData.contact_hours,
        current_progress: formData.current_progress,
        progress: formData.progress,
        total_progress: formData.total_progress,
      });
    } else {
      setBody({
        approval: formData.approvals.supervisor,
        comments: formData.comments.supervisor || "",
        attendance: formData.attendance,
        contact_hours: formData.contact_hours,
        current_progress: formData.current_progress,
        progress: formData.progress,
        total_progress: formData.total_progress,
      });
    }
    setTotalProgress(formData.total_progress);
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

  // Both of these come off the form as strings, so they have to be read as
  // numbers before they can be added. Added as they arrive, "15" and 0 make
  // "150", which is over 100 for any figure anyone could type: the warning fired
  // on every keystroke and the entry was rewritten every time.
  useEffect(() => {
    // A locked panel is a record, not an entry. previous_progress is the
    // scholar's overall progress today, which on an approved form already
    // includes this increase, so checking it there fired on page load.
    if (lock) {
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
  }, [body.current_progress, formData.previous_progress, lock]);

  const handleApprovalChange = (value) => {
    setBody((prevBody) => ({
      ...prevBody,
      approval: value.approval,
      comments: value.comments,
    }));
  };
  const updateTotal = (updated) => {
    setBody((prev) => {
      const newTotal =
        parseFloat(prev.current_progress || 0) + parseFloat(updated || 0);
      setTotalProgress(newTotal);

      return {
        ...prev,
        progress: updated,
        total_progress: newTotal,
      };
    });
  };

  return (
    <>
      {isLoaded && formData && (
        <>
          {!!lock && (
            <>
              <GridContainer
                label="Supervisor(s) review"
                elements={[
                  <TableComponent
                    data={formData.supervisorReviews}
                    keys={["faculty", "progress", "comments"]}
                    titles={["Name", "Progress", "Comments"]}
                    components={[
                      {
                        key: "progress",
                        component: ({ data }) => (
                          <span>
                            {data
                              ? data.replace(/\b\w/g, (c) => c.toUpperCase())
                              : data}
                          </span>
                        ),
                      },
                    ]}
                  />,
                ]}
                space={3}
              />
            </>
          )}
          <Recommendation
            formData={formData}
            role="supervisor"
            allowRejection={false}
            moreFields={true}
            handleRecommendationChange={handleApprovalChange}
            isLocked={lock}
          />
          {!!body.approval && (
            <>
              <>
                <GridContainer
                  elements={[
                    <InputField
                      label={"Previous quantum progress percentage"}
                      initialValue={body.current_progress}
                      isLocked={true}
                    />,
                  ]}
                  space={2}
                />
                <GridContainer
                  elements={[
                    <InputField
                      label={"Increase in quantum progress percentage"}
                      initialValue={body.progress}
                      isLocked={lock}
                      onChange={updateTotal}
                      required={true}
                    />,
                  ]}
                  space={2}
                />
                {parseFloat(body.progress || 0) > 20 && (
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
                      // body, not formData: the stored total is 0 until the form
                      // is submitted, so the box never followed what was typed.
                      initialValue={body.total_progress}
                      isLocked={true}
                    />,
                  ]}
                  space={2}
                />

                {formData.teaching_work === "None" ? (
                  <GridContainer
                    elements={[
                      <InputField required={true}
                        label={"% Attendance"}
                        initialValue={formData.attendance}
                        isLocked={lock}
                        onChange={(updated) => {
                          setBody((prev) => ({
                            ...prev,
                            attendance: updated,
                          }));
                        }}
                        required={true}
                      />,
                    ]}
                  />
                ) : (
                  <GridContainer
                    elements={[
                      <InputField required={true}
                        label={"No. of contact hours"}
                        initialValue={formData.contact_hours}
                        isLocked={lock}
                        onChange={(updated) => {
                          setBody((prev) => ({
                            ...prev,
                            contact_hours: updated,
                          }));
                        }}
                        required={true}
                      />,
                    ]}
                  />
                )}
              </>
            </>
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
