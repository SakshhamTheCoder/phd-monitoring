import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import FormList from "../../components/forms/formList/FormList";
import { Tabs, Tab } from "@mui/material";
import CustomModal from "../../components/forms/modal/CustomModal";
import CustomButton from "../../components/forms/fields/CustomButton";
import GridContainer from "../../components/forms/fields/GridContainer";
import BulkSchedulePresentation from "../../components/forms/presentations/BulkSchedulePresentation";
import SchedulePresentation from "../../components/forms/presentations/SchedulePresentation";
import FormTable from "../../components/forms/formTable/FormTable";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import SemesterStatsCard from "./SemsterStatsCard";
import InputField from "../../components/forms/fields/InputField";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ToggleSwitch from "../../components/forms/fields/ToggleSwitch";
import FileUploadField from "../../components/forms/fields/FileUploadField";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import { toast } from "react-toastify";
import { set } from "react-hook-form";

const PresentationSemester = () => {
  const [role, setRole] = useState("");
  const [open, setOpen] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [location, setLocation] = useState(window.location.pathname);
  const [editForm, setEditForm] = useState({
    semester_name: "",
    start_date: null,
    end_date: null,
    notification: false,
    ppt_file: null,
  });
  

  useEffect(() => {
    setRole(localStorage.getItem("userRole"));
  }, []);

  const handleEditClick = async (semester) => {
    try {
      const res = await customFetch(`${baseURL}/semester/${semester.semester_name}`, "GET", {}, false);
      const data = res.response?.data || res.data;
      setEditForm({
        semester_name: data.semester_name,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        notification: data.notification || false,
        ppt_file: data.ppt_file || null,
      });
      setOpenEditModal(true);
    } catch (error) {
      console.error("Error fetching semester data:", error);
      toast.error("Failed to load semester data");
    }
  };

  const handleEditSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append('semester_name', editForm.semester_name);
      formData.append('start_date', editForm.start_date);
      formData.append('end_date', editForm.end_date);
      formData.append('notification', editForm.notification);
      
      if (editForm.ppt_file && editForm.ppt_file instanceof File) {
        formData.append('ppt_file', editForm.ppt_file);
      }

      let response = await customFetch(
        baseURL + "/semester",
        "POST",
        formData,
        true,
        true
      );
      if (response.success) {
        toast.success("Semester updated successfully!");
      }

      setOpenEditModal(false);
      window.location.reload();
    } catch (err) {
      console.error("PUT error:", err);
    }
  };


 
  return (
    <Layout
      children={
        <>
         <SemesterStatsCard />
         <PagenationTable
            endpoint={location}
            enableApproval={false}
            enableSelect={false}
            tableTitle="Past Semesters"
            customOpenForm={(semester) => {
                window.location.href=location+`/semester/${semester.semester_name}`;
            }}
            actions={(role === "admin" || role === "dordc") ? [
              {
                icon: "✏️",
                tooltip: "Edit Semester",
                onClick: handleEditClick,
              },
            ] : []}
          />

          {(role === "admin" || role === "dordc") && (
            <CustomModal
              isOpen={openEditModal}
              onClose={() => setOpenEditModal(false)}
              title="Edit Semester Deadline"
              minWidth="300px"
              minHeight="300px"
            >
              <GridContainer
                elements={[
                  <InputField
                    label="Period of Report"
                    isLocked={true}
                    initialValue={editForm.semester_name}
                  />,
                ]}
                space={2}
              />

              <label>Evaluation Start Date:</label>
              <DatePicker
                selected={editForm.start_date}
                readOnly
                disabled
                className="field-readonly"
              />

              <label>Evaluation End Date:</label>
              <DatePicker
                selected={editForm.end_date}
                onChange={(date) => setEditForm({ ...editForm, end_date: date })}
                className="field-editable"
              />

              <label>Notification:</label>
              <ToggleSwitch
                isOn={editForm.notification}
                onToggle={() =>
                  setEditForm((prev) => ({
                    ...prev,
                    notification: !prev.notification,
                  }))
                }
              />

              <FileUploadField
                label="Sample PPT Template (Optional)"
                initialValue={editForm.ppt_file}
                isLocked={false}
                onChange={(file) => setEditForm({ ...editForm, ppt_file: file })}
                showLabel={true}
                acceptedTypes=".ppt,.pptx"
                maxSizeMB={15}
                fileTypeLabel="PPT/PPTX"
              />

              <div style={{ textAlign: "right", marginTop: "10px" }}>
                <CustomButton onClick={handleEditSubmit} text="Save Changes" />
              </div>
            </CustomModal>
          )}
        </>
      }
    />
    
  );
};

export default PresentationSemester;
