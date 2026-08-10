import React, { useEffect, useState } from "react";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import "./SemesterStatsCard.css";
import CustomButton from "../../components/forms/fields/CustomButton";
import CustomModal from "../../components/forms/modal/CustomModal";
import Tabs from "../../components/tabs/Tabs";
import ToggleSwitch from "../../components/forms/fields/ToggleSwitch";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DropdownField from "../../components/forms/fields/DropdownField";
import GridContainer from "../../components/forms/fields/GridContainer";
import { generateReportPeriods } from "../../utils/semester";
import InputField from "../../components/forms/fields/InputField";
import { toast } from "react-toastify";
import BulkSchedulePresentation from "../../components/forms/presentations/BulkSchedulePresentation";
import SchedulePresentation from "../../components/forms/presentations/SchedulePresentation";
import FileUploadField from "../../components/forms/fields/FileUploadField";
// import FilterBar from "../../components/filterBar/FilterBar";
import { set } from "react-hook-form";

const SemesterStatsCard = ({ semesterName = null,setFilters=null}) => {
  const [semesterStats, setSemesterStats] = useState(null);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [body, setBody] = useState({});
  const [filtersEnabled, setFiltersEnabled] = useState(false);
 const [location, setLocation] = useState(window.location.pathname);
 
  const [reportPeriods, setReportPeriods] = useState([]);
  const [editForm, setEditForm] = useState({
    semester_name: "",
    start_date: null,
    end_date: null,
    notification: false,
    ppt_file: null,
  });
  useEffect(() => {
    if(setFilters) 
    setFilters(filtersEnabled);
  },[filtersEnabled]);
  const [open, setOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const role = localStorage.getItem("userRole") || "student";
  const [createForm, setCreateForm] = useState({
    semester_name: "",
    start_date: new Date(),
    end_date: new Date(),
    notification: false,
    ppt_file: null,
  });

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
    try {
      let url = baseURL + "/semester/recent";
      if (semesterName) {
        url = baseURL + "/semester/" + semesterName;
      }
      const res = await customFetch(url, "GET", {}, false);
      const data = res.response?.data || res.data;
      setSemesterStats(data);
      setEditForm({
        semester_name: data.semester_name,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        notification: data.notification,
        ppt_file: data.ppt_file || null,
      });
    } catch (error) {
      console.error("Error fetching semester stats:", error);
      // Set empty state when no semesters exist
      setSemesterStats(null);
    }
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
      const startDate = editForm.start_date instanceof Date 
        ? editForm.start_date.toISOString().split('T')[0]
        : editForm.start_date;
      const endDate = editForm.end_date instanceof Date 
        ? editForm.end_date.toISOString().split('T')[0]
        : editForm.end_date;
      
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      
      // Convert boolean to string '0' or '1' for FormData
      formData.append('notification', editForm.notification ? '1' : '0');
      
      // Only append ppt_file if a new file was selected
      if (editForm.ppt_file && editForm.ppt_file instanceof File) {
        formData.append('ppt_file', editForm.ppt_file);
      }

      let hello = await customFetch(
        baseURL + "/semester",
        "POST",
        formData,
        true,
        true // isFormData flag
      );
      if (hello.status === 200) {
        toast.success("Semester updated successfully!");
      }

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
      const startDate = createForm.start_date instanceof Date 
        ? createForm.start_date.toISOString().split('T')[0]
        : createForm.start_date;
      const endDate = createForm.end_date instanceof Date 
        ? createForm.end_date.toISOString().split('T')[0]
        : createForm.end_date;
      
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      
      // Convert boolean to string '0' or '1' for FormData
      formData.append('notification', createForm.notification ? '1' : '0');
      
      // Only append ppt_file if a file was selected
      if (createForm.ppt_file && createForm.ppt_file instanceof File) {
        formData.append('ppt_file', createForm.ppt_file);
      }

      await customFetch(baseURL + "/semester", "POST", formData, true, true);
      setOpenCreateModal(false);
      fetchSemesterStats();
    } catch (err) {
      console.error("POST error:", err);
    }
  };

  if (!semesterStats) {
    // No semesters exist - show create option for admin/dordc
    if (role === "admin" || role === "dordc") {
      return (
        <div className="semester-card">
          <div className="semester-header">
            <h3>No Evaluation Semester Found</h3>
          </div>
          <div className="semester-stats-line">
            <p style={{ marginBottom: "16px" }}>
              No evaluation semester has been created yet. Create the first semester to start scheduling presentations.
            </p>
            <button
              className="button"
              onClick={() => setOpenCreateModal(true)}
            >
              Create First Evaluation Semester
            </button>
          </div>
          
          <CustomModal
            isOpen={openCreateModal}
            onClose={() => {setOpenCreateModal(false); window.location.reload();}}
            title="Create New Semester Progress Monitoring"
            minWidth="300px"
            minHeight="300px"
          >
            <GridContainer
              elements={[
                <DropdownField
                  label="Period of Report"
                  options={reportPeriods}
                  onChange={(value) =>
                    setCreateForm((prev) => ({ ...prev, semester_name: value }))
                  }
                />,
              ]}
              space={2}
            />

            <label className="input-label">Evaluation Start Date</label>
            <DatePicker
              selected={createForm.start_date}
              onChange={(date) =>
                setCreateForm({ ...createForm, start_date: date })
              }
              className="input-field"
            />

            <label className="input-label">Evaluation End Date</label>
            <DatePicker
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
              label="Sample PPT Template (Optional)"
              initialValue={createForm.ppt_file}
              isLocked={false}
              onChange={(file) => setCreateForm({ ...createForm, ppt_file: file })}
              showLabel={true}
              acceptedTypes=".ppt,.pptx"
              maxSizeMB={15}
              fileTypeLabel="PPT/PPTX"
            />

            <div style={{ textAlign: "right", marginTop: "10px" }}>
              <CustomButton onClick={handleCreateSubmit} text="Create" />
            </div>
          </CustomModal>
        </div>
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
      <div>
        <div className="semester-card">
          <div className="semester-header">
            <h3>Evaluation Semester Completed</h3>
          </div>
          <div className="semester-stats-line">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                Semester <strong>{semester_name}</strong> was completed recently. Create a new semester to continue scheduling presentations.
              </p>
              <button
                className="button"
                onClick={() => setOpenCreateModal(true)}
              >
                Create New Evaluation Semester
              </button>
            </div>
          </div>
        </div>

        <CustomModal
          isOpen={openCreateModal}
          onClose={() => {setOpenCreateModal(false);window.location.reload();}}
          title="Create New Semester Progress Monitoring"
          minWidth="300px"
          minHeight="300px"
        >
          <GridContainer
            elements={[
              <DropdownField
                label="Period of Report"
                options={reportPeriods}
                onChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, semester_name: value }))
                }
              />,
            ]}
            space={2}
          />

          <label className="input-label">Evaluation Start Date</label>
          <DatePicker
            selected={createForm.start_date}
            onChange={(date) =>
              setCreateForm({ ...createForm, start_date: date })
            }
            className="input-field"
          />

          <label className="input-label">Evaluation End Date</label>
          <DatePicker
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
            label="Sample PPT Template (Optional)"
            initialValue={createForm.ppt_file}
            isLocked={false}
            onChange={(file) => setCreateForm({ ...createForm, ppt_file: file })}
            showLabel={true}
            acceptedTypes=".ppt,.pptx"
            maxSizeMB={15}
            fileTypeLabel="PPT/PPTX"
          />

          <div style={{ textAlign: "right", marginTop: "10px" }}>
            <CustomButton onClick={handleCreateSubmit} text="Create" />
          </div>
        </CustomModal>
      </div>
    );
  }

  // If semester is completed and user is not admin/dordc, and not viewing specific semester, show nothing
  if (isSemesterCompleted && !semesterName) {
    return null;
  }

  return (
    <div>
      <div className="semester-card">
        <div className="semester-header">
          <h3>{semester_name} Semester Stats</h3>
          {isInSemester && (
            <span className="semester-status-indicator">● Active</span>
          )}
          {isBeforeSemester && (
            <span className="semester-status-indicator">● Upcoming</span>
          )}
        </div>
        <div className="semester-stats-line">
          <div className="stat-item">
            <strong>Start Date:</strong>{" "}
            {new Date(start_date).toLocaleDateString()}
          </div>
          <div className="stat-item">
            <strong>End Date:</strong> {new Date(end_date).toLocaleDateString()}
          </div>
          {(role === "admin" ||
            role === "hod" ||
            role === "dordc" ||
            role === "phd_coordinator") && (
            <>
              <div className="stat-item">
                <strong>Leaves Scheduled:</strong> {leave}
              </div>
              <div className="stat-item">
                <strong>Scheduled:</strong> {scheduled}
              </div>
              <div className="stat-item">
                <strong>Unscheduled:</strong> {unscheduled}
              </div>
            </>
          )}
          {(role === "admin" || role === "dordc") && (
            <div className="semester-actions">
              <CustomButton
                onClick={() => setFiltersEnabled(prev => !prev)}
                text={filtersEnabled ? "Disable Advanced Filters" : "Enable Advanced Filters"}
                variant="secondary"
              />
              {(isInSemester || isBeforeSemester) && (
                <CustomButton text="Edit Evaluation Semester" onClick={() => setOpenEditModal(true)} />
              )}
            </div>
          )}

          {/* View Current Semester button - visible to all roles when semester is active */}
          {isInSemester && !semesterName && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", width: "100%", marginTop: role === "admin" || role === "dordc" ? "0" : "12px" }}>
              <div style={{ flex: 1, minWidth: "250px" }}>
                <CustomButton
                  onClick={() => window.location.href = location+`/semester/${semester_name}`}
                  text="View Current Semester Details"
                  fullWidth
                />
              </div>
            </div>
          )}

