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
  const [body, setBody] = useState({});
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
    console.log(body);
  }, [body]);

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
                label="Date of Admission"
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
                label="Phone Number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />
          <GridContainer
            elements={[
              <InputField
                label="Tentative Title of Phd Thesis"
                initialValue={formData.phd_title}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField
                label="Status of Student at Time of Admission"
                initialValue={formData.initial_status}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField
                label="Change of Status Availed (if any earlier)"
                initialValue={prevOff?prevOff:"No"}
                isLocked={true}
              />,
            ]}
             space={2}/>

            <>
              {prevOff==="Yes" && (
                <GridContainer elements={[
               <InputField label={"Date of Previous Extension"}
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
            elements={formData.supervisors.map((sup,index)=>{
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
                initialValue={formData.researchExtentions[0]?.period_of_extension?formData.researchExtentions[0]?.period_of_extension:"N/A"}
                isLocked={true}
               
              />,
            ]}
            space={2}
          />

          

          <GridContainer
            elements={[
              <InputField required={true}
                label="Reason for Extension"
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
              <FileUploadField required={true}
                label={"Upload Research Proposal"}
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
