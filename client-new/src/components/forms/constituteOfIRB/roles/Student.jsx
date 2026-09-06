import { useEffect, useState } from "react";
import { formatDate } from "../../../../utils/timeParse";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import DropdownField from "../../fields/DropdownField";
import InputSuggestions from "../../fields/InputSuggestions";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { resolvePath, useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import FileUploadField from "../../fields/FileUploadField";
import TableComponent from "../../table/TableComponent";
import { customFetch } from "../../../../api/base";
import { baseURL } from "../../../../api/urls";
import { toast } from "react-toastify";

const Student = ({ formData }) => {
  const [lock, setLock] = useState(formData.locks?.student);
  const [body, setBody] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [files, setFiles] = useState([]);
  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    setLock(formData.locks?.student);
    setBody({
      cgpa: formData.cgpa,
      address: formData.address,
      gender: formData.gender,
      title: formData.phd_title,
      objectives: formData.objectives ? formData.objectives : [],
      broad_area_of_research: formData.broad_area_of_research || null,
      subdomains: formData.subdomains ? formData.subdomains : [],
    });
    setIsLoaded(true);
  }, [formData]);

  const addObjective = () => {
    setBody((prevBody) => ({
      ...prevBody,
      objectives: [...prevBody.objectives, ""],
    }));
  };
  const addSubdomain = () => {
    setBody((prevBody) => ({
      ...prevBody,
      subdomains: [...(prevBody.subdomains || []), ""],
    }));
  };
  const onUpdateCGPA = (value) => {
    body.cgpa = value;
  };

  return (
    <>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label={"Date of Form Submission"}
                initialValue={formatDate(formData.created_at)}
                isLocked={true}
              />,
              <InputField
                label={"Date of Admission"}
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label={"Roll Number"}
                initialValue={formData.roll_no}
                isLocked={true}
              />,
              <InputField
                label={"Name"}
                initialValue={formData.name}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label={"Department"}
                initialValue={formData.department}
                isLocked={true}
              />,
              <DropdownField required={true}
                label={"Gender"}
                initialValue={formData.gender}
                options={[
                  { title: "Male", value: "Male" },
                  { title: "Female", value: "Female" },
                ]}
                isLocked={lock}
                onChange={(value) => {
                  console.log("hi", body);
                  body.gender = value;
                }}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label={"Chairman, Board of Studies of the Concerned Department"}
                initialValue={formData.chairman.name}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={formData.supervisors?.map((supervisor, index) => (
              <InputField
                label={`Supervisor ${index + 1}`}
                initialValue={supervisor?.name}
                isLocked={true}
              />
            ))}
          />
          <GridContainer
            elements={[
              <InputField required={true}
                label={"CGPA"}
                initialValue={formData.cgpa}
                isLocked={lock}
                onChange={onUpdateCGPA}
              />,
            ]}
          />
          <GridContainer
            elements={[
              <InputField required={true}
                initialValue={formData.address}
                label={"Address of Correspondence"}
                isLocked={lock}
                onChange={(value) => {
                  body.address = value;
                }}
              />,
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputField required={true}
                initialValue={formData.phd_title}
                label={"Title of Phd Thesis"}
                isLocked={lock}
                onChange={(value) => {
                  console.log("hi", body);
                  body.title = value;
                }}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputSuggestions required={true}
                label={"Broad Area of Research"}
                initialValue={formData.broad_area_of_research}
                apiUrl={baseURL + "/suggestions/specialization"}
                onSelect={(value) => {
                  body.broad_area_of_research = value.name;
                }}
                lock={lock}
                suggestionManadatory={false}
                hint="Type your broad area of research"
              />,
            ]}
            space={2}
          />

          <GridContainer
            label={[<p>Objectives of Research</p>]}
            elements={[
              <></>,
              <></>,
              <>
                {!lock && (
                  <CustomButton text={"+ Add"} onClick={addObjective} />
                )}
              </>,
            ]}
          />
          {formData.role == "student" ? (
            <GridContainer
              elements={body.objectives?.map((objective, index) => (
                <InputField required={true}
                  initialValue={objective}
                  isLocked={lock}
                  onChange={(value) => {
                    body.objectives[index] = value;
                  }}
                  hint={`Enter Objective ${index + 1} Here`}
                  showLabel={false}
                />
              ))}
              space={2}
            />
          ) : (
            <>
              {console.log(formData.objectives)}
              <GridContainer
                elements={[
                  <TableComponent
                    data={formData.objectives.map((obj) => ({
                      objective: obj,
                    }))}
                    keys={["objective"]}
                    titles={["Objective"]}
                  />,
                ]}
                space={2}
              />
            </>
          )}

          <GridContainer
            label={[<p>Subdomain</p>]}
            elements={[
              <></>,
              <></>,
              <>
                {!lock && (
                  <CustomButton text={"+ Add"} onClick={addSubdomain} />
                )}
              </>,
            ]}
          />
          {formData.role == "student" ? (
            <GridContainer
              elements={(body.subdomains || []).map((keyword, index) => (
                <InputSuggestions
                  initialValue={keyword}
                  apiUrl={baseURL + "/suggestions/subdomain"}
                  onSelect={(value) => {
                    body.subdomains[index] = value.name;
                  }}
                  lock={lock}
                  suggestionManadatory={false}
                  showLabel={false}
                  hint={`Enter keyword ${index + 1}`}
                />
              ))}
              space={2}
            />
          ) : (
            <GridContainer
              elements={[
                <TableComponent
                  data={(formData.subdomains || []).map((k) => ({
                    keyword: k,
                  }))}
                  keys={["keyword"]}
                  titles={["Subdomain"]}
                />,
              ]}
              space={2}
            />
          )}

          <GridContainer
            label="Upload IRB PDF File"
            elements={[
              <FileUploadField required={true}
                initialValue={formData.irb_pdf}
                showLabel={false}
                isLocked={lock || formData.form_type === "revised"}
                onChange={(file) => {
                  setFiles([{ key: "irb_pdf", file }]);
                }}
              />,
            ]}
          />

          {formData.role === "student" && !lock && (
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
    </>
  );
};
export default Student;
