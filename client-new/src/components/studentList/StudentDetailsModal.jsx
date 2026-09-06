import React from "react";
import CustomModal from "../forms/modal/CustomModal";
import GridContainer from "../forms/fields/GridContainer";
import InputField from "../forms/fields/InputField";
import DateField from "../forms/fields/DateField";
import { formatDate } from "../../utils/timeParse";

const StudentDetailsModal = ({ formData, isOpen, onClose }) => {
  if (!formData) return null;

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Student Details">
      <div className="student-details-container">
        <GridContainer
          elements={[
            <InputField label="Roll Number" initialValue={formData.roll_no} isLocked />,
            <InputField label="Name" initialValue={formData.name} isLocked />,
          ]}
        />

        <GridContainer
          elements={[
            <InputField label="Date Of Admission" initialValue={formatDate(formData.date_of_registration)} isLocked />,
            <InputField label="Department" initialValue={formData.department} isLocked />,
            <InputField label="CGPA" initialValue={formData.cgpa} isLocked />,
          ]}
        />

        <GridContainer
          elements={[
            <InputField label="Email" initialValue={formData.email} isLocked />,
            <InputField label="Phone" initialValue={formData.phone} isLocked />,
          ]}
        />

        <GridContainer
          elements={[
            <InputField label="Previous PhD Title" initialValue={formData.phd_title} isLocked />,
            <InputField label="Revised PhD Title" initialValue={formData.revised_phd_title} isLocked />,
          ]}
        />

        <GridContainer
          label="Revised PhD Objectives"
          space={2}
          elements={(formData.revised_phd_objectives || []).map((obj, i) => (
            <InputField key={i} initialValue={obj} showLabel={false} isLocked />
          ))}
        />

        {/* Optional: Add fallback if no objectives */}
        {(!formData.revised_phd_objectives || formData.revised_phd_objectives.length === 0) && (
          <div style={{ margin: "10px 0", color: "#777" }}>
            No revised PhD objectives provided.
          </div>
        )}

        <GridContainer
          elements={[
            <DateField
              label="Date of IRB"
              initialValue={formatDate(formData.date_of_irb)}
              isLocked
            />,
          ]}
        />
      </div>
    </CustomModal>
  );
};

export default StudentDetailsModal;
