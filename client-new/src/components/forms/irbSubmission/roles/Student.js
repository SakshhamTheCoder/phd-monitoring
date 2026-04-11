import React, { useEffect, useState } from "react";
import InputSuggestions from "../../fields/InputSuggestions";
import { baseURL } from "../../../../api/urls";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import TableComponent from "../../table/TableComponent";
import CustomButton from "../../fields/CustomButton";

import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";
import FileUploadField from "../../fields/FileUploadField";
import DateField from "../../fields/DateField";

const Student = ({ formData }) => {
  const apiUrl_suggestion = baseURL + "/suggestions/faculty";
  const apiUrl_broad_suggestion = baseURL + "/suggestions/specialization";
  const [body, setBody] = useState({});
  const [files, setFiles] = useState([]);
  const [lock, setLock] = useState(formData.locks?.student);
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
  
    setBody({
      revised_phd_title: formData.revised_phd_title,
      address: formData.address,
      revised_phd_objectives:  formData.revised_phd_objectives? formData.revised_phd_objectives  : [""],
      date_of_irb: formData.date_of_irb,
    });
    setLock(formData.locks?.student);
    setIsLoaded(true);
  }, [formData]);

  const addObjective = () => {
    setBody((prevBody) => ({
      ...prevBody,
      revised_phd_objectives: [...prevBody.revised_phd_objectives, ""],
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
              <InputField
                label="Gender"
                initialValue={formData.gender}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Date Of Admission"
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
              <InputField
                label="Department"
                initialValue={formData.department}
                isLocked={true}
              />,
              <InputField
                label="CGPA"
                initialValue={formData.cgpa}
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
                label="Mobile Number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />
           <GridContainer
            elements={[
              <InputField
                initialValue={formData.phd_title}
                label={"Previous Proposed Title of Phd Thesis"}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField required={true}
                initialValue={formData.revised_phd_title}
                label={"Revised Title of Phd Thesis"}
                isLocked={lock}
                onChange={(value) => {
                  body.revised_phd_title = value;
                }}
              />,
            ]}
            space={2}
          />
         
          <GridContainer
          label="Revised PhD Objectives"
            elements={[
              <p></p>,
              <></>,
              <>
                {!lock  && (
                  <CustomButton text={"+ Add"} onClick={addObjective} />
                )}
              </>,
            ]}
          />

          <GridContainer
            elements={body.revised_phd_objectives?.map((objective, index) => {
              return (
                <InputField required={true}
                  initialValue={objective}
                  isLocked={lock }
                  onChange={(value) => {
                    body.revised_phd_objectives[index] = value;
      
                  }}
                  showLabel={false}
                />
              );
            })}
            space={1}
          />
          <GridContainer
          label="Revised IRB PDF File"
            elements={[
              <FileUploadField required={true}
                showLabel={false}
                initialValue={formData.revised_irb_pdf}
                isLocked={lock}
                onChange={(file) => {
                  setFiles([{ key: "irb_pdf", file }]);
                }}
              />,
            ]}
       
          />
             {/* {console.log(formData)}, */}
           <GridContainer
                elements={[
                  <DateField required={true}
                    label={"Date of IRB"}
                    initialValue={formatDate(formData.date_of_irb)}
                    hint={"Select Date..."}
                    isLocked={lock}
                    onChange={(value) => {
                      body.date_of_irb = value;
                    }}
                  />,
               
                  <DateField
                    label={"Date of IRB Revision"}
                    initialValue={formatDate(formData.created_at)}  
                    isLocked={true}
                  />,
                ]}
                space={1}
              />
   
          {!lock && formData.role === "student" && (
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
        </>
      )}
    </div>
  );
};

export default Student;
