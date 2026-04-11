import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import GridContainer from "../../fields/GridContainer";
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
        approval: formData.current_review?.progress === "satisfactory",
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

  useEffect(() => {
    if (body.current_progress + formData.previous_progress > 100) {
      body.current_progress = 100 - formData.previous_progress;
      toast.error("Total progress cannot exceed 100%");
    }
  }, [body]);

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
          {lock && (
            <>
              <p>Supervisor(s) Review</p>
              <GridContainer
                elements={[
                  <TableComponent
                    data={formData.supervisorReviews}
                    keys={["faculty", "progress", "comments"]}
                    titles={["Name", "Progress", "Comments"]}
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
          {body.approval && (
            <>
              <>
                <GridContainer
                  elements={[
                    <InputField
                      label={"Previous Quantum Progress Percentage"}
                      initialValue={body.current_progress}
                      isLocked={true}
                    />,
                  ]}
                  space={2}
                />
                <GridContainer
                  elements={[
                    <InputField
                      label={"Increase in Quantum Progress Percentage"}
                      initialValue={body.progress}
                      isLocked={lock}
                      onChange={updateTotal}
                      required={true}
                    />,
                  ]}
                  space={2}
                />
                {parseFloat(body.progress || 0) > 20 && (
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

                {formData.teaching_work === "None" ? (
                  <GridContainer
                    elements={[
                      <InputField required={true}
                        label={"% Attendence"}
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
                        label={"No. of Contact Hours"}
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
