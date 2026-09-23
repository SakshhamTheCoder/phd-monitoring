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
import ToggleSwitch from "../forms/fields/ToggleSwitch";
import { toDateValue } from "../../utils/timeParse";

// The profile sends these dates as UTC timestamps, 18:30 the day before for a
// server on IST. Kept raw, an untouched field was saved back as that earlier
// day, so every edit moved it one day. Read it in local time instead.
const dateOnly = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : toDateValue(parsed);
};

// Yes, No, or "" for not stated. A null is a scholar nobody has asked, and
// turning it into No would claim an answer nobody gave.
const jrfValue = (value) => (value === null || value === undefined || value === "" ? "" : value ? "1" : "0");

const StudentForm = ({ edit = false, studentData = {}, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [departmentName, setDepartmentName] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    roll_no: "",
    department_id: "",
    date_of_registration: "",
    date_of_irb: "",
    date_of_synopsis: "",
    date_of_thesis: "",
    date_of_thesis_awarded: "",
    phd_title: "",
    fathers_name: "",
    address: "",
    current_status: "",
    gender: "",
    physically_handicapped: false,
    is_jrf: "",
    net_gate: "",
    overall_progress: 0,
    cgpa: "",
  });

  useEffect(() => {
    if (edit && studentData) {
      setFormData({
        full_name: studentData.full_name || [studentData.first_name, studentData.last_name].filter(Boolean).join(' ') || "",
        phone: studentData.phone || "",
        email: studentData.email || "",
        roll_no: studentData.roll_no || "",
        department_id: studentData.department_id || "",
        date_of_registration: dateOnly(studentData.date_of_registration),
        date_of_irb: dateOnly(studentData.date_of_irb),
        date_of_synopsis: dateOnly(studentData.date_of_synopsis),
        date_of_thesis: dateOnly(studentData.date_of_thesis),
        date_of_thesis_awarded: dateOnly(studentData.date_of_thesis_awarded),
        phd_title: studentData.phd_title || "",
        fathers_name: studentData.fathers_name || "",
        address: studentData.address || "",
        current_status: studentData.current_status || "",
        // Exclude legacy null / invalid gender values so the dropdown shows "Select"
        // instead of a broken option, forcing the admin to pick a valid one.
        gender: ["Male", "Female"].includes(studentData.gender) ? studentData.gender : "",
        physically_handicapped: !!studentData.physically_handicapped,
        is_jrf: jrfValue(studentData.is_jrf),
        net_gate: studentData.net_gate || "",
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
      ["full_name", "Full Name"],
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
      const res = await customFetch(endpoint, "POST", {
        ...formData,
        is_jrf: formData.is_jrf === "" ? null : formData.is_jrf === "1",
      });
      if (res.success) {
        if (!edit) {
          // The server mails the new account a link to set its own password.
          toast.success(res.response?.message || "Student added.");
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
      <h2 className="modal-title">{edit ? "Edit student" : "Create student"}</h2>
      <GridContainer
        elements={[
          <InputField
            label="Full Name*"
            initialValue={formData.full_name}
            onChange={(val) => handleChange("full_name", val)}
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
        space={3}
        elements={[
          <DateField
            label="Date of Synopsis"
            initialValue={formData.date_of_synopsis}
            onChange={(val) => handleChange("date_of_synopsis", val)}
          />,
          <DateField
            label="Date of Thesis"
            initialValue={formData.date_of_thesis}
            onChange={(val) => handleChange("date_of_thesis", val)}
          />,
          <DateField
            label="Date of Thesis Awarded"
            initialValue={formData.date_of_thesis_awarded}
            onChange={(val) => handleChange("date_of_thesis_awarded", val)}
          />,
        ]}
      />
      <GridContainer
        space={3}
        elements={[
          <ToggleSwitch
            label="Physically handicapped"
            isOn={formData.physically_handicapped}
            onToggle={() => handleChange("physically_handicapped", !formData.physically_handicapped)}
          />,
          <DropdownField
            label="JRF"
            initialValue={formData.is_jrf}
            options={[
              { value: "1", title: "Yes" },
              { value: "0", title: "No" },
            ]}
            onChange={(value) => handleChange("is_jrf", value)}
          />,
          // Which exam, not yes or no. An imported value the list does not
          // name (DBT-BET, GPAT) still shows and is kept.
          <DropdownField
            label="NET/GATE"
            initialValue={formData.net_gate}
            options={[
              { value: "NET", title: "NET" },
              { value: "GATE", title: "GATE" },
              { value: "NA", title: "NA" },
            ]}
            onChange={(value) => handleChange("net_gate", value)}
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

      <div className="modal-actions">
        {onClose && <CustomButton text="Cancel" variant="quiet" onClick={onClose} />}
        <CustomButton
          text={edit ? "Update student" : "Add student"}
          onClick={handleSubmit}
          busy={submitting}
        />
      </div>
    </>
  );
};

export default StudentForm;
