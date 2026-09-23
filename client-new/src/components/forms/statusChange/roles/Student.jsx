import React, { useEffect, useState } from "react";
import InputSuggestions from "../../fields/InputSuggestions";
import { baseURL } from "../../../../api/urls";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import TableComponent from "../../table/TableComponent";
import CustomButton from "../../fields/CustomButton";
import DropdownField from "../../fields/DropdownField";
import FileUploadField from "../../fields/FileUploadField";
import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";
import ShowPublications from "../../../publications/ShowPublications";
import CustomModal from "../../modal/CustomModal";
import { customFetch } from "../../../../api/base";
import { toast } from "react-toastify";
import DateField from "../../fields/DateField";
import { generateReportPeriods } from "../../../../utils/semester";

const Student = ({ formData }) => {
  // Seeded with what the fields show prefilled. A form sent back shows the
  // earlier answers, and leaving one as shown sent nothing for it.
  const [body, setBody] = useState(() => ({ reason: formData.reason }));
  const [lock, setLock] = useState(formData?.locks?.student);
  const [isLoaded, setIsLoaded] = useState(true);
  const location = useLocation();
  const { setLoading } = useLoading();
  const [showPublication, setShowPublication] = useState(false);
  const [temp, setTemp] = useState([]);
  const [files, setFiles] = useState([]);

  const [prevOff, setPrevOff] = useState(null);
  const [prevDate,setPrevDate] = useState(null);
  useEffect(() => {
    if (formData.previous_changes?.length > 0) {
      setPrevOff("Yes");
      setPrevDate(formData.previous_changes[formData.previous_changes?.length-1].created_at)
    }
    else
    {
      setPrevOff("No");
    }
    setLock(formData?.locks?.student);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
  }, [body]);

  return (
    <div>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Roll number"
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
                label="Date of admission"
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
              <InputField
                label="Department"
                initialValue={formData.department}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Email"
                initialValue={formData.email}
                isLocked={true}
              />,
              <InputField
                label="Phone number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Title of PhD thesis"
                initialValue={formData.phd_title}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField
                label="Status of student at time of admission"
                initialValue={formData.initial_status}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField
                label="Change of status availed (if any earlier)"
                initialValue={prevOff?prevOff:"No"}
                isLocked={true}
              />,
            ]}
             space={2}/>

            <>
              {prevOff==="Yes" && (
                <GridContainer elements={[
               <InputField label={"Date of previous extension"}
               initialValue={prevDate}
               isLocked={true}
               />,
               <InputField label={"Date of IRB Meeting"}
               initialValue={formatDate(formData.date_of_irb)}
               isLocked={true}
               />,
              ]}/>
              )}
            </>
            <GridContainer
            elements={[
              <InputField
                label="Required status change"
                initialValue={formData.type_of_change}
                isLocked={true}
               
              />,
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputField required={true}
                label="Reason for status change"
                initialValue={formData.reason}
                isLocked={lock}
                onChange={(value) => {
                  setBody((prev) => ({
                    ...prev,
                    reason: value,
                  }));
                }}
              />,
            ]}
            space={2}
          />
        </>
      )}
      {formData?.role === "student" && !lock && (
        <>
          <GridContainer
            elements={[
              <CustomButton
                text="Submit"
                onClick={() => {
                  submitForm(
                    body,
                    location,
                    setLoading,
                    files.length > 0 ? files : null
                  );
                }}
              />,
            ]}
          />
        </>
      )}
    </div>
  );
};

export default Student;
