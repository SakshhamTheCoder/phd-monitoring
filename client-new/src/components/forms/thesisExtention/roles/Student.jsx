import React, { useEffect, useState } from "react";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import DateField from "../../fields/DateField";
import FileUploadField from "../../fields/FileUploadField";
import CustomButton from "../../fields/CustomButton";
import { formatDate } from "../../../../utils/timeParse";
import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";

// The scholar's half of a thesis extension request.
//
// What the API asks for, from ThesisExtentionController::studentSubmit:
//   reason                  always accepted, and copied onto the granted
//                           extension by recordExtension()
//   date_of_synopsis        required only while the student has none on record,
//                           and saved against the student rather than the form
//   previous_extention_pdf  required only on a repeat extension, so the
//                           previous grant can be read alongside the new request
//
// period_of_extention is deliberately absent. recordExtention() fixes it at
// twelve months because the regulations do not let the scholar choose one, so
// it is shown here as a fact rather than a field.
const Student = ({ formData }) => {
  const [body, setBody] = useState({});
  const [files, setFiles] = useState([]);
  const [lock, setLock] = useState(formData?.locks?.student);
  const location = useLocation();
  const { setLoading } = useLoading();

  const previous = formData.previous_extensions || [];
  const isRepeatRequest = previous.length > 0;
  const lastExtension = previous[previous.length - 1];
  // Asked for only while the student has no synopsis date on record, which is
  // the same condition the API validates on.
  const needsSynopsisDate = !formData.date_of_synopsis;

  useEffect(() => {
    setLock(formData?.locks?.student);
  }, [formData]);

  const update = (key) => (value) => setBody((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <GridContainer
        elements={[
          <InputField label="Roll Number" initialValue={formData.roll_no} isLocked={true} />,
          <InputField label="Name" initialValue={formData.name} isLocked={true} />,
          <InputField label="Department" initialValue={formData.department} isLocked={true} />,
        ]}
      />

      <GridContainer
        elements={[
          <InputField label="Title of PhD Thesis" initialValue={formData.phd_title} isLocked={true} />,
        ]}
        space={3}
      />

      <GridContainer
        elements={formData.supervisors?.map((supervisor, index) => (
          <InputField
            label={"Supervisor " + (index + 1)}
            initialValue={supervisor.name}
            isLocked={true}
          />
        ))}
      />

      <GridContainer
        elements={[
          <InputField
            label="Status of Student at Time of Admission"
            initialValue={formData.initial_status}
            isLocked={true}
          />,
          <InputField
            label="Date of IRB Meeting"
            initialValue={formatDate(formData.date_of_irb)}
            isLocked={true}
          />,
          <DateField
            required={needsSynopsisDate}
            label="Date of Synopsis Presentation"
            initialValue={formData.date_of_synopsis}
            isLocked={lock || !needsSynopsisDate}
            onChange={update("date_of_synopsis")}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <InputField
            label="Extension Availed Earlier"
            initialValue={isRepeatRequest ? "Yes" : "No"}
            isLocked={true}
          />,
          <InputField
            label="Period of Extension Requested"
            initialValue="12 months"
            hint="Fixed by regulation"
            isLocked={true}
          />,
        ]}
        space={2}
      />

      {isRepeatRequest && (
        <GridContainer
          elements={[
            <InputField
              label="Date of Previous Extension"
              initialValue={formatDate(lastExtension?.created_at)}
              isLocked={true}
            />,
            <InputField
              label="Period of Previous Extension"
              initialValue={
                lastExtension?.period_of_extention
                  ? lastExtension.period_of_extention + " months"
                  : "N/A"
              }
              isLocked={true}
            />,
          ]}
        />
      )}

      <GridContainer
        elements={[
          <InputField
            required={true}
            label="Reason for Extension"
            initialValue={formData.reason}
            isLocked={lock}
            hint="Why the thesis could not be submitted within the deadline"
            onChange={update("reason")}
          />,
        ]}
        space={3}
      />

      {isRepeatRequest && (
        <GridContainer
          elements={[
            <FileUploadField
              required={true}
              label="Previous Extension Approval"
              maxSizeMB={20}
              isLocked={lock}
              initialValue={formData.previous_extention_pdf}
              onChange={(file) => setFiles([{ key: "previous_extention_pdf", file }])}
            />,
          ]}
        />
      )}

      {formData?.role === "student" && !lock && (
        <GridContainer
          elements={[
            <CustomButton
              text="Submit"
              onClick={() =>
                submitForm(body, location, setLoading, files.length > 0 ? files : null)
              }
            />,
          ]}
        />
      )}
    </div>
  );
};

export default Student;
