import React, { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import { useView } from "../../api/views";
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
//
// What the card shows, and which actions this role has on it, is the
// server's (App\Pages\SemesterCardPage), read afresh each time it mounts.
const SemesterStatsCard = ({ semesterName = null, filtersEnabled = false, setFilters = null }) => {
  const { view, failed, retry, reload } = useView("semester-card", semesterName ? { semester: semesterName } : {}, { kept: false });
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
    reload();
  };

  const openModal = () => {
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
  };

  useEffect(() => {
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

  // Each answer puts the semester's saved values back into the edit form.
  const editValues = view?.edit_values;
  useEffect(() => {
    if (!editValues) return;
    setEditForm({
      semester_name: view.semester_name,
      start_date: new Date(editValues.start_date),
      end_date: new Date(editValues.end_date),
      notification: editValues.notification,
      ppt_file: editValues.ppt_file || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editValues]);

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
      reload();
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
      reload();
    } catch (err) {
      console.error("POST error:", err);
    }
  };

  // A failure is no answer at all, and offering to create the first semester
  // then would invite a duplicate of the one that failed to load.
  if (failed) {
    return (
      <Panel>
        <LoadError
          message="Could not load the evaluation semester. Check your connection and try again."
          onRetry={retry}
        />
      </Panel>
    );
  }

  if (!view) {
    return <Panel><StatusNotice tone="loading" title="Loading semester" /></Panel>;
  }

  if (view.state === "hidden") return null;

  if (view.state === "none") {
    // No semesters exist: the office is asked to create the first.
    return (
      <>
        <Panel
          className="reveal"
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

          <Suspense fallback={<Loader scope="content" />}>
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

  const { semester_name } = view;

  // The latest semester is over: the office is asked to create the next.
  if (view.state === "completed") {
    return (
      <>
        <Panel
          className="reveal"
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

          <Suspense fallback={<Loader scope="content" />}>
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

  const runAction = (action) => {
    if (action.navigate_below) navigate(location + action.navigate_below);
    else if (action.opens === "schedule") openModal();
    else setOpenEditModal(true);
  };

  // One filled button: scheduling or editing the semester, whichever this
  // role has. Opening the semester and the filter toggle sit beside it.
  return (
    <>
      <Panel
        className="reveal"
        title={
          <>
            {view.title_parts.map((part) => <React.Fragment key={part}>{part}</React.Fragment>)}
            {view.badge && <span className={`badge badge--${view.badge.tone} semester-badge`}>{view.badge.text}</span>}
          </>
        }
        actions={
          <>
            {view.actions.map((action) => (action.toggles_filters ? (
              setFilters && (
                <CustomButton
                  key="filters"
                  onClick={() => setFilters(!filtersEnabled)}
                  text={filtersEnabled ? "Disable advanced filters" : "Enable advanced filters"}
                  variant="secondary"
                />
              )
            ) : (
              <CustomButton key={action.label} onClick={() => runAction(action)} text={action.label} variant={action.variant} />
            )))}
          </>
        }
      >
        <dl className="facts">
          {view.facts.map((fact) => (
            <div key={fact.label}><dt>{fact.label}</dt><dd>{"date" in fact ? formatDate(fact.date) : fact.text}</dd></div>
          ))}
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
              reload();
            }}
          />
        </div>
        <div hidden={tabIndex !== 1}>
          <BulkSchedulePresentation semester_name={semester_name} />
        </div>
      </>
    </CustomModal>

      {view.edits && (
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

          <Suspense fallback={<Loader scope="content" />}>
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
