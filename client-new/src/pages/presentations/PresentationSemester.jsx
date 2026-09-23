import React, { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from '../../components/page/Page';
import CustomModal from "../../components/forms/modal/CustomModal";
import CustomButton from "../../components/forms/fields/CustomButton";
import GridContainer from "../../components/forms/fields/GridContainer";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import SemesterStatsCard from "./SemsterStatsCard";
import InputField from "../../components/forms/fields/InputField";
import ToggleSwitch from "../../components/forms/fields/ToggleSwitch";
import FileUploadField from "../../components/forms/fields/FileUploadField";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import { toast } from "react-toastify";
import UnifiedBulkImportModal from "../../components/bulkImport/UnifiedBulkImportModal";
import { column } from "../../components/bulkImport/columns";
import { currentRole } from '../../auth/access';
import { toDateValue } from '../../utils/timeParse';
import Loader from "../../components/loader/loader";
import { useLoading } from "../../context/LoadingContext";

// Only the admin/DoRDC edit dialog uses the picker, so it and its
// stylesheet load when that dialog opens.
const DatePicker = lazy(() =>
  Promise.all([
    import("react-datepicker"),
    import("react-datepicker/dist/react-datepicker.css"),
  ]).then(([picker]) => picker)
);

const PresentationSemester = () => {
  const [role, setRole] = useState("");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [location, setLocation] = useState(window.location.pathname);
  const [showProgressImport, setShowProgressImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Saving carries a file, so a second press while the first is in flight
  // posted it twice.
  const [saving, setSaving] = useState(false);
  const { setLoading } = useLoading();
  const [editForm, setEditForm] = useState({
    semester_name: "",
    start_date: null,
    end_date: null,
    notification: false,
    ppt_file: null,
  });
  

  useEffect(() => {
    setRole(currentRole());
  }, []);

  const handleEditClick = async (semester) => {
    setLoading(true);
    try {
      const res = await customFetch(`${baseURL}/semester/${semester.semester_name}`, "GET", {}, false);
      const data = res.success ? res.response?.data : null;
      if (!data) {
        toast.error("Could not load that semester. Try again.");
        return;
      }
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
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('semester_name', editForm.semester_name);
      formData.append('start_date', toDateValue(editForm.start_date));
      formData.append('end_date', toDateValue(editForm.end_date));
      // Laravel's boolean rule refuses the strings "true" and "false".
      formData.append('notification', editForm.notification ? '1' : '0');
      
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
      if (!response.success) return;
      toast.success("Semester updated.");

      setOpenEditModal(false);
      // Remounts the table and the stats card, both of which show this semester.
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error("PUT error:", err);
    } finally {
      setSaving(false);
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
    <Page title="Progress monitoring" description="Evaluation semesters and their deadlines.">
     <SemesterStatsCard key={`stats-${refreshKey}`} />
     <PagenationTable
        key={refreshKey}
        endpoint={location}
        enableApproval={false}
        enableSelect={false}
        tableTitle="Past semesters"
        customOpenForm={(semester) => {
            navigate(location + `/semester/${semester.semester_name}`);
        }}
        extraTopbarComponents={
          (role === "admin" || role === "dordc") ? (
            <CustomButton text="Import progress history" variant="secondary" onClick={() => setShowProgressImport(true)} />
          ) : null
        }
        actions={(role === "admin" || role === "dordc") ? [
          {
            icon: <i className="fa fa-pencil-square-o"></i>,
            tooltip: "Edit semester",
            onClick: handleEditClick,
          },
        ] : []}
      />

      <UnifiedBulkImportModal
        isOpen={showProgressImport}
        onClose={() => setShowProgressImport(false)}
        title="Import progress history"
        required={['Registration Number', 'Progress for AY', 'Total Progress %']}
        rules={[
          'One row per scholar per semester. The gain for each period is worked out from the totals.',
          'Progress for AY is the semester code, for example 2425ODD.',
          'A blank total means the evaluation has not happened yet, so the row is skipped.',
          'A semester the scholar already has a presentation for is left to its own workflow.',
        ]}
        sampleFileName="progress_history_sample.csv"
        sampleCsvContent={progressSampleCsv}
        onImport={handleProgressImport}
        submitting={importing}
      />

      {(role === "admin" || role === "dordc") && (
        <CustomModal
          isOpen={openEditModal}
          onClose={() => setOpenEditModal(false)}
          title="Edit semester deadline"
          minWidth="300px"
          minHeight="300px"
        >
          <GridContainer
            elements={[
              <InputField
                label="Period of report"
                isLocked={true}
                initialValue={editForm.semester_name}
              />,
            ]}
            space={2}
          />

          <Suspense fallback={<Loader />}>
          <label className="input-label" htmlFor="presentation-semester-evaluation-start-date">Evaluation start date</label>
          <DatePicker id="presentation-semester-evaluation-start-date"
            selected={editForm.start_date}
            readOnly
            disabled
            className="input-field field-readonly"
          />

          <label className="input-label" htmlFor="presentation-semester-evaluation-end-date">Evaluation end date</label>
          <DatePicker id="presentation-semester-evaluation-end-date"
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
            label="Sample PPT template (optional)"
            initialValue={editForm.ppt_file}
            isLocked={false}
            onChange={(file) => setEditForm({ ...editForm, ppt_file: file })}
            showLabel={true}
            acceptedTypes=".ppt,.pptx"
            maxSizeMB={15}
            fileTypeLabel="PPT/PPTX"
          />

          <div className="modal-actions">
            <CustomButton onClick={handleEditSubmit} text={saving ? "Saving…" : "Save changes"} disabled={saving} />
          </div>
          </Suspense>
        </CustomModal>
      )}
    </Page>
  );
};

export default PresentationSemester;
