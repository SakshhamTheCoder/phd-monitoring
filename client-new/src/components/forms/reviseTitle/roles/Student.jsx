import React, { useEffect, useState } from "react";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import CustomButton from "../../fields/CustomButton";
import TableComponent from "../../table/TableComponent";
import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";

const Student = ({ formData }) => {
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData?.locks?.student);
  const [isLoaded, setIsLoaded] = useState(true);
  const location = useLocation();
  const { setLoading } = useLoading();

  const currentObjectivesData = (formData.current_objectives || []).map(
    (objective) => ({ objective })
  );
  const proposedObjectivesData = (formData.proposed_objectives || []).map(
    (objective) => ({ objective })
  );

  useEffect(() => {
    setBody({
      proposed_title: formData.proposed_title || "",
      justification: formData.justification || "",
      proposed_objectives:
        formData.proposed_objectives?.length > 0
          ? formData.proposed_objectives
          : [""],
    });
    setLock(formData?.locks?.student);
    setIsLoaded(true);
  }, []);

  const addObjective = () => {
    setBody((prevBody) => ({
      ...prevBody,
      proposed_objectives: [...prevBody.proposed_objectives, ""],
    }));
  };

  return (
    <div>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Roll Number"
                initialValue={formData.roll_no}
                isLocked={true}
              />,
              <InputField
                label="Name"
                initialValue={formData.name}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Current Title of PhD Thesis"
                initialValue={formData.current_title}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <TableComponent
                label="Current Objectives"
                data={currentObjectivesData}
                keys={["objective"]}
                titles={["Objective"]}
              />,
            ]}
            space={3}
          />

          <GridContainer
            elements={[
              <InputField
                required={true}
                label="Proposed Title of PhD Thesis"
                initialValue={formData.proposed_title}
                isLocked={lock}
                onChange={(value) => {
                  setBody((prev) => ({ ...prev, proposed_title: value }));
                }}
              />,
            ]}
            space={2}
          />

          {!lock ? (
            <>
              <GridContainer
                elements={[
                  <p>Proposed Objectives</p>,
                  <></>,
                  <CustomButton text={"+ Add"} onClick={addObjective} />,
                ]}
              />
              <GridContainer
                elements={body.proposed_objectives?.map((objective, index) => (
                  <InputField
                    required={true}
                    initialValue={objective}
                    isLocked={lock}
                    onChange={(value) => {
                      body.proposed_objectives[index] = value;
                    }}
                    showLabel={false}
                  />
                ))}
                space={1}
              />
            </>
          ) : (
            <GridContainer
              elements={[
                <TableComponent
                  label="Proposed Objectives"
                  data={proposedObjectivesData}
                  keys={["objective"]}
                  titles={["Objective"]}
                />,
              ]}
              space={3}
            />
          )}

          <GridContainer
            elements={[
              <InputField
                required={true}
                label="Justification"
                initialValue={formData.justification}
                isLocked={lock}
                hint="Explain why this title/objectives revision is needed.."
                onChange={(value) => {
                  setBody((prev) => ({ ...prev, justification: value }));
                }}
              />,
            ]}
            space={2}
          />
        </>
      )}
      {formData?.role === "student" && !lock && (
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
      )}
    </div>
  );
};

export default Student;
