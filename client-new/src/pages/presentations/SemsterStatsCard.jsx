import React, { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import "./SemesterStatsCard.css";
import CustomButton from "../../components/forms/fields/CustomButton";
import CustomModal from "../../components/forms/modal/CustomModal";
import Tabs from "../../components/tabs/Tabs";
import ToggleSwitch from "../../components/forms/fields/ToggleSwitch";
import DropdownField from "../../components/forms/fields/DropdownField";
import GridContainer from "../../components/forms/fields/GridContainer";
import { generateReportPeriods } from "../../utils/semester";
import InputField from "../../components/forms/fields/InputField";
import { toast } from "react-toastify";
import BulkSchedulePresentation from "../../components/forms/presentations/BulkSchedulePresentation";
import SchedulePresentation from "../../components/forms/presentations/SchedulePresentation";
import FileUploadField from "../../components/forms/fields/FileUploadField";
// import FilterBar from "../../components/filterBar/FilterBar";
import { formatDate, toDateValue } from '../../utils/timeParse';
import { currentRole } from '../../auth/access';
import Loader from "../../components/loader/loader";
import LoadError from "../../components/common/LoadError";
import Panel from "../../components/panel/Panel";
import StatusNotice from "../../components/common/StatusNotice";

// The picker and its stylesheet are only needed inside the admin/DoRDC
// create and edit dialogs, while this card renders for every role.
const DatePicker = lazy(() =>
  Promise.all([
    import("react-datepicker"),
    import("react-datepicker/dist/react-datepicker.css"),
  ]).then(([picker]) => picker)
);

const blankCreateForm = () => ({
  semester_name: "",
  start_date: new Date(),
  end_date: new Date(),
  notification: false,
  ppt_file: null,
});

// The list page owns whether its filter bar shows; this card only offers the
// toggle. Owning a copy here as well let the two disagree, so the first press
// could appear to do nothing.
const SemesterStatsCard = ({ semesterName = null, filtersEnabled = false, setFilters = null }) => {
  const [semesterStats, setSemesterStats] = useState(null);
  // null stats meant both "still loading" and "there is no semester", so the
  // card told DoRDC to create the first semester while the real one loaded.
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [body, setBody] = useState({});
 const [location, setLocation] = useState(window.location.pathname);
 
  const [reportPeriods, setReportPeriods] = useState([]);
  const [editForm, setEditForm] = useState({
    semester_name: "",
    start_date: null,
    end_date: null,
    notification: false,
    ppt_file: null,
  });
  const [open, setOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const role = currentRole() || "student";
  const [createForm, setCreateForm] = useState(blankCreateForm);
  const navigate = useNavigate();

  // Closing without saving drops what was typed. Nothing reached the server,
  // so there is nothing to reload.
  const closeCreateModal = () => {
    setOpenCreateModal(false);
    setCreateForm(blankCreateForm());
  };

  // The refetch puts the saved dates back into the edit form.
  const closeEditModal = () => {
    setOpenEditModal(false);
    fetchSemesterStats();
  };

  const openModal = () => {
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
  };

  useEffect(() => {
    fetchSemesterStats();
    const periods = generateReportPeriods(2, 1, true);
    const pp = [];
    periods.forEach((period) => {
      const period1 = {};
      period1.value = period;
      period1.title = period;
      pp.push(period1);
    });
    setReportPeriods(pp);
  }, []);

  const fetchSemesterStats = async () => {
    let url = baseURL + "/semester/recent";
    if (semesterName) {
      url = baseURL + "/semester/" + semesterName;
    }
    const res = await customFetch(url, "GET", {}, false);
    // The server says there is no semester with a 404. Any other failure is no
    // answer at all, and offering to create the first semester then invites a
    // duplicate of the one that failed to load.
    const noSemester = !res.success && res.status === 404;
    const data = res.success ? res.response?.data : null;
    setLoadError(!res.success && !noSemester);
    setSemesterStats(data || null);
    if (data) {
      setEditForm({
        semester_name: data.semester_name,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        notification: data.notification,
        ppt_file: data.ppt_file || null,
      });
    }
    setStatsLoaded(true);
  };

  const currentDate = new Date();
  const isInSemester =
    semesterStats &&
    currentDate >= new Date(semesterStats.start_date) &&
    currentDate <= new Date(semesterStats.end_date);

  const isBeforeSemester =
    semesterStats && currentDate < new Date(semesterStats.start_date);

  const handleEditSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append('semester_name', editForm.semester_name);
      
      // Format dates as Y-m-d
      const startDate = editForm.start_date instanceof Date ? toDateValue(editForm.start_date) : editForm.start_date;
      const endDate = editForm.end_date instanceof Date ? toDateValue(editForm.end_date) : editForm.end_date;
      
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      
      // Convert boolean to string '0' or '1' for FormData
      formData.append('notification', editForm.notification ? '1' : '0');
      
      // Only append ppt_file if a new file was selected
      if (editForm.ppt_file && editForm.ppt_file instanceof File) {
        formData.append('ppt_file', editForm.ppt_file);
      }

      const result = await customFetch(
        baseURL + "/semester",
        "POST",
        formData,
        true,
        true // isFormData flag
      );
      // customFetch answers { success, response }; there is no status on it, so
      // this never said "updated", and the dialog closed on a refusal as well.
      if (!result.success) return;
      toast.success("Semester updated.");

      setOpenEditModal(false);
      fetchSemesterStats();
    } catch (err) {
      console.error("PUT error:", err);
    }
  };

  const handleCreateSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append('semester_name', createForm.semester_name);
      
      // Format dates as Y-m-d
      const startDate = createForm.start_date instanceof Date ? toDateValue(createForm.start_date) : createForm.start_date;
      const endDate = createForm.end_date instanceof Date ? toDateValue(createForm.end_date) : createForm.end_date;
      
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      
      // Convert boolean to string '0' or '1' for FormData
      formData.append('notification', createForm.notification ? '1' : '0');
      
      // Only append ppt_file if a file was selected
      if (createForm.ppt_file && createForm.ppt_file instanceof File) {
        formData.append('ppt_file', createForm.ppt_file);
      }

      const result = await customFetch(baseURL + "/semester", "POST", formData, true, true);
      // Keep the dialog, and what was typed, when the server refuses.
      if (!result.success) return;
      toast.success("Semester created.");
      setOpenCreateModal(false);
      fetchSemesterStats();
    } catch (err) {
      console.error("POST error:", err);
    }
  };

  if (!statsLoaded) {
    return <Panel><StatusNotice tone="loading" title="Loading semester" /></Panel>;
  }

  if (loadError) {
    return (
      <Panel>
        <LoadError
          message="Could not load the evaluation semester. Check your connection and try again."
          onRetry={fetchSemesterStats}
        />
      </Panel>
    );
  }

  if (!semesterStats) {
    // No semesters exist - show create option for admin/dordc
    if (role === "admin" || role === "dordc") {
      return (
        <>
          <Panel
            title="No evaluation semester found"
            actions={<CustomButton text="Create first evaluation semester" onClick={() => setOpenCreateModal(true)} />}
          >
            <p className="semester-note">
              No evaluation semester has been created yet. Create the first semester to start scheduling presentations.
            </p>
          </Panel>

          <CustomModal
            isOpen={openCreateModal}
            onClose={closeCreateModal}
            title="Create new semester progress monitoring"
            minWidth="300px"
            minHeight="300px"
          >
            <GridContainer
              elements={[
                <DropdownField
                  label="Period of report"
                  options={reportPeriods}
                  onChange={(value) =>
                    setCreateForm((prev) => ({ ...prev, semester_name: value }))
                  }
                />,
              ]}
              space={2}
            />

            <Suspense fallback={<Loader />}>
            <label className="input-label" htmlFor="semster-stats-card-evaluation-start-date">Evaluation start date</label>
            <DatePicker id="semster-stats-card-evaluation-start-date"
              selected={createForm.start_date}
              onChange={(date) =>
                setCreateForm({ ...createForm, start_date: date })
              }
              className="input-field"
            />

            <label className="input-label" htmlFor="semster-stats-card-evaluation-end-date">Evaluation end date</label>
            <DatePicker id="semster-stats-card-evaluation-end-date"
              selected={createForm.end_date}
              onChange={(date) =>
                setCreateForm({ ...createForm, end_date: date })
              }
              className="input-field"
            />

            <label className="input-label">Notification</label>
            <ToggleSwitch
              isOn={createForm.notification}
              onToggle={() =>
                setCreateForm((prev) => ({
                  ...prev,
                  notification: !prev.notification,
                }))
              }
            />

            <FileUploadField
              label="Sample PPT template (optional)"
              initialValue={createForm.ppt_file}
              isLocked={false}
              onChange={(file) => setCreateForm({ ...createForm, ppt_file: file })}
              showLabel={true}
              acceptedTypes=".ppt,.pptx"
              maxSizeMB={15}
              fileTypeLabel="PPT/PPTX"
            />

            <div className="modal-actions">
              <CustomButton onClick={handleCreateSubmit} text="Create" />
            </div>
            </Suspense>
          </CustomModal>
        </>
      );
    }
    // For non-admin users, show nothing when no semesters exist
    return null;
  }

  const { semester_name, start_date, end_date, leave, scheduled, unscheduled } =
    semesterStats;

  const isSemesterCompleted = new Date(end_date) < currentDate;

  // If semester is completed AND we're not viewing a specific past semester, show only the create new semester prompt
  // If semesterName is provided, it means we're viewing a specific past semester, so show full stats
  if (isSemesterCompleted && !semesterName && (role === "admin" || role === "dordc")) {
    return (
      <>
        <Panel
          title="Evaluation semester completed"
          actions={<CustomButton text="Create new evaluation semester" onClick={() => setOpenCreateModal(true)} />}
        >
          <p className="semester-note">
            Semester <strong>{semester_name}</strong> was completed recently. Create a new semester to continue scheduling presentations.
          </p>
        </Panel>

        <CustomModal
          isOpen={openCreateModal}
          onClose={closeCreateModal}
          title="Create new semester progress monitoring"
          minWidth="300px"
          minHeight="300px"
        >
          <GridContainer
            elements={[
              <DropdownField
                label="Period of report"
                options={reportPeriods}
                onChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, semester_name: value }))
                }
              />,
            ]}
            space={2}
          />

          <Suspense fallback={<Loader />}>
          <label className="input-label" htmlFor="semster-stats-card-evaluation-start-date-2">Evaluation start date</label>
          <DatePicker id="semster-stats-card-evaluation-start-date-2"
            selected={createForm.start_date}
            onChange={(date) =>
              setCreateForm({ ...createForm, start_date: date })
            }
            className="input-field"
          />

          <label className="input-label" htmlFor="semster-stats-card-evaluation-end-date-2">Evaluation end date</label>
          <DatePicker id="semster-stats-card-evaluation-end-date-2"
            selected={createForm.end_date}
            onChange={(date) =>
              setCreateForm({ ...createForm, end_date: date })
            }
            className="input-field"
          />

          <label className="input-label">Notification</label>
          <ToggleSwitch
            isOn={createForm.notification}
            onToggle={() =>
              setCreateForm((prev) => ({
                ...prev,
                notification: !prev.notification,
              }))
            }
          />

          <FileUploadField
            label="Sample PPT template (optional)"
            initialValue={createForm.ppt_file}
            isLocked={false}
            onChange={(file) => setCreateForm({ ...createForm, ppt_file: file })}
            showLabel={true}
            acceptedTypes=".ppt,.pptx"
            maxSizeMB={15}
            fileTypeLabel="PPT/PPTX"
          />

          <div className="modal-actions">
            <CustomButton onClick={handleCreateSubmit} text="Create" />
          </div>
          </Suspense>
        </CustomModal>
      </>
    );
  }

  // If semester is completed and user is not admin/dordc, and not viewing specific semester, show nothing
  if (isSemesterCompleted && !semesterName) {
    return null;
  }

  const readsCounts = role === "admin" || role === "hod" || role === "dordc" || role === "phd_coordinator";
  const schedules = (isInSemester || isBeforeSemester) && (role === "faculty" || role === "phd_coordinator");
  const edits = (isInSemester || isBeforeSemester) && (role === "admin" || role === "dordc");

  // One filled button: scheduling or editing the semester, whichever this
  // role has. Opening the semester and the filter toggle sit beside it.
  return (
    <>
      <Panel
        title={
          <>
            {semester_name} semester stats
            {isInSemester && <span className="badge badge--success semester-badge">Active</span>}
            {isBeforeSemester && <span className="badge badge--info semester-badge">Upcoming</span>}
          </>
        }
        actions={
          <>
            {isInSemester && !semesterName && (
              <CustomButton
                onClick={() => navigate(location + `/semester/${semester_name}`)}
                text="View current semester details"
                variant="secondary"
              />
            )}
            {setFilters && (role === "admin" || role === "dordc" || role === "faculty" || role === "phd_coordinator") && (
              <CustomButton
                onClick={() => setFilters(!filtersEnabled)}
                text={filtersEnabled ? "Disable advanced filters" : "Enable advanced filters"}
                variant="secondary"
              />
            )}
            {schedules && (
              <CustomButton onClick={openModal} text="Schedule progress monitoring" />
            )}
            {edits && (
              <CustomButton text="Edit evaluation semester" onClick={() => setOpenEditModal(true)} />
            )}
          </>
        }
      >
        <dl className="facts">
          <div><dt>Start date</dt><dd>{formatDate(start_date)}</dd></div>
          <div><dt>End date</dt><dd>{formatDate(end_date)}</dd></div>
          {readsCounts && (
            <>
              <div><dt>Leaves scheduled</dt><dd>{leave}</dd></div>
              <div><dt>Scheduled</dt><dd>{scheduled}</dd></div>
              <div><dt>Unscheduled</dt><dd>{unscheduled}</dd></div>
            </>
          )}
        </dl>
      </Panel>

    <CustomModal
      isOpen={open}
      onClose={closeModal}
      title="Schedule progress monitoring"
      minHeight="300px"
      maxHeight="600px"
      minWidth="650px"
      maxWidth="700px"
      closeOnOutsideClick={false}
    >
      <>
        <Tabs
          value={tabIndex}
          onChange={setTabIndex}
          items={[
            { value: 0, label: 'Individual schedule' },
            { value: 1, label: 'Bulk schedule' },
          ]}
        />

        {/* Both stay mounted so switching tabs keeps what was entered. */}
        <div hidden={tabIndex !== 0}>
          <SchedulePresentation
            semester={semester_name}
            close={() => {
              closeModal();
              fetchSemesterStats();
            }}
          />
        </div>
        <div hidden={tabIndex !== 1}>
          <BulkSchedulePresentation semester_name={semester_name} />
        </div>
      </>
    </CustomModal>

      {(role === "admin" || role === "dordc") && (
        <CustomModal
          isOpen={openEditModal}
          onClose={closeEditModal}
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
          <label className="input-label" htmlFor="semster-stats-card-evaluation-start-date-3">Evaluation start date</label>
          <DatePicker id="semster-stats-card-evaluation-start-date-3"
            selected={editForm.start_date}
            readOnly
            disabled
            className="input-field field-readonly"
          />

          <label className="input-label" htmlFor="semster-stats-card-evaluation-end-date-3">Evaluation end date</label>
          <DatePicker id="semster-stats-card-evaluation-end-date-3"
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
            <CustomButton onClick={handleEditSubmit} text="Save changes" />
          </div>
          </Suspense>
        </CustomModal>
      )}
    </>
  );
};

export default SemesterStatsCard;
