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
    full_name: "",
    email: "",
    phone: "",
    department_id: "",
    designation: "",
    faculty_code: "",
    institution: "Thapar Institute of Engineering and Technology",
    website_link: "",
    area_of_specialization_id: "",
    expertise: "",
  });
  // Display name for the department field (InputSuggestions shows the name,
  // while formData.department_id holds the id sent to the backend).
  const [departmentName, setDepartmentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The broad area comes from the chosen department's list, so it reloads when
  // the department does. The signed-in admin's own department is irrelevant here.
  const [researchAreas, setResearchAreas] = useState([]);

  useEffect(() => {
    if (!formData.department_id) {
      setResearchAreas([]);
      return;
    }

    let cancelled = false;

    customFetch(
      `${baseURL}/departments/area-of-specialization?department_id=${formData.department_id}`,
      'GET',
      {},
      false
    ).then((response) => {
      if (cancelled || !response.success) return;
      const rows = response.response?.data || [];
      setResearchAreas(rows.map((area) => ({ title: area.name, value: area.id })));
    });

    return () => {
      cancelled = true;
    };
  }, [formData.department_id]);

  useEffect(() => {
    if (edit && facultyData) {
      const exp = Array.isArray(facultyData.expertise) ? facultyData.expertise.join(', ') : facultyData.expertise || "";
      const fullName = [facultyData.first_name, facultyData.last_name]
        .map((p) => (p || '').trim())
        .filter(Boolean)
        .join(' ');
      setFormData({
        full_name: facultyData.name || fullName,
        email: facultyData.email || "",
        phone: facultyData.phone || "",
        department_id: facultyData.department_id || "",
        designation: facultyData.designation || "",
        faculty_code: facultyData.faculty_code || "",
        institution: facultyData.institution || "Thapar Institute of Engineering and Technology",
        website_link: facultyData.website_link || "",
        area_of_specialization_id: facultyData.area_of_specialization_id || "",
        expertise: exp,
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
    const isExternalEdit = edit && facultyData.type === 'external';
    if (!formData.full_name.trim()) return "Full Name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (!formData.phone.trim()) return "Phone is required.";
    if (!formData.designation.trim()) return "Designation is required.";
    if (!isExternalEdit && !formData.department_id) return "Department is required.";
    if (!isExternalEdit && !formData.faculty_code.trim()) return "Faculty Code is required.";
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
        // The server no longer hands back a generated password: a new faculty
        // account is mailed a link and chooses its own.
        toast.success(res.response?.message || "Faculty added.");
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
            label="Full Name*"
            initialValue={formData.full_name}
            onChange={(val) => handleChange("full_name", val)}
            placeholder="e.g. Dr. Tarunpreet Bhatia"
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
          <InputSuggestions
            label="Department*"
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
            onChange={(val) => handleChange("designation", val)}

          />,
        ]}
      />
      <GridContainer
        elements={[
          <InputField
            label="Faculty Code*"
            initialValue={formData.faculty_code}
            onChange={(val) => handleChange("faculty_code", val)}
          />,
        ]}
      />
      {edit && facultyData.type === 'external' && (
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
          <DropdownField
            label="Broad Area of Expertise"
            options={researchAreas}
            initialValue={formData.area_of_specialization_id}
            onChange={(val) => handleChange("area_of_specialization_id", val)}
          />,
        ]}
      />
      <GridContainer
        elements={[
          <InputField
            label="Specific Areas under Broad Area (comma separated)"
            initialValue={formData.expertise}
            onChange={(val) => handleChange("expertise", val)}
            placeholder="e.g., Machine Learning, Data Mining, Cyber Security"
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
