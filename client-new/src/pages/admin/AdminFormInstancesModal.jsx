import React, { useState } from "react";
import CustomModal from "../../components/forms/modal/CustomModal";
import CustomButton from "../../components/forms/fields/CustomButton";
import StatusNotice from "../../components/common/StatusNotice";
import { EMPTY_VALUE } from "../../utils/timeParse";

/**
 * A step number, sent when the user leaves the field or presses Enter.
 * Sending on every keystroke posted each digit on its way ("1" then "12"),
 * a cleared field went out as null, and the answers could land out of order.
 * The caller keys it on the saved value, so a fresh answer resets the draft.
 */
const StepInput = ({ id, value, min, max, onCommit }) => {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const next = parseInt(draft, 10);
    if (Number.isNaN(next) || next === value) {
      setDraft(String(value));
      return;
    }
    onCommit(next);
  };
  return (
    <input
      id={id}
      type="number"
      value={draft}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      // Enter commits by leaving the field, so the blur does not send it twice.
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="input-field"
    />
  );
};

/**
 * Every instance of one form: its stage, its steps, and the locks per role.
 *
 * Was 195 lines inside AdminFormManagement, which also holds the student
 * search, the form list and two more dialogs. It reads one form and calls the
 * page's handlers; nothing else is shared.
 */
const AdminFormInstancesModal = ({
  isOpen,
  form,
  lockRoles,
  stageOptions,
  onClose,
  onCreateInstance,
  onDeleteForm,
  onToggleLock,
  onUpdateStage,
  onUpdateSteps,
}) => (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${form?.form_name || 'Form'} - instances`}
        minHeight="500px"
        maxHeight="90vh"
        minWidth="900px"
        maxWidth="1200px"
      >
        {form && (
          <div className="afm-instances">
            <div className="afm-instances-head">
              <div>
                <h3 className="afm-section-title">Total instances: {form.instances.length}</h3>
                <p className="afm-muted">Maximum allowed: {form.general_form.max_count}</p>
              </div>
              <CustomButton
                text="Create new instance"
                onClick={() => onCreateInstance(form.form_type)}
              />
            </div>

            {form.instances.length === 0 ? (
              <StatusNotice tone="empty">No instances yet. Create one to get started.</StatusNotice>
            ) : (
              <div className="afm-instance-list">
                {form.instances.map((instance) => (
                  <div key={instance.id} className="afm-instance">
                    <div className="afm-instance-head">
                      <div className="afm-instance-title">
                        <span className="badge badge--accent">ID: {instance.id}</span>
                        <span className={`badge ${instance.completion === 'complete' ? 'badge--success' : 'badge--warning'}`}>
                          {instance.completion}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn danger"
                        onClick={() => onDeleteForm(form.form_type, instance.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <div className="afm-instance-body">
                      <div className="afm-controls">
                        <div className="afm-control">
                          <label className="afm-control-label" htmlFor={`admin-form-management-stage-${instance.id}`}>Stage</label>
                          <select id={`admin-form-management-stage-${instance.id}`}
                            value={instance.stage}
                            onChange={(e) => {
                              const newStage = e.target.value;
                              const stageIndex = instance.steps?.indexOf(newStage);
                              
                              if (stageIndex >= 0) {
                                // Calculate new maximum_step: max of current maximum_step and new current_step
                                const newCurrentStep = stageIndex;
                                const newMaximumStep = Math.max(instance.maximum_step || 0, newCurrentStep);
                                
                                // Update stage, current_step, and maximum_step
                                onUpdateStage(
                                  form.form_type,
                                  instance.id,
                                  newStage,
                                  newCurrentStep
                                );
                                
                                // Also update maximum_step if it changed
                                if (newMaximumStep !== instance.maximum_step) {
                                  onUpdateSteps(
                                    form.form_type,
                                    instance.id,
                                    newCurrentStep,
                                    newMaximumStep
                                  );
                                }
                              }
                            }}
                            className="input-field"
                          >
                            {instance.steps?.map((step) => (
                              <option key={step} value={step}>
                                {stageOptions.find(opt => opt.value === step)?.label || step}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="afm-control">
                          <label className="afm-control-label" htmlFor={`admin-form-management-current-step-index-in-steps-${instance.id}`}>Current step (index in steps)</label>
                          <StepInput
                            key={instance.current_step || 0}
                            id={`admin-form-management-current-step-index-in-steps-${instance.id}`}
                            value={instance.current_step || 0}
                            min="0"
                            max={(instance.steps?.length || 1) - 1}
                            onCommit={(newCurrentStep) => {
                              const newMaximumStep = Math.max(instance.maximum_step || 0, newCurrentStep);
                              onUpdateSteps(
                                form.form_type,
                                instance.id,
                                newCurrentStep,
                                newMaximumStep
                              );
                            }}
                          />
                        </div>

                        <div className="afm-control">
                          <label className="afm-control-label" htmlFor={`admin-form-management-maximum-step-max-reached-${instance.id}`}>Maximum step (max reached)</label>
                          <StepInput
                            key={instance.maximum_step || 0}
                            id={`admin-form-management-maximum-step-max-reached-${instance.id}`}
                            value={instance.maximum_step || 0}
                            min={instance.current_step || 0}
                            max={(instance.steps?.length || 1) - 1}
                            onCommit={(newMaximumStep) =>
                              onUpdateSteps(
                                form.form_type,
                                instance.id,
                                instance.current_step,
                                newMaximumStep
                              )
                            }
                          />
                        </div>

                        <div className="afm-control afm-control--wide">
                          <span className="afm-control-label">Steps sequence (current: {instance.steps?.[instance.current_step] || EMPTY_VALUE})</span>
                          <span className="afm-steps">
                            {instance.steps?.map((step, idx) => (
                              <span key={idx} className={idx === instance.current_step ? 'afm-step-current' : idx <= (instance.maximum_step || 0) ? 'afm-step-reached' : ''}>
                                {step}
                                {idx < instance.steps.length - 1 ? ' → ' : ''}
                              </span>
                            )) || EMPTY_VALUE}
                          </span>
                        </div>
                      </div>

                      <div className="afm-locks">
                        <h4 className="afm-section-title">Locks control</h4>
                        <div className="afm-toggle-grid">
                          {lockRoles.map((role) => (
                            <div key={role} className="afm-toggle-item">
                              <span className="afm-toggle-label afm-toggle-label--role">
                                {role === 'faculty' ? 'Supervisor' : role.replace(/_/g, ' ')}
                              </span>
                              <button
                                type="button"
                                className={`row-action-btn${instance.locks[role] ? " danger" : ""}`}
                                onClick={() =>
                                  onToggleLock(
                                    form.form_type,
                                    instance.id,
                                    role,
                                    instance.locks[role]
                                  )
                                }
                              >
                                <i className={`fa ${instance.locks[role] ? "fa-lock" : "fa-unlock"}`} aria-hidden="true" />
                                {instance.locks[role] ? " Locked" : " Unlocked"}
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
);

export default AdminFormInstancesModal;
