import { useEffect, useState } from "react";
import CustomButton from "../fields/CustomButton";
import GridContainer from "../fields/GridContainer";
import InputField from "../fields/InputField";

const AddExaminer = ({ data, onSubmit }) => {
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
            <GridContainer
                elements={[
                    <></>,
                    <></>,
                    <CustomButton
                        text={"Add Examiner"}
                        onClick={() => onSubmit(formData)}
                    />,
                ]}
            />
        </div>
    );
};

export default AddExaminer;
