import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import TableComponent from "../../table/TableComponent";
import CustomButton from "../../fields/CustomButton";
import { formatDate } from "../../../../utils/timeParse";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";

// The scholar's answers, and what every approver reads above their own panel.
// The current title and objectives stay on the profile until the DORDC
// approves; this form only carries the proposed ones until then.
const Student = ({ formData }) => {
  const location = useLocation();
  const { setLoading } = useLoading();
  const lock = formData?.locks?.student;
  const editable = formData?.role === "student" && !lock;

  const currentObjectives = formData?.objectives || [];
  // A form sent back keeps what was proposed; a new one starts from the
  // current title and objectives, since most revisions change a few words.
  const [title, setTitle] = useState(formData?.revised_title || formData?.phd_title || "");
  const [objectives, setObjectives] = useState(
    formData?.revised_objectives?.length ? formData.revised_objectives
      : currentObjectives.length ? currentObjectives : [""]
  );

  const setObjective = (index, text) =>
    setObjectives((list) => list.map((item, at) => (at === index ? text : item)));

  return (
    <div>
      <GridContainer
        elements={[
          <InputField label="Roll number" initialValue={formData.roll_no} isLocked={true} />,
          <InputField label="Name" initialValue={formData.name} isLocked={true} />,
          <InputField label="Date of revised IRB" initialValue={formatDate(formData.date_of_irb)} isLocked={true} />,
        ]}
      />
      <GridContainer
        elements={[
          <InputField label="Date of admission" initialValue={formatDate(formData.date_of_registration)} isLocked={true} />,
          <InputField label="Department" initialValue={formData.department} isLocked={true} />,
          <InputField label="Current status" initialValue={formData.current_status} isLocked={true} />,
        ]}
      />
      <GridContainer
        elements={[
          <InputField label="Address of correspondence" initialValue={formData.address} isLocked={true} />,
        ]}
        space={2}
      />

      <GridContainer
        elements={[
          <InputField label="Current title of PhD thesis" initialValue={formData.phd_title} isLocked={true} />,
        ]}
        space={2}
      />
      <GridContainer
        elements={[
          <TableComponent
            label="Current objectives"
            data={currentObjectives.map((objective) => ({ objective }))}
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
            label="Revised title of PhD thesis"
            initialValue={editable ? title : formData.revised_title}
            isLocked={!editable}
            onChange={setTitle}
          />,
        ]}
        space={2}
      />

      {editable ? (
        <>
          <GridContainer
            label="Revised objectives"
            elements={[
              <CustomButton
                text="Add objective"
                variant="secondary"
                size="sm"
                onClick={() => setObjectives((list) => [...list, ""])}
              />,
            ]}
          />
          <GridContainer
            each={3}
            elements={objectives.map((objective, index) => (
              <InputField
                required={true}
                label={`Revised objective ${index + 1}`}
                showLabel={false}
                initialValue={objective}
                isLocked={false}
                onChange={(text) => setObjective(index, text)}
              />
            ))}
          />
          <p className="form-note">Clear a box to drop that objective.</p>
          <GridContainer
            elements={[
              <CustomButton
                text="Submit revision"
                onClick={() =>
                  submitForm(
                    {
                      revised_title: title,
                      // A box left empty is an objective dropped, not a blank one.
                      revised_objectives: objectives.filter((text) => text?.trim()),
                    },
                    location,
                    setLoading
                  )
                }
              />,
            ]}
          />
        </>
      ) : (
        <GridContainer
          elements={[
            <TableComponent
              label="Revised objectives"
              data={(formData.revised_objectives || []).map((objective) => ({ objective }))}
              keys={["objective"]}
              titles={["Objective"]}
            />,
          ]}
          space={3}
        />
      )}
    </div>
  );
};

export default Student;
