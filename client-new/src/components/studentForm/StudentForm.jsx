import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import InputField from "../forms/fields/InputField";
import GridContainer from "../forms/fields/GridContainer";
import CustomButton from "../forms/fields/CustomButton";
import { customFetch } from "../../api/base";

import InputSuggestions from "../forms/fields/InputSuggestions";
import { baseURL } from "../../api/urls";
import DateField from "../forms/fields/DateField";
import DropdownField from "../forms/fields/DropdownField";

const StudentForm = ({ edit = false, studentData = {}, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [departmentName, setDepartmentName] = useState("");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    roll_no: "",
    department_id: "",
    date_of_registration: "",
    date_of_irb: "",
    date_of_thesis: "",
    phd_title: "",
    fathers_name: "",
    address: "",
    current_status: "",
    gender: "",
    overall_progress: 0,
    cgpa: "",
  });

  useEffect(() => {
    if (edit && studentData) {
      setFormData({
        first_name: studentData.first_name || "",
        last_name: studentData.last_name || "",
        phone: studentData.phone || "",
        email: studentData.email || "",
        roll_no: studentData.roll_no || "",
        department_id: studentData.department_id || "",
        date_of_registration: studentData.date_of_registration || "",
        date_of_irb: studentData.date_of_irb || "",
        date_of_thesis: studentData.date_of_thesis || "",
        phd_title: studentData.phd_title || "",
        fathers_name: studentData.fathers_name || "",
        address: studentData.address || "",
        current_status: studentData.current_status || "",
        // Exclude legacy null / invalid gender values so the dropdown shows "Select"
        // instead of a broken option, forcing the admin to pick a valid one.
        gender: ["Male", "Female"].includes(studentData.gender) ? studentData.gender : "",
        overall_progress: studentData.overall_progress || 0,
        cgpa: studentData.cgpa || "",
      });
      setDepartmentName(studentData.department || "");
    }
  }, [edit, studentData]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Basic required-field validation
    const required = [
      ["first_name", "First Name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["roll_no", "Roll Number"],
      ["gender", "Gender"],
    ];
    const missing = required
      .filter(([field]) => !String(formData[field] ?? "").trim())
      .map(([, label]) => label);
    if (missing.length > 0) {
      toast.error("Please fill required fields: " + missing.join(", "));
      return;
    }

    const endpoint = edit
      ? baseURL + `/students/${formData.roll_no}/update`
      : baseURL + "/students/add";

    setSubmitting(true);
    try {
      const res = await customFetch(endpoint, "POST", formData);
      if (res.success) {
        if (!edit) {
          toast.success("Student created. Temporary Password: " + res.response);
        } else {
          toast.success("Student updated successfully.");
        }
        if (onSuccess) onSuccess();
        else if (onClose) onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <GridContainer
        space={3}
        elements={[
          <div className="form-title">
            {" "}
            {!edit ? <>Create </> : <>Edit </>}Student Form
          </div>,
        ]}
      />
      <GridContainer
        elements={[
          <InputField
            label="First Name*"
            initialValue={formData.first_name}
            onChange={(val) => handleChange("first_name", val)}
          />,
          <InputField
            label="Last Name*"
            initialValue={formData.last_name}
            onChange={(val) => handleChange("last_name", val)}
          />,
        ]}
      />
      <GridContainer
        elements={[
          <InputField
            label="Email*"
            initialValue={formData.email}
            onChange={(val) => handleChange("email", val)}
          />,
          <InputField
            label="Phone*"
            initialValue={formData.phone}
            onChange={(val) => handleChange("phone", val)}
          />,
        ]}
        space={2}
        ratio={[2, 1]}
      />

      <GridContainer
        elements={[
          <InputField
            label="Roll Number*"
            initialValue={formData.roll_no}
            isLocked={edit}
            onChange={(val) => handleChange("roll_no", val)}
          />,
          <InputSuggestions
            label="Department*"
            initialValue={departmentName}
            onSelect={(val) => { handleChange("department_id", val.id); setDepartmentName(val.name || ""); }}
            apiUrl={baseURL + "/suggestions/department"}
          />,
        ]}
      />
      <GridContainer
        elements={[
          <DateField
            label="Date of Registration*"
            initialValue={formData.date_of_registration}
            onChange={(val) => handleChange("date_of_registration", val)}
          />,
          <DateField
            label="Date of IRB"
            initialValue={formData.date_of_irb}
            onChange={(val) => handleChange("date_of_irb", val)}
          />,
          <DropdownField
            label={"Gender"}
            required={true}
            initialValue={formData.gender}
            onChange={(val) => handleChange("gender", val)}
            options={[
              { title: "Male", value: "Male" },
              { title: "Female", value: "Female" },
            ]}
          />,
        ]}
      />
      <GridContainer
        elements={[
          <DateField
            label="Date of Thesis"
            initialValue={formData.date_of_thesis}
            onChange={(val) => handleChange("date_of_thesis", val)}
          />,
        ]}
      />
      <GridContainer
        space={3}
        elements={[
          <InputField
            label="PhD Title"
            initialValue={formData.phd_title}
            onChange={(val) => handleChange("phd_title", val)}
          />,
          <InputField
            label="Father's Name"
            initialValue={formData.fathers_name}
            onChange={(val) => handleChange("fathers_name", val)}
          />,
          <InputField
            label="Address"
            initialValue={formData.address}
            onChange={(val) => handleChange("address", val)}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <DropdownField
            label={"Current Status*"}
            initialValue={formData.current_status}
            onChange={(val) => handleChange("current_status", val)}
            options={[
              { title: "Full Time", value: "full-time" },
              { title: "Part Time", value: "part-time" },
              {title: "Executive", value: "executive"},
            ]}
          />,
          <InputField
            label="Overall Progress (%)"
            type="number"
            initialValue={formData.overall_progress}
            onChange={(val) => handleChange("overall_progress", val)}
          />,
          <InputField
            label="CGPA*"
            type="number"
            initialValue={formData.cgpa}
            onChange={(val) => handleChange("cgpa", val)}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <CustomButton
            text={
              submitting
                ? edit
                  ? "Updating..."
                  : "Adding..."
                : edit
                ? "Update Student"
                : "Add Student"
            }
            onClick={handleSubmit}
            disabled={submitting}
          />,
        ]}
      />
    </>
  );
};

export default StudentForm;
