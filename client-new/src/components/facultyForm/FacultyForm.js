import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import InputField from "../forms/fields/InputField";
import GridContainer from "../forms/fields/GridContainer";
import CustomButton from "../forms/fields/CustomButton";
import InputSuggestions from "../forms/fields/InputSuggestions";
import DropdownField from "../forms/fields/DropdownField";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";

const FacultyForm = ({ edit = false, facultyData = {}, onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    department_id: "",
    designation: "",
    faculty_code: "",
    type: "internal",
    institution: "Thapar Institute of Engineering and Technology",
    website_link: "",
  });
  // Display name for the department field (InputSuggestions shows the name,
  // while formData.department_id holds the id sent to the backend).
  const [departmentName, setDepartmentName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (edit && facultyData) {
      setFormData({
        first_name: facultyData.first_name || "",
        last_name: facultyData.last_name || "",
        email: facultyData.email || "",
        phone: facultyData.phone || "",
        department_id: facultyData.department_id || "",
        designation: facultyData.designation || "",
        faculty_code: facultyData.faculty_code || "",
        type: facultyData.type || "internal",
        institution: facultyData.institution || "Thapar Institute of Engineering and Technology",
        website_link: facultyData.website_link || "",
      });
      setDepartmentName(facultyData.department || "");
    }
  }, [edit, facultyData]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validate = () => {
    if (!formData.first_name.trim()) return "First Name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (!formData.phone.trim()) return "Phone is required.";
    if (!formData.designation.trim()) return "Designation is required.";
    if (!formData.type) return "Faculty Type is required.";
    if (formData.type === "internal") {
      if (!formData.department_id) return "Department is required.";
      if (!formData.faculty_code.trim()) return "Faculty Code is required.";
    }
    if (formData.type === "external" && !formData.institution.trim()) {
      return "Institution is required.";
    }
    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const endpoint = edit
      ? baseURL + `/faculty/update/${facultyData.id}`
      : baseURL + "/faculty/add";

    const method = edit ? "PUT" : "POST";

    setSubmitting(true);
    const res = await customFetch(endpoint, method, formData);
    setSubmitting(false);

    if (res.success) {
      if (!edit) {
        toast.success(
          "Faculty created. Temporary Password: " + res.response.password
        );
      } else {
        toast.success("Faculty updated successfully.");
      }
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    }
  };

  return (
    <>
      <GridContainer
        space={3}
        elements={[
          <div className="form-title">
            {!edit ? "Create " : "Edit "}Faculty Form
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
            label="Last Name"
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
          <DropdownField
            label="Faculty Type*"
            initialValue={formData.type}
            options={[
              { value: "internal", title: "Internal" },
              { value: "external", title: "External" },
            ]}
            onChange={(val) => handleChange("type", val)}
          />,
        ]}
      />
      <GridContainer
        elements={[
          <InputSuggestions
            label={formData.type === "internal" ? "Department*" : "Department"}
            initialValue={departmentName}
            onSelect={(val) => {
              handleChange("department_id", val.id);
              setDepartmentName(val.name);
            }}
            apiUrl={baseURL + "/suggestions/department"}
          />,
          <InputField
            label="Designation*"
            initialValue={formData.designation}
            onChange={(val) => {console.log(val);handleChange("designation", val)}}
     
          />,
        ]}
      />
      {formData.type === "internal" && (
        <GridContainer
          elements={[
            <InputField
              label="Faculty Code*"
              initialValue={formData.faculty_code}
              onChange={(val) => handleChange("faculty_code", val)}
            />,
          ]}
        />
      )}
      {formData.type === "external" && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Institution*"
                initialValue={formData.institution}
                onChange={(val) => handleChange("institution", val)}
              />,
            ]}
          />
          <GridContainer
            elements={[
              <InputField
                label="Website Link"
                initialValue={formData.website_link}
                onChange={(val) => handleChange("website_link", val)}
                placeholder="https://example.com"
              />,
            ]}
          />
        </>
      )}
      <GridContainer
        elements={[
          <CustomButton
            text={
              submitting
                ? edit
                  ? "Updating..."
                  : "Adding..."
                : edit
                ? "Update Faculty"
                : "Add Faculty"
            }
            onClick={handleSubmit}
            disabled={submitting}
          />,
        ]}
      />
    </>
  );
};

export default FacultyForm;
