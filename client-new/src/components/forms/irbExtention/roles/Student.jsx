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

  useEffect(() => {
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
                label="Tentative title of PhD thesis"
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
            elements={(formData.supervisors || []).map((sup,index)=>{
              return (
                <InputField 
                isLocked={true}
                  label={"Supervisor "+(index+1)}
                  initialValue={sup.name}
                />
              )
            })}
       
          />

            <GridContainer
            elements={[
              <InputField
                label="Extension availed if any earlier (for submission of research proposal)"
                initialValue={formData.researchExtentions?.[0]?.period_of_extension?formData.researchExtentions?.[0]?.period_of_extension:"N/A"}
                isLocked={true}
               
              />,
            ]}
            space={2}
          />

          

          <GridContainer
            elements={[
              <InputField required={true}
                label="Reason for extension"
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

          <GridContainer
            elements={[
              <FileUploadField required={!formData.research_pdf}
                label={"Upload research proposal"}
                onChange={(file) => {
                  setFiles([{ key: "research_pdf", file }]);
                }}
                isLocked={lock}
                initialValue={formData.research_pdf}
              />,
            ]}
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
