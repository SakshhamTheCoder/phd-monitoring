import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import InputField from "../forms/fields/InputField";
import GridContainer from "../forms/fields/GridContainer";
import CustomButton from "../forms/fields/CustomButton";
import DropdownField from "../forms/fields/DropdownField";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import { apiRoleList } from "../../api/lookups";

const ClerkForm = ({ onSuccess, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [clerkRoleId, setClerkRoleId] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    status: "active",
    password: "",
  });

  useEffect(() => {
    apiRoleList().then((res) => {
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
    if (!formData.full_name.trim()) missing.push("Full Name");
    if (!formData.email.trim()) missing.push("Email");
    if (!formData.phone.trim()) missing.push("Phone");
    if (missing.length > 0) {
      toast.error("Please fill required fields: " + missing.join(", "));
      return;
    }
    setSubmitting(true);
    try {
      // The role list may have failed to load when the form opened. Asking
      // again here tells "could not ask" apart from "the role does not exist".
      let roleId = clerkRoleId;
      if (!roleId) {
        const roles = await apiRoleList();
        // customFetch has already said why the request failed.
        if (!roles.success) return;
        roleId = (roles.response || []).find((r) => r.role === "clerk")?.id;
        if (!roleId) {
          toast.error("Clerk role not found. Run migrations first.");
          return;
        }
        setClerkRoleId(roleId);
      }

      const payload = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        gender: formData.gender || null,
        role_id: roleId,
        current_role_id: roleId,
        default_role_id: roleId,
        available_roles: ["clerk"],
        status: formData.status || "active",
      };
      if (formData.password) payload.password = formData.password;

      const res = await customFetch(baseURL + "/users", "POST", payload, true);
      if (res.success !== false) {
        // The password and warnings are in the server's answer, not the wrapper.
        const saved = res.response || {};
        if (saved.password) {
          toast.success("Clerk created. Password: " + saved.password);
        } else {
          toast.success("Clerk created. They are emailed a link to set their password.");
        }
        (saved.warnings || []).forEach((w) => toast.warn(w, { autoClose: 10000 }));
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
        Leave empty and they are emailed a link to set their own.
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
