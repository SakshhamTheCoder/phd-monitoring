import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import PageHeader from '../../components/pageHeader/PageHeader';
import FormList from "../../components/forms/formList/FormList";
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
import UnifiedBulkImportModal from "../../components/bulkImport/UnifiedBulkImportModal";
import { column } from "../../components/bulkImport/columns";
import { set } from "react-hook-form";

const PresentationSemester = () => {
  const [role, setRole] = useState("");
  const [open, setOpen] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [location, setLocation] = useState(window.location.pathname);
  const [showProgressImport, setShowProgressImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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


 
  const PROGRESS_HEADERS = 'Registration Number,Progress for AY,Date of progress,Total Progress %';

  const progressSampleCsv = `${PROGRESS_HEADERS}
900011,2324ODD,2023-11-04,20
900011,2324EVEN,2024-04-18,35
900011,2425ODD,2024-11-06,55`;

  const handleProgressImport = async (preview, reset) => {
    setImporting(true);

    const rows = preview.data.map((row) => ({
      roll_no: column(row, 'Registration Number', 'roll_no'),
      semester: column(row, 'Progress for AY', 'Academic Year', 'semester'),
      date: column(row, 'Date of progress', 'Date', 'date'),
      total_progress: column(row, 'Total Progress %', 'Total Progress', 'total_progress'),
      row_number: row._rowNumber,
    })).filter((row) => row.roll_no && row.semester);

    const response = await customFetch(`${baseURL}/presentation/import-progress`, 'POST', { rows }, false);
    setImporting(false);

    if (!response.success) {
      toast.error(response.response?.message || 'Import failed');
      return;
    }

    const { success_count: imported = 0, skipped_count: skipped = 0, errors = [] } = response.response.data || {};
    toast.success(`${imported} evaluations imported, ${skipped} skipped`);
    errors.forEach((message) => toast.warn(message));

    reset();
    setShowProgressImport(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <Layout
      children={
        <>
          <PageHeader title="Progress Monitoring" subtitle="Evaluation semesters and their deadlines." />
         <SemesterStatsCard />
         <PagenationTable
            key={refreshKey}
            endpoint={location}
            enableApproval={false}
            enableSelect={false}
            tableTitle="Past Semesters"
            customOpenForm={(semester) => {
                window.location.href=location+`/semester/${semester.semester_name}`;
            }}
            extraTopbarComponents={
              (role === "admin" || role === "dordc") ? (
                <CustomButton text="Import Progress History" onClick={() => setShowProgressImport(true)} />
              ) : null
            }
            actions={(role === "admin" || role === "dordc") ? [
              {
                icon: "✏️",
                tooltip: "Edit Semester",
                onClick: handleEditClick,
              },
            ] : []}
          />

          <UnifiedBulkImportModal
            isOpen={showProgressImport}
            onClose={() => setShowProgressImport(false)}
            title="Import Progress History"
            formatString={PROGRESS_HEADERS}
            infoNodes={
              <>
                <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}>
                  One row per scholar per semester. The gain for each period is worked out
                  from the totals, so only the running total is needed.
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  Progress for AY is the semester code, for example 2425ODD.
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  A blank total means the evaluation has not happened yet, and a semester the
                  scholar already has a presentation for is left to its own workflow. Use Bulk
                  Schedule for the current semester.
                </p>
              </>
            }
            sampleFileName="progress_history_sample.csv"
            sampleCsvContent={progressSampleCsv}
            onImport={handleProgressImport}
            submitting={importing}
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

              <label className="input-label">Evaluation Start Date</label>
              <DatePicker
                selected={editForm.start_date}
                readOnly
                disabled
                className="input-field field-readonly"
              />

              <label className="input-label">Evaluation End Date</label>
              <DatePicker
                selected={editForm.end_date}
                onChange={(date) => setEditForm({ ...editForm, end_date: date })}
                className="input-field"
              />

              <label className="input-label">Notification</label>
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
