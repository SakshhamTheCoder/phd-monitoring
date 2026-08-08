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

const Student = ({ formData }) => {
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData?.locks?.student);
  const [isLoaded, setIsLoaded] = useState(true);
  const location = useLocation();
  const { setLoading } = useLoading();
  const [showPublication, setShowPublication] = useState(false);
  const [temp, setTemp] = useState([]);
  const [files, setFiles] = useState([]);
  // The scholar's unlinked publication library, shown in the "Add Publications"
  // picker. Kept in state so a publication added from inside the picker appears
  // without reloading the page.
  const [studentPublications, setStudentPublications] = useState(
    formData.student_publications
  );

  useEffect(() => {
    setBody({
      sci: formData.sci,
      non_sci: formData.non_sci,
      patents: formData.patents,
      book: formData.book,
      national: formData.national,
      international: formData.international,
    });
    setLock(formData?.locks?.student);
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
  // The form GET returns both the publications linked to this form and the
  // scholar's unlinked library, so one call refreshes the page and the picker.
  const refetchPublications = () => {
    setLoading(true);
    return customFetch(baseURL + location.pathname, "GET")
      .then((data) => {
        if (data && data.success) {
          const formdata = data.response;
          setBody((prev) => ({
            ...prev,
            sci: formdata.sci,
            non_sci: formdata.non_sci,
            patents: formdata.patents,
            book: formdata.book,
            national: formdata.national,
            international: formdata.international,
          }));
          setStudentPublications(formdata.student_publications);
        }
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        toast.error("Could not refresh publications: " + error);
      });
  };

  const removePublication = (id, type) => {
    const tt = {
      publications: [],
      patents: [],
    };
    if (type === "patents") {
      tt.patents.push(id);
    } else {
      tt.publications.push(id);
    }
    setLoading(true);
    customFetch(baseURL + location.pathname + "/unlink", "POST", tt)
      .then((data) => {
        if (data && data.success) {
          refetchPublications();
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        setLoading(false);
        toast.error("Error in unlinking publications: " + error);
      });
  };

  const submitPublication = (data) => {
    // setBody((prev) => ({
    //     ...prev,
    //     ...temp,
    // }));
    let tt = {
      publications: [],
      patents: [],
    };

    Object.keys(temp).forEach((type) => {
      console.log("type", type);
      const selectedIds = temp[type];
      console.log("selectedIds", selectedIds);

      selectedIds.forEach((id) => {
        const targetType = type !== "patents" ? "publications" : "patents"; // Use targetType instead of modifying type
        console.log("id", id.id);
        tt[targetType].push(id.id);
      });
    });
    setLoading(true);
    customFetch(baseURL + location.pathname + "/link", "POST", tt)
      .then((data) => {
        if (data && data.success) {
          refetchPublications().then(closeModal);
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        setLoading(false);
        toast.error("Error in linking publications: " + error);
      });
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
        const publication = studentPublications?.[type]?.find(
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
              <InputField
                label="Date of Revised IRB"
                initialValue={formatDate(formData.date_of_irb)}
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
                label="Address of Correspondance"
                initialValue={formData.address}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField
                label="Title of Phd Thesis"
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
                label="Current Status"
                initialValue={
                  formData.current_status === "part-time"
                    ? "Part Time"
                    : "Full Time"
                }
                isLocked={true}
              />,
              <>
                {formData.previous_extension_date !== "NA" ? (
                  <InputField
                    label="Date of Change of Status"
                    initialValue={formatDate(formData.previous_extension_date)}
                    isLocked={true}
                  />
                ) : (
                  <InputField
                    label="Date of Change of Status"
                    initialValue={formData.previous_extension_date}
                    isLocked={true}
                  />
                )}
              </>,
            ]}
          />
          <GridContainer
            elements={[
              <DateField required={true}
                label="Date of Synopsis Presentation"
                initialValue={formData.date_of_synopsis}
                isLocked={lock}
                onChange={(value) => {
                  setBody((prev) => ({
                    ...prev,
                    date_of_synopsis: value,
                  }));
                }}
              />,

              <InputField required={true}
                label="Receipt Number"
                initialValue={formData.reciept_no}
                isLocked={lock}
                onChange={(value) => {
                  setBody((prev) => ({
                    ...prev,
                    reciept_no: value,
                  }));
                }}
              />,
              <DateField required={true}
                label="Date of Fee Submission"
                initialValue={formData.date_of_synopsis}
                isLocked={lock}
                onChange={(value) => {
                  setBody((prev) => ({
                    ...prev,
                    date_of_fee_submission: value,
                  }));
                }}
              />,
            ]}
          />
          <>
            {formData?.role === "student" && !lock && (
              <GridContainer
                elements={[
                  <>
                    <h1 style={{ fontSize: "24px", textAlign: "left" }}>
                      Publications
                    </h1>
                  </>,
                  <></>,
                  <CustomButton
                    text="Add Publications"
                    onClick={() => {
                      openModal();
                    }}
                  />,
                ]}
              />
            )}
            <GridContainer
              elements={[
                <ShowPublications
                  formData={body}
                  enableEdit={!lock}
                  enableDelete={!lock}
                  onDelete={removePublication}
                  refetchData={refetchPublications}
                />,
              ]}
              space={3}
            />
          </>

          <GridContainer
            elements={[
              <FileUploadField required={true}
                label={"Upload Thesis PDF"}
                onChange={(file) => {
                  setFiles((prev) => {
                    const updated = prev.filter((f) => f.key !== "thesis_pdf");
                    return [...updated, { key: "thesis_pdf", file }];
                  });
                }}
                isLocked={lock}
                initialValue={formData.thesis_pdf}
              />,
              <FileUploadField required={true}
                label={"Upload Fee Receipt"}
                onChange={(file) => {
                  setFiles((prev) => {
                    const updated = prev.filter((f) => f.key !== "fee_receipt");
                    return [...updated, { key: "fee_receipt", file }];
                  });
                }}
                isLocked={lock}
                initialValue={formData.fee_receipt}
              />,
            ]}
          />
          <CustomModal
            isOpen={open}
            onClose={closeModal}
            title={"Add Publication"}
            minHeight="200px"
            maxHeight="600px"
            minWidth="650px"
            maxWidth="700px"
            closeOnOutsideClick={false}
          >
            <ShowPublications
              formData={studentPublications}
              enableSelect={true}
              enableSubmit={true}
              onSelect={updateValue}
              onSubmit={submitPublication}
              refetchData={refetchPublications}
            />
          </CustomModal>
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
