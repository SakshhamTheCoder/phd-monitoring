import React, { useState, useEffect, useMemo, useRef } from "react";
import { customFetch, NETWORK_ERROR_MESSAGE } from "../../api/base";
import { baseURL } from "../../api/urls";
import { EMPTY_VALUE } from "../../utils/timeParse";
import { useLoading } from "../../context/LoadingContext";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import CustomButton from "../../components/forms/fields/CustomButton";
import GridContainer from "../../components/forms/fields/GridContainer";
import InputField from "../../components/forms/fields/InputField";
import DropdownField from "../../components/forms/fields/DropdownField";
import CustomModal from "../../components/forms/modal/CustomModal";
import AdminFormInstancesModal from "./AdminFormInstancesModal";
import "./AdminFormManagement.css";
import Page from "../../components/page/Page";
import Panel from "../../components/panel/Panel";
import StatusNotice from "../../components/common/StatusNotice";

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
  // Which student's forms the page is waiting for. Picking a second student
  // before the first answer lands must not show the first student's forms
  // under the second one's name.
  const latestFormsRequest = useRef(0);
  // A double click on Enable created two instances.
  const creatingForm = useRef(false);

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

  // Toast is off on these calls because customFetch renders a 400 body as
  // "message: ...", so the server's reason is shown from here instead.
  const toastFailure = (response, fallback) =>
    toast.error(
      response.networkError
        ? NETWORK_ERROR_MESSAGE
        : response.response?.message || fallback
    );

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
      } else {
        toastFailure(response, "Failed to fetch students.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Returns the fresh forms (null on failure) so a caller that also needs
  // them for an open modal does not fetch the same list a second time.
  const fetchStudentForms = async (studentId) => {
    const request = (latestFormsRequest.current += 1);
    setLoading(true);
    try {
      const response = await customFetch(
        baseURL + `/admin/forms/student/${studentId}`,
        "GET",
        {},
        false
      );
      if (request !== latestFormsRequest.current) return null;
      if (response.success) {
        const forms = response.response.forms || [];
        setStudentForms(forms);
        setSelectedStudent(response.response.student);
        return forms;
      }
      toastFailure(response, "Failed to fetch student forms.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (studentId) => {
    if (studentId) {
      fetchStudentForms(studentId);
    } else {
      latestFormsRequest.current += 1;
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
          const unlocked = await customFetch(
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
          // The stage moved but whoever holds it cannot act until it unlocks.
          if (!unlocked.success) {
            toast.warn("Stage updated, but it could not be unlocked for the new step. Unlock it from the controls.");
          }
        }

        toast.success("Stage updated.");
        const updatedForms = await fetchStudentForms(selectedStudent.roll_no);

        // Update the selected form for instances modal if it's open
        if (updatedForms && selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      } else {
        toastFailure(response, "Failed to update stage.");
      }
    } finally {
      setLoading(false);
    }
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
        toast.success(`${roleLabels[role]} availability ${!currentValue ? "enabled" : "disabled"}.`);
        const updatedForms = await fetchStudentForms(selectedStudent.roll_no);

        // Update the selected form for management modal if it's open
        if (updatedForms && selectedFormForManagement &&selectedFormForManagement.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForManagement(updatedForm);
          }
        }
      } else {
        toastFailure(response, "Failed to toggle availability.");
      }
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
        toast.success("Form disabled.");
        await fetchStudentForms(selectedStudent.roll_no);
        setIsManageFormModalOpen(false);
        setSelectedFormForManagement(null);
      } else {
        toastFailure(response, "Failed to disable form.");
      }
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
        toast.success(`Lock ${!currentValue ? "enabled" : "disabled"}.`);
        const updatedForms = await fetchStudentForms(selectedStudent.roll_no);

        // Update the selected form for instances modal if it's open
        if (updatedForms && selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      } else {
        toastFailure(response, "Failed to toggle lock.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Both creators return whether the call succeeded, so the Enable dialog
  // stays open, with its choice, when it failed.
  const handleEnableForm = async (formType) => {
    if (creatingForm.current) return false;
    creatingForm.current = true;
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
        toast.success("Form enabled.");
        await fetchStudentForms(selectedStudent.roll_no);
        return true;
      }
      toastFailure(response, "Failed to enable form.");
      return false;
    } finally {
      creatingForm.current = false;
      setLoading(false);
    }
  };

  const handleCreateFormInstance = async (formType) => {
    if (creatingForm.current) return false;
    creatingForm.current = true;
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
        toast.success("Form instance created.");
        const updatedForms = await fetchStudentForms(selectedStudent.roll_no);

        // Update the selected form for instances modal if it's open
        if (updatedForms && selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
        return true;
      }
      toastFailure(response, "Failed to create form instance.");
      return false;
    } finally {
      creatingForm.current = false;
      setLoading(false);
    }
  };

  const handleCreateForm = async () => {
    if (!createFormType) {
      toast.error("Please select a form type");
      return;
    }

    const selectedForm = studentForms.find(f => f.form_type === createFormType);

    const created = selectedForm?.exists_in_forms_table
      ? await handleCreateFormInstance(createFormType)
      : await handleEnableForm(createFormType);

    if (created) closeCreateModal();
  };

  // The dropdown starts at Select every time the dialog opens, so the type
  // picked last time must go with it or Enable would act on a hidden choice.
  const closeCreateModal = () => {
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
        toast.success("Form deleted.");
        const updatedForms = await fetchStudentForms(selectedStudent.roll_no);

        // Update the selected form for instances modal if it's open
        if (updatedForms && selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      } else {
        toastFailure(response, "Failed to delete form.");
      }
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
        toast.success("Steps updated.");
        const updatedForms = await fetchStudentForms(selectedStudent.roll_no);

        // Update the selected form for instances modal if it's open
        if (updatedForms && selectedFormForInstances && selectedFormForInstances.form_type === formType) {
          const updatedForm = updatedForms.find(f => f.form_type === formType);
          if (updatedForm) {
            setSelectedFormForInstances(updatedForm);
          }
        }
      } else {
        toastFailure(response, "Failed to update steps.");
      }
    } finally {
      setLoading(false);
    }
  };

  // The full student list is large, so the options are rebuilt only when
  // the list or the search changes, not on every render.
  const studentOptions = useMemo(() => {
    const needle = searchTerm.toLowerCase();
    return students
      .filter(
        (student) =>
          student.roll_no?.toString().includes(searchTerm) ||
          student.name?.toLowerCase().includes(needle)
      )
      .map((s) => ({
        title: `${s.roll_no} - ${s.name}`,
        value: s.roll_no,
      }));
  }, [students, searchTerm]);

  return (
    <Page
      title="Admin form management"
      description="Manage form stages, locks, and availability per student"
    >
      <Panel>
        <GridContainer
          elements={[
            <InputField
              label="Search student"
              hint="Search by roll number or name..."
              initialValue={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />,
            // Named so a ?roll_no= link shows whose forms these are.
            <DropdownField
              label="Select student"
              options={studentOptions}
              initialValue={selectedStudent?.roll_no}
              onChange={(value) => handleStudentSelect(value)}
            />,
          ]}
        />
      </Panel>

      {selectedStudent && (
        <>
          <Panel title={selectedStudent.name}>
            <dl className="facts">
              <div>
                <dt>Roll no</dt>
                <dd>{selectedStudent.roll_no}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{selectedStudent.department}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            flush
            title={`Available forms (${studentForms.length})`}
            actions={
              <CustomButton
                text="Enable new form"
                onClick={() => setIsCreateModalOpen(true)}
              />
            }
          >
            {studentForms.length === 0 ? (
              <div className="afm-state">
                <StatusNotice tone="empty">No forms available for this student yet.</StatusNotice>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Form</th>
                      <th>Type</th>
                      <th>Stage</th>
                      <th>Instances</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentForms.map((form) => (
                      <tr key={form.form_type}>
                        <td className="afm-form-name">{form.form_name}</td>
                        <td><span className="badge badge--neutral">{form.form_type}</span></td>
                        {form.exists_in_forms_table ? (
                          <>
                            <td><span className="badge badge--info">{form.general_form.stage}</span></td>
                            <td>{form.general_form.count} / {form.general_form.max_count}</td>
                            <td>
                              <div className="afm-row-actions">
                                <CustomButton
                                  text="Manage form"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openManageFormModal(form)}
                                />
                                <CustomButton
                                  text="View instances"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openInstancesModal(form)}
                                />
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td colSpan={2}>
                              <span className="badge badge--neutral">Not enabled</span>
                              <p className="afm-muted">Enable this form to allow students to submit</p>
                            </td>
                            <td>
                              <div className="afm-row-actions">
                                <CustomButton
                                  text="Enable form"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleEnableForm(form.form_type)}
                                />
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {/* Create/Enable Form Modal */}
      <CustomModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Enable new form type"
        minHeight="300px"
        maxHeight="500px"
        minWidth="500px"
        maxWidth="600px"
      >
        <GridContainer
          elements={[
            <DropdownField
              label="Select form type"
              options={studentForms.map((f) => ({
                  title: f.form_name,
                  value: f.form_type,
                }))}
              onChange={(value) => setCreateFormType(value)}
            />,
          ]}
          space={2}
        />

        <p className="modal-note afm-create-note">
          This will enable the selected form type for {selectedStudent?.name},
          allowing them to create submissions.
        </p>

        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={closeCreateModal} />
          <CustomButton text="Enable" onClick={handleCreateForm} />
        </div>
      </CustomModal>

      {/* Manage Form Modal */}
      <CustomModal
        isOpen={isManageFormModalOpen}
        onClose={() => {
          setIsManageFormModalOpen(false);
          setSelectedFormForManagement(null);
        }}
        title={`Manage ${selectedFormForManagement?.form_name || 'form'}`}
        minHeight="400px"
        maxHeight="700px"
        minWidth="600px"
        maxWidth="800px"
      >
        {selectedFormForManagement && (
          <>
            <section className="afm-section">
              <h3 className="afm-section-title">Form overview</h3>
              <dl className="facts">
                <div>
                  <dt>Form type</dt>
                  <dd><span className="badge badge--neutral">{selectedFormForManagement.form_type}</span></dd>
                </div>
                <div>
                  <dt>Current stage</dt>
                  <dd><span className="badge badge--info">{selectedFormForManagement.general_form.stage}</span></dd>
                </div>
                <div>
                  <dt>Instance count</dt>
                  <dd>
                    {selectedFormForManagement.general_form.count} / {selectedFormForManagement.general_form.max_count}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="afm-section">
              <h3 className="afm-section-title">Role availability</h3>
              <p className="afm-section-description">Toggle role access for this form type</p>
              <div className="afm-toggle-grid">
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
                  <div key={role.key} className="afm-toggle-item">
                    <span className="afm-toggle-label">{role.label}</span>
                    <button
                      type="button"
                      className={`row-action-btn${selectedFormForManagement.general_form[role.key] ? '' : ' danger'}`}
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
            </section>

            <div className="modal-actions">
              <CustomButton
                text="View instances"
                variant="secondary"
                onClick={() => {
                  setIsManageFormModalOpen(false);
                  openInstancesModal(selectedFormForManagement);
                }}
              />
              <CustomButton
                text="Disable form"
                variant="danger"
                onClick={() => handleDisableForm(selectedFormForManagement.form_type)}
              />
              <CustomButton
                text="Close"
                variant="quiet"
                onClick={() => {
                  setIsManageFormModalOpen(false);
                  setSelectedFormForManagement(null);
                }}
              />
            </div>
          </>
        )}
      </CustomModal>

      {/* Instances Management Modal */}
      <AdminFormInstancesModal
        isOpen={isInstancesModalOpen}
        form={selectedFormForInstances}
        lockRoles={lockRoles}
        stageOptions={stageOptions}
        onClose={() => {
          setIsInstancesModalOpen(false);
          setSelectedFormForInstances(null);
        }}
        onCreateInstance={handleCreateFormInstance}
        onDeleteForm={handleDeleteForm}
        onToggleLock={handleToggleLock}
        onUpdateStage={handleUpdateStage}
        onUpdateSteps={handleUpdateSteps}
      />
    </Page>
  );
};

export default AdminFormManagement;
