import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import InputField from "../forms/fields/InputField";
import GridContainer from "../forms/fields/GridContainer";
import CustomButton from "../forms/fields/CustomButton";
import DropdownField from "../forms/fields/DropdownField";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";

const ClerkForm = ({ onSuccess, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [clerkRoleId, setClerkRoleId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    status: "active",
    password: "",
  });

  useEffect(() => {
    customFetch(baseURL + "/roles", "GET").then((res) => {
      const clerk = (res.response || []).find((r) => r.role === "clerk");
      if (clerk) setClerkRoleId(clerk.id);
    }).catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const missing = [];
    if (!formData.first_name.trim()) missing.push("First Name");
    if (!formData.email.trim()) missing.push("Email");
    if (!formData.phone.trim()) missing.push("Phone");
    if (missing.length > 0) {
      toast.error("Please fill required fields: " + missing.join(", "));
      return;
    }
    if (!clerkRoleId) {
      toast.error("Clerk role not found. Run migrations first.");
      return;
    }

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name || " ",
      email: formData.email,
      phone: formData.phone,
      gender: formData.gender || null,
      role_id: clerkRoleId,
      current_role_id: clerkRoleId,
      default_role_id: clerkRoleId,
      available_roles: ["clerk"],
      status: formData.status || "active",
    };
    if (formData.password) payload.password = formData.password;

    setSubmitting(true);
    try {
      const res = await customFetch(baseURL + "/users", "POST", payload, true);
      if (res.success !== false) {
        if (res.password) {
          toast.success("Clerk created. Temporary Password: " + res.password);
        } else {
          toast.success("Clerk created successfully");
        }
        (res.warnings || []).forEach((w) => toast.warn(w, { autoClose: 10000 }));
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
        elements={[<div className="form-title">Create Clerk</div>]}
      />
      <p className="modal-note" style={{ marginTop: 0 }}>
        A clerk has no student or faculty record. Departments are tagged afterwards from this page.
      </p>
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
            label="Gender"
            initialValue={formData.gender}
            options={[
              { title: "Male", value: "Male" },
              { title: "Female", value: "Female" },
            ]}
            onChange={(val) => handleChange("gender", val)}
          />,
          <DropdownField
            label="Status"
            initialValue={formData.status}
            options={[
              { value: "active", title: "Active" },
              { value: "inactive", title: "Inactive" },
              { value: "suspended", title: "Suspended" },
            ]}
            onChange={(val) => handleChange("status", val)}
          />,
        ]}
      />
      <GridContainer
        elements={[
          <InputField
            label="Custom Password (Optional, min 8 characters)"
            type="password"
            initialValue={formData.password}
            onChange={(val) => handleChange("password", val)}
          />,
        ]}
      />
      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
        Leave empty to auto-generate a password.
      </p>
      <GridContainer
        elements={[
          <CustomButton
            text={submitting ? "Adding..." : "Add Clerk"}
            onClick={handleSubmit}
            disabled={submitting}
          />,
        ]}
      />
    </>
  );
};

export default ClerkForm;
