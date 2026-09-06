import React, { useState, useEffect } from "react";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import { useLoading } from "../../context/LoadingContext";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../components/dashboard/layout";
import CustomButton from "../../components/forms/fields/CustomButton";
import GridContainer from "../../components/forms/fields/GridContainer";
import InputField from "../../components/forms/fields/InputField";
import DropdownField from "../../components/forms/fields/DropdownField";
import CustomModal from "../../components/forms/modal/CustomModal";
import "./AdminFormManagement.css";

const AdminFormManagement = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentForms, setStudentForms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedForm, setExpandedForm] = useState(null);
  const [editingInstance, setEditingInstance] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormType, setCreateFormType] = useState("");
  const [isManageFormModalOpen, setIsManageFormModalOpen] = useState(false);
  const [selectedFormForManagement, setSelectedFormForManagement] = useState(null);
  const [isInstancesModalOpen, setIsInstancesModalOpen] = useState(false);
  const [selectedFormForInstances, setSelectedFormForInstances] = useState(null);
  const { setLoading } = useLoading();
  const [searchParams] = useSearchParams();

  const stageOptions = [
    { label: "Student", value: "student" },
    { label: "Supervisor", value: "faculty" },
    { label: "HOD", value: "hod" },
    { label: "PhD Coordinator", value: "phd_coordinator" },
    { label: "DoRDC", value: "dordc" },
    { label: "DRA", value: "dra" },
    { label: "Vice Chancellor", value: "director" },
    { label: "Doctoral", value: "doctoral" },
    { label: "External", value: "external" },
    { label: "Complete", value: "complete" },
  ];

  const lockRoles = [
    "student",
    "faculty",
    "hod",
    "phd_coordinator",
    "dordc",
    "dra",
    "director",
    "doctoral",
    "external",
  ];

  const roleLabels = {
    student: "Student",
    faculty: "Supervisor",
    supervisor: "Supervisor",
    hod: "HOD",
    phd_coordinator: "PhD Coordinator",
    dordc: "DoRDC",
    dra: "DRA",
    director: "Vice Chancellor",
    doctoral: "Doctoral",
    external: "External"
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    const rollNo = searchParams.get("roll_no");
    if (rollNo && students.length > 0) {
      const student = students.find(s => s.roll_no?.toString() === rollNo);
      if (student) {
        handleStudentSelect(student.roll_no);
        setSearchTerm(rollNo);
      }
    }
  }, [searchParams, students]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/students?all=true",
        "GET",
        {
          all: true
        },
        false
      );
      if (response.success) {
        setStudents(response.response.data || []);
      }
    } catch (error) {
      toast.error("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentForms = async (studentId) => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + `/admin/forms/student/${studentId}`,
        "GET",
        {},
        false
      );
      if (response.success) {
        setStudentForms(response.response.forms || []);
        console.log(response.response.forms);
        setSelectedStudent(response.response.student);
      }
    } catch (error) {
      toast.error("Failed to fetch student forms");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (studentId) => {
    if (studentId) {
      fetchStudentForms(studentId);
    } else {
      setSelectedStudent(null);
      setStudentForms([]);
    }
  };

  const toggleFormExpand = (formType) => {
    setExpandedForm(expandedForm === formType ? null : formType);
  };

  const openManageFormModal = (form) => {
    setSelectedFormForManagement(form);
    setIsManageFormModalOpen(true);
  };

  const openInstancesModal = (form) => {
    setSelectedFormForInstances(form);
    setIsInstancesModalOpen(true);
  };

  const handleUpdateStage = async (formType, formId, newStage, currentStep) => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/update-control",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          form_id: formId,
          stage: newStage,
          current_step: currentStep,
        },
        false
      );
      if (response.success) {
        // Unlock the lock for the stage we're moving to
        const lockField = newStage === 'faculty' ? 'faculty' : newStage;
        if (lockRoles.includes(lockField)) {
          await customFetch(
            baseURL + "/admin/forms/update-control",
            "POST",
            {
              student_id: selectedStudent.roll_no,
              form_type: formType,
              form_id: formId,
              locks: { [lockField]: false },
            },
            false
          );
        }
        
        toast.success("Stage updated successfully");
        await fetchStudentForms(selectedStudent.roll_no);
        
        // Update the selected form for instances modal if it's open
        if (selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForms = await getUpdatedForms();
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      }
    } catch (error) {
      toast.error("Failed to update stage");
    } finally {
      setLoading(false);
    }
  };

  const getUpdatedForms = async () => {
    try {
      const response = await customFetch(
        baseURL + `/admin/forms/student/${selectedStudent.roll_no}`,
        "GET",
        {},
        false
      );
      if (response.success) {
        return response.response.forms || [];
      }
    } catch (error) {
      console.error("Failed to fetch updated forms");
    }
    return studentForms;
  };

  const handleToggleAvailability = async (formType, role, currentValue) => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/toggle-availability",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          role: role,
          available: !currentValue,
        },
        false
      );
      if (response.success) {
        toast.success(`${roleLabels[role]} availability ${!currentValue ? "enabled" : "disabled"}`);
        const updatedForms = await getUpdatedForms();
        setStudentForms(updatedForms);
        
        // Update the selected form for management modal if it's open
        if (selectedFormForManagement && selectedFormForManagement.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForManagement(updatedForm);
          }
        }
      }
    } catch (error) {
      toast.error("Failed to toggle availability");
    } finally {
      setLoading(false);
    }
  };

  const handleDisableForm = async (formType) => {
    if (!window.confirm("Are you sure you want to disable this form? This will prevent students from accessing it.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/disable",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
        },
        false
      );
      if (response.success) {
        toast.success("Form disabled successfully");
        await fetchStudentForms(selectedStudent.roll_no);
        setIsManageFormModalOpen(false);
        setSelectedFormForManagement(null);
      }
    } catch (error) {
      toast.error(error.message || "Failed to disable form");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (formType, formId, role, currentValue) => {
    setLoading(true);
    try {
      const locks = { [role]: !currentValue };
      const response = await customFetch(
        baseURL + "/admin/forms/update-control",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          form_id: formId,
          locks: locks,
        },
        false
      );
      if (response.success) {
        toast.success(`Lock ${!currentValue ? "enabled" : "disabled"}`);
        await fetchStudentForms(selectedStudent.roll_no);
        
        // Update the selected form for instances modal if it's open
        if (selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForms = await getUpdatedForms();
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      }
    } catch (error) {
      toast.error("Failed to toggle lock");
    } finally {
      setLoading(false);
    }
  };

  const handleEnableForm = async (formType) => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/create",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          stage: "student",
          steps: ["student"],
          enable_form: true,
        },
        false
      );
      if (response.success) {
        toast.success("Form enabled successfully");
        await fetchStudentForms(selectedStudent.roll_no);
      }
    } catch (error) {
      toast.error(error.message || "Failed to enable form");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFormInstance = async (formType) => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/create",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          stage: "student",
          steps: ["student"],
          enable_form: false,
        },
        false
      );
      if (response.success) {
        toast.success("Form instance created successfully");
        await fetchStudentForms(selectedStudent.roll_no);
        
        // Update the selected form for instances modal if it's open
        if (selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForms = await getUpdatedForms();
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      }
    } catch (error) {
      toast.error(error.message || "Failed to create form instance");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForm = async () => {
    if (!createFormType) {
      toast.error("Please select a form type");
      return;
    }

    const selectedForm = studentForms.find(f => f.form_type === createFormType);
    
    if (!selectedForm?.exists_in_forms_table) {
      await handleEnableForm(createFormType);
    } else {
      await handleCreateFormInstance(createFormType);
    }
    
    setIsCreateModalOpen(false);
    setCreateFormType("");
  };

  const handleDeleteForm = async (formType, formId) => {
    if (!window.confirm("Are you sure you want to delete this form instance?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/delete",
        "DELETE",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          form_id: formId,
        },
        false
      );
      if (response.success) {
        toast.success("Form deleted successfully");
        await fetchStudentForms(selectedStudent.roll_no);
        
        // Update the selected form for instances modal if it's open
        if (selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForms = await getUpdatedForms();
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      }
    } catch (error) {
      toast.error("Failed to delete form");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSteps = async (formType, formId, currentStep, maxStep) => {
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + "/admin/forms/update-control",
        "POST",
        {
          student_id: selectedStudent.roll_no,
          form_type: formType,
          form_id: formId,
          current_step: currentStep,
          maximum_step: maxStep,
        },
        false
      );
      if (response.success) {
        toast.success("Steps updated successfully");
        await fetchStudentForms(selectedStudent.roll_no);
        
        // Update the selected form for instances modal if it's open
        if (selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForms = await getUpdatedForms();
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      }
    } catch (error) {
      toast.error("Failed to update steps");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.roll_no?.toString().includes(searchTerm) ||
      student.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
    <div className="admin-form-management">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Form Management</h1>
          <p className="page-subtitle">Manage form stages, locks, and availability per student</p>
        </div>
      </div>

      <div className="student-selector-section">
        <GridContainer
          elements={[
            <InputField
              label="Search Student"
              hint="Search by roll number or name..."
              onChange={(value) => setSearchTerm(value)}
            />,
            <DropdownField
              label="Select Student"
              options={filteredStudents.map((s) => ({
                title: `${s.roll_no} - ${s.name}`,
                value: s.roll_no,
              }))}
              onChange={(value) => handleStudentSelect(value)}
            />,
          ]}
        />
      </div>

      {selectedStudent && (
        <>
          <div className="student-info-card">
            <h2>{selectedStudent.name}</h2>
            <p>
              <strong>Roll No:</strong> {selectedStudent.roll_no}
            </p>
            <p>
              <strong>Department:</strong> {selectedStudent.department}
            </p>
          </div>

          <div className="forms-list-header">
            <h3>Available Forms ({studentForms.length})</h3>
            <CustomButton
              text="+ Enable New Form"
              onClick={() => setIsCreateModalOpen(true)}
            />
          </div>

          {studentForms.length === 0 ? (
            <div className="empty-state">
              <p>No forms available for this student</p>
            </div>
          ) : (
            <div className="forms-grid">
              {studentForms.map((form) => (
                <div 
                  key={form.form_type} 
                  className={`form-grid-card ${!form.exists_in_forms_table ? 'form-disabled' : ''}`}
                >
                  <div className="form-grid-header">
                    <h4>{form.form_name}</h4>
                    <span className="form-type-badge">{form.form_type}</span>
                  </div>

                  <div className="form-grid-body">
                    {form.exists_in_forms_table ? (
                      <>
                        <div className="form-stats">
                          <div className="stat-item">
                            <span className="stat-label">Stage</span>
                            <span className="stat-value stage-badge-mini">
                              {form.general_form.stage}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Instances</span>
                            <span className="stat-value count-badge-mini">
                              {form.general_form.count} / {form.general_form.max_count}
                            </span>
                          </div>
                        </div>
                        <div className="form-grid-actions">
                          <CustomButton
                            text="Manage Form"
                            onClick={() => openManageFormModal(form)}
                          />
                          <CustomButton
                            text="View Instances"
                            onClick={() => openInstancesModal(form)}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-disabled-notice">
                          <span className="disabled-badge">Not Enabled</span>
                          <p>Enable this form to allow students to submit</p>
                        </div>
                        <CustomButton
                          text="Enable Form"
                          onClick={() => handleEnableForm(form.form_type)}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Enable Form Modal */}
      <CustomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Enable New Form Type"
        minHeight="300px"
        maxHeight="500px"
        minWidth="500px"
        maxWidth="600px"
      >
        <div className="create-form-modal">
          <GridContainer
            elements={[
              <DropdownField
                label="Select Form Type"
                options={studentForms.map((f) => ({
                    title: f.form_name,
                    value: f.form_type,
                  }))}
                onChange={(value) => setCreateFormType(value)}
              />,
            ]}
            space={2}
          />

          <p className="info-note">
            This will enable the selected form type for {selectedStudent?.name}, 
            allowing them to create submissions.
          </p>

          <GridContainer
            elements={[
              <CustomButton
                text="Cancel"
                onClick={() => setIsCreateModalOpen(false)}
              />,
              <CustomButton text="Enable" onClick={handleCreateForm} />,
            ]}
          />
        </div>
      </CustomModal>

      {/* Manage Form Modal */}
      <CustomModal
        isOpen={isManageFormModalOpen}
        onClose={() => {
          setIsManageFormModalOpen(false);
          setSelectedFormForManagement(null);
        }}
        title={`Manage ${selectedFormForManagement?.form_name || 'Form'}`}
        minHeight="400px"
        maxHeight="700px"
        minWidth="600px"
        maxWidth="800px"
      >
        {selectedFormForManagement && (
          <div className="manage-form-modal">
            <div className="form-overview-section">
              <h3>Form Overview</h3>
              <div className="overview-grid">
                <div className="overview-item">
                  <label>Form Type</label>
                  <span className="form-type-badge">{selectedFormForManagement.form_type}</span>
                </div>
                <div className="overview-item">
                  <label>Current Stage</label>
                  <span className="stage-badge">{selectedFormForManagement.general_form.stage}</span>
                </div>
                <div className="overview-item">
                  <label>Instance Count</label>
                  <span className="count-badge">
                    {selectedFormForManagement.general_form.count} / {selectedFormForManagement.general_form.max_count}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-availability-section">
              <h3>Role Availability</h3>
              <p className="section-description">Toggle role access for this form type</p>
              <div className="availability-grid-editable">
                {[
                  { key: 'student_available', role: 'student', label: 'Student' },
                  { key: 'supervisor_available', role: 'supervisor', label: 'Supervisor' },
                  { key: 'hod_available', role: 'hod', label: 'HOD' },
                  { key: 'phd_coordinator_available', role: 'phd_coordinator', label: 'PhD Coordinator' },
                  { key: 'dordc_available', role: 'dordc', label: 'DoRDC' },
                  { key: 'dra_available', role: 'dra', label: 'DRA' },
                  { key: 'director_available', role: 'director', label: 'Vice Chancellor' },
                  { key: 'doctoral_available', role: 'doctoral', label: 'Doctoral' },
                ].map((role) => (
                  <div key={role.key} className="availability-item-editable">
                    <span className="availability-label">{role.label}</span>
                    <button
                      className={`availability-toggle ${selectedFormForManagement.general_form[role.key] ? 'available' : 'unavailable'}`}
                      onClick={() =>
                        handleToggleAvailability(
                          selectedFormForManagement.form_type,
                          role.role,
                          selectedFormForManagement.general_form[role.key]
                        )
                      }
                    >
                      {selectedFormForManagement.general_form[role.key] ? '✓ Available' : '✗ Unavailable'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <CustomButton
                text="View Instances"
                onClick={() => {
                  setIsManageFormModalOpen(false);
                  openInstancesModal(selectedFormForManagement);
                }}
              />
              <CustomButton
                text="Disable Form"
                onClick={() => handleDisableForm(selectedFormForManagement.form_type)}
              />
              <CustomButton
                text="Close"
                onClick={() => {
                  setIsManageFormModalOpen(false);
                  setSelectedFormForManagement(null);
                }}
              />
            </div>
          </div>
        )}
      </CustomModal>

      {/* Instances Management Modal */}
      <CustomModal
        isOpen={isInstancesModalOpen}
        onClose={() => {
          setIsInstancesModalOpen(false);
          setSelectedFormForInstances(null);
        }}
        title={`${selectedFormForInstances?.form_name || 'Form'} - Instances`}
        minHeight="500px"
        maxHeight="90vh"
        minWidth="900px"
        maxWidth="1200px"
      >
        {selectedFormForInstances && (
          <div className="instances-modal">
            <div className="instances-header-section">
              <div className="instances-summary">
                <h3>Total Instances: {selectedFormForInstances.instances.length}</h3>
                <p>Maximum allowed: {selectedFormForInstances.general_form.max_count}</p>
              </div>
              <CustomButton
                text="+ Create New Instance"
                onClick={() => handleCreateFormInstance(selectedFormForInstances.form_type)}
              />
            </div>

            {selectedFormForInstances.instances.length === 0 ? (
              <div className="empty-instances">
                <p>No instances created yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="instances-list">
                {selectedFormForInstances.instances.map((instance) => (
                  <div key={instance.id} className="instance-detail-card">
                    <div className="instance-card-header">
                      <div className="instance-title-group">
                        <span className="instance-id-badge">ID: {instance.id}</span>
                        <span className={`status-badge ${instance.completion}`}>
                          {instance.completion}
                        </span>
                      </div>
                      <button
                        className="delete-instance-btn"
                        onClick={() => handleDeleteForm(selectedFormForInstances.form_type, instance.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <div className="instance-card-body">
                      <div className="instance-controls">
                        <div className="control-group">
                          <label>Stage</label>
                          <select
                            value={instance.stage}
                            onChange={(e) => {
                              const newStage = e.target.value;
                              const stageIndex = instance.steps?.indexOf(newStage);
                              
                              if (stageIndex >= 0) {
                                // Calculate new maximum_step: max of current maximum_step and new current_step
                                const newCurrentStep = stageIndex;
                                const newMaximumStep = Math.max(instance.maximum_step || 0, newCurrentStep);
                                
                                // Update stage, current_step, and maximum_step
                                handleUpdateStage(
                                  selectedFormForInstances.form_type,
                                  instance.id,
                                  newStage,
                                  newCurrentStep
                                );
                                
                                // Also update maximum_step if it changed
                                if (newMaximumStep !== instance.maximum_step) {
                                  handleUpdateSteps(
                                    selectedFormForInstances.form_type,
                                    instance.id,
                                    newCurrentStep,
                                    newMaximumStep
                                  );
                                }
                              }
                            }}
                            className="control-select"
                          >
                            {instance.steps?.map((step) => (
                              <option key={step} value={step}>
                                {stageOptions.find(opt => opt.value === step)?.label || step}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="control-group">
                          <label>Current Step (Index in Steps)</label>
                          <input
                            type="number"
                            value={instance.current_step || 0}
                            min="0"
                            max={(instance.steps?.length || 1) - 1}
                            onChange={(e) => {
                              const newCurrentStep = parseInt(e.target.value);
                              const newMaximumStep = Math.max(instance.maximum_step || 0, newCurrentStep);
                              handleUpdateSteps(
                                selectedFormForInstances.form_type,
                                instance.id,
                                newCurrentStep,
                                newMaximumStep
                              );
                            }}
                            className="control-input"
                          />
                        </div>

                        <div className="control-group">
                          <label>Maximum Step (Max Reached)</label>
                          <input
                            type="number"
                            value={instance.maximum_step || 0}
                            min={instance.current_step || 0}
                            max={(instance.steps?.length || 1) - 1}
                            onChange={(e) =>
                              handleUpdateSteps(
                                selectedFormForInstances.form_type,
                                instance.id,
                                instance.current_step,
                                parseInt(e.target.value)
                              )
                            }
                            className="control-input"
                          />
                        </div>

                        <div className="control-group full-width">
                          <label>Steps Sequence (Current: {instance.steps?.[instance.current_step] || 'N/A'})</label>
                          <span className="steps-display-modal">
                            {instance.steps?.map((step, idx) => (
                              <span key={idx} className={idx === instance.current_step ? 'current-step' : idx <= (instance.maximum_step || 0) ? 'reached-step' : ''}>
                                {step}
                                {idx < instance.steps.length - 1 ? ' → ' : ''}
                              </span>
                            )) || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="instance-section">
                        <h4>Locks Control</h4>
                        <div className="locks-grid-modal">
                          {lockRoles.map((role) => (
                            <div key={role} className="lock-item-modal">
                              <span className="lock-label">
                                {role === 'faculty' ? 'Supervisor' : role.replace(/_/g, ' ')}
                              </span>
                              <button
                                className={`lock-toggle-modal ${instance.locks[role] ? "locked" : "unlocked"}`}
                                onClick={() =>
                                  handleToggleLock(
                                    selectedFormForInstances.form_type,
                                    instance.id,
                                    role,
                                    instance.locks[role]
                                  )
                                }
                              >
                                {instance.locks[role] ? "🔒 Locked" : "🔓 Unlocked"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* <div className="instance-section">
                        <h4>Approvals Status</h4>
                        <div className="approvals-grid-modal">
                          {Object.entries(instance.approvals).map(([role, approved]) => (
                            <div key={role} className="approval-item-modal">
                              <span className="approval-label">
                                {role === 'faculty' ? 'Supervisor' : role.replace(/_/g, ' ')}
                              </span>
                              <span className={`approval-status-modal ${approved ? "approved" : "pending"}`}>
                                {approved ? "✓ Approved" : "✗ Pending"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div> */}

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CustomModal>
    </div>
    </Layout>
  );
};

export default AdminFormManagement;
