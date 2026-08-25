import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import TableComponent from "../../table/TableComponent";
import Recommendation from "../../layouts/Recommendation";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
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
    setBody({
      approval: formData.approvals.supervisor,
      attendance: formData.attendance,
      contact_hours: formData.contact_hours,
      current_progress: formData.current_progress,
      progress: formData.progress,
      total_progress: formData.total_progress,
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
    const increase = parseFloat(body.current_progress);
    const previous = parseFloat(formData.previous_progress) || 0;

    if (!Number.isFinite(increase) || increase + previous <= 100) {
      return;
    }

    // Clamped through state rather than by assignment, so the box shows the
    // figure that will actually be submitted.
    setBody((prev) => ({ ...prev, current_progress: 100 - previous }));
    toast.error("Total progress cannot exceed 100%");
  }, [body.current_progress, formData.previous_progress]);

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
          {body.approval && (
            <>
              <GridContainer
                elements={[
                  <InputField
                    label={"Previous Quantum Progress Percentage"}
                    initialValue={formData.previous_progress}
                    isLocked={true}
                  />,
                ]}
                space={2}
              />
              <GridContainer
                elements={[
                  <InputField required={true}
                    label={"Increase in Quantum Progress Percentage"}
                    initialValue={body.current_progress}
                    isLocked={lock}
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
              {parseFloat(body.current_progress || 0) > 20 && (
                <div style={{ color: "red", marginTop: 0 }}>
                  Supervisor has marked progress of student more than 20%
                </div>
              )}
              <GridContainer
                elements={[
                  <InputField
                    label={"Total Quantum Progress Percentage"}
                    initialValue={formData.total_progress}
                    isLocked={true}
                  />,
                ]}
                space={2}
              />
            </>
          )}
          {formData.role === "faculty" && !lock && (
            <>
              <GridContainer
                elements={[
                  <CustomButton
                    text="Submit"
                    onClick={() => {
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