{(isInSemester || isBeforeSemester) && (role === "faculty" || role === "phd_coordinator") && (
  <div className="form-list-bar">

<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", width: "100%" }}>
  <div style={{ flex: 1, minWidth: "250px" }}>
    <CustomButton
      onClick={() => setFiltersEnabled(prev => !prev)}
      text={filtersEnabled ? "Disable Advanced Filters" : "Enable Advanced Filters"}
      fullWidth
    />
  </div>

  <div style={{ flex: 1, minWidth: "250px" }}>
    <CustomButton
      onClick={openModal}
      text="Schedule Progress Monitoring +"
      fullWidth
    />
  </div>
</div>



    
    

    <CustomModal
      isOpen={open}
      onClose={closeModal}
      title={"Schedule Progress Monitoring"}
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
            { value: 0, label: 'Individual Schedule' },
            { value: 1, label: 'Bulk Schedule' },
          ]}
        />

        {tabIndex === 0 && (
          <SchedulePresentation semester={semester_name} />
        )}
        {tabIndex === 1 && (
          <BulkSchedulePresentation semester_name={semester_name} />
        )}
      </>
    </CustomModal>
  </div>
)}        </div>
      </div>

      {(role === "admin" || role === "dordc") && (
        <CustomModal
          isOpen={openEditModal}
          onClose={() => {setOpenEditModal(false); 
            window.location.reload();}}
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
    </div>
  );
};

export default SemesterStatsCard;
