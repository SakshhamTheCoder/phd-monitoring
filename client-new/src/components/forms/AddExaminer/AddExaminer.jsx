import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import CustomButton from "../fields/CustomButton";
import GridContainer from "../fields/GridContainer";
import InputField from "../fields/InputField";

// `existing` is every examiner already on the form, national and international,
// so the same person cannot be proposed twice.
const AddExaminer = ({ data, onSubmit, existing = [] }) => {
    const [formData, setFormData] = useState({
        name: data?.name || "",
        email: data?.email || "",
        institution: data?.institution || "",
        designation: data?.designation || "",
        department: data?.department || "",
        phone: data?.phone || "",
        recommendation: data?.recommendation || "pending",
    });

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSubmit = () => {
        const name = formData.name.trim();
        const email = formData.email.trim();
        if (!name || !email) {
            toast.error("Enter the examiner's name and email.");
            return;
        }
        if (existing.some((examiner) => (examiner.email || "").trim().toLowerCase() === email.toLowerCase())) {
            toast.error(`${email} is already on the list of examiners.`);
            return;
        }
        onSubmit({ ...formData, name, email });
    };

    return (
        <div>
            <GridContainer
                elements={[
                    <InputField required={true}
                        label={"Name"}
                        initialValue={formData.name}
                        isLocked={false}
                        onChange={(value) => handleInputChange("name", value)}
                    />,                    
                    <InputField required={true}
                        label={"Email"}
                        initialValue={formData.email}
                        isLocked={false}
                        onChange={(value) => handleInputChange("email", value)}
                    />,                    
                ]}
            />
            <GridContainer
                elements={[
                    <InputField required={true}
                        label={"Institution"}
                        initialValue={formData.institution}
                        isLocked={false}
                        onChange={(value) => handleInputChange("institution", value)}
                    />,
                    <InputField required={true}
                        label={"Designation"}
                        initialValue={formData.designation}
                        isLocked={false}
                        onChange={(value) => handleInputChange("designation", value)}
                    />,
                ]}
            />
            <GridContainer
                elements={[
                    <InputField required={true}
                        label={"Department"}
                        initialValue={formData.department}
                        isLocked={false}
                        onChange={(value) => handleInputChange("department", value)}
                    />,
                    <InputField required={true}
                        label={"Phone"}
                        initialValue={formData.phone}
                        isLocked={false}
                        onChange={(value) => handleInputChange("phone", value)}
                    />,
                ]}
            />
            <div className="modal-actions">
                <CustomButton
                    text={"Add examiner"}
                    onClick={handleSubmit}
                />
            </div>
        </div>
    );
};

export default AddExaminer;
