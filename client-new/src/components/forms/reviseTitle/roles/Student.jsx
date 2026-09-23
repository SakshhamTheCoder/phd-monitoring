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

const Student = ({ formData }) => {
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData?.locks?.student);
  const [isLoaded, setIsLoaded] = useState(true);
  const location = useLocation();
  const { setLoading } = useLoading();
  const [showPublication, setShowPublication] = useState(false);
  const [temp, setTemp] = useState([]);
  const [files, setFiles] = useState([]);
  const objectivesData = (formData?.objectives || []).map((obj) => ({ objective: obj }));
  const robjectivesData = (formData?.revised_objectives || []).map((obj) => ({
    objective: obj,
  }));

  useEffect(() => {
    setBody({
       objectives:
        formData?.revised_objectives?.length > 0
          ? formData.revised_objectives
          : [""],
      revisedOBJ: formData?.revised_objectives?.length && formData?.locks?.student> 0?true:false
    });
    setLock(formData?.locks?.student);
    if (formData?.publication_count > 0 || formData?.patents?.length > 0) {
      setBody((prev) => ({
        ...prev,
        publication_under_report: true,
      }));
      setShowPublication(true);
    }
    setIsLoaded(true);
  }, []);

  const [open, setOpen] = useState(false);
  const openModal = () => {
    setOpen(true);
  };
  const closeModal = () => {
    setOpen(false);
  };
  const addObjective = () => {
    setBody((prevBody) => ({
      ...prevBody,
      objectives: [...prevBody.objectives, ""],
    }));
  };


  const updateValue = (selectedRows) => {
    const tt = {};

    Object.keys(selectedRows).forEach((type) => {
      // Get all selected IDs for the type
      const selectedIds = Object.keys(selectedRows[type]).filter(
        (id) => selectedRows[type][id] === true
      );

      selectedIds.forEach((id) => {
        if (!tt[type]) {
          tt[type] = [];
        }

        // Find the publication object with a matching id
        const publication = formData.student_publications?.[type]?.find(
          (pub) => pub.id === parseInt(id, 10)
        );

        if (publication) {
          tt[type].push(publication);
        }
      });
    });

    setTemp(tt);
  };
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
              <InputField
                label="Date of revised IRB"
                initialValue={formatDate(formData.date_of_irb)}
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
              <InputField
                label="Current status"
                initialValue={formData.current_status}
                isLocked={true}
              />,
            ]}
          />
          <GridContainer
            elements={[
              <InputField
                label="Address of correspondence"
                initialValue={formData.address}
                isLocked={true}
              />,
            ]}
            space={2}
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
          {formData.role === "student" && !lock && (
            <GridContainer
              elements={[
                <CustomButton
                  onClick={() => {
                    setBody((prev) => ({
                      ...prev,
                      revised: prev.revised === true ? false : true,
                    }));
                  }}
                  text={"Revise title of PhD"}
                  variant="secondary"
                />,
              ]}
            />
          )}

          {(body.revised || formData.revised_title) && (
            <GridContainer
              elements={[
                <InputField required={true}
                  label="Revised title of PhD thesis"
                  initialValue={formData.revised_title}
                  isLocked={lock}
                  onChange={(value) => {
                    setBody((prev) => ({
                      ...prev,
                      revised_title: value,
                    }));
                  }}
                />,
              ]}
              space={2}
            />
          )}

          <GridContainer
            elements={[
              <TableComponent
                label={"Objectives of research"}
                data={objectivesData}
                keys={["objective"]}
                titles={["Objective"]}
              />,
            ]}
            space={3}
          />

          {formData.role === "student" && !lock && (
            <GridContainer
              elements={[
                <CustomButton
                  onClick={() => {
                    setBody((prev) => ({
                      ...prev,
                      revisedOBJ: prev.revisedOBJ === true ? false : true,
                    }));
                  }}
                  text={"Revise objectives"}
                  variant="secondary"
                />,
              ]}
            />
          )}

          {body.revisedOBJ && (
            <>
              {!lock && formData.role === "student" ? (
                <>
                  <GridContainer
                    label="Revised objectives"
                    elements={[
                      <>
                        {!lock && formData.role === "student" && (
                          <CustomButton text="Add objective" variant="secondary" size="sm" onClick={addObjective} />
                        )}
                      </>,
                    ]}
                  />
                  <GridContainer
                    elements={body.objectives.map((objective, index) => {
                      return (
                        <InputField required={true}
                          initialValue={objective}
                          isLocked={lock || formData.form_type === "draft"}
                          onChange={(value) => {
                            body.objectives[index] = value;
                          }}
                          showLabel={false}
                        />
                      );
                    })}
                  />
                </>
              ) : (
                <GridContainer
                  elements={[
                    <TableComponent
                      label={"Approved objectives"}
                      data={robjectivesData}
                      keys={["objective"]}
                      titles={["Objective"]}
                    />,
                  ]}
                  space={3}
                />
              )}
            </>
          )}
                
         
        </>
      )}
      {formData?.role === "student" && !lock && (
        <>
          <GridContainer
            elements={[
              <CustomButton
                text="Submit"
                onClick={() => {
                  // An added box left empty has nothing to send, and the server refused a blank entry.
                  submitForm(
                    {
                      ...body,
                      objectives: (body.objectives || []).filter((text) => text?.trim()),
                    },
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
