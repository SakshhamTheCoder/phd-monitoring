import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Recommendation from "../../layouts/Recommendation";
import FileUploadField from "../../fields/FileUploadField";
import GridContainer from "../../fields/GridContainer";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";

// The coordinator answers twice. On the written round they only recommend, so
// the step is a plain Recommendation. After the viva they hold the form until
// the minutes are uploaded, which is the portal's only record that the viva
// happened, so that round needs a file alongside the recommendation.
//
// Recommendation draws no Submit button when moreFields is set, and reports the
// answer through handleRecommendationChange, so the two can be posted together.
const PhDCoordinator = ({ formData }) => {
  const afterViva = formData?.round >= 2;
  const isTheirTurn =
    formData?.role === "phd_coordinator" &&
    formData?.stage === "phd_coordinator" &&
    !formData?.locks?.phd_coordinator;

  const [body, setBody] = useState({});
  const [minutes, setMinutes] = useState(null);
  const location = useLocation();
  const { setLoading } = useLoading();

  if (!afterViva) {
    return <Recommendation formData={formData} role="phd_coordinator" allowRejection={false} />;
  }

  return (
    <>
      <Recommendation
        formData={formData}
        role="phd_coordinator"
        allowRejection={false}
        moreFields={isTheirTurn}
        handleRecommendationChange={setBody}
        title="Recommendation of PhD Coordinator, after the viva:"
      />

      <GridContainer
        elements={[
          <FileUploadField
            required={true}
            label={"Minutes of the viva"}
            isLocked={!isTheirTurn}
            initialValue={formData.viva_minutes_pdf}
            onChange={(file) => setMinutes(file)}
          />,
        ]}
      />

      {isTheirTurn && (
        <GridContainer
          elements={[
            <CustomButton
              text="Submit"
              onClick={() => {
                if (body.approval === null || body.approval === undefined) {
                  toast.error("Choose Recommend or Not Recommend first.");
                  return;
                }
                if (!minutes && !formData.viva_minutes_pdf) {
                  toast.error("Upload the minutes of the viva first.");
                  return;
                }
                submitForm(
                  body,
                  location,
                  setLoading,
                  minutes ? [{ key: "viva_minutes_pdf", file: minutes }] : null
                );
              }}
            />,
          ]}
        />
      )}
    </>
  );
};

export default PhDCoordinator;
