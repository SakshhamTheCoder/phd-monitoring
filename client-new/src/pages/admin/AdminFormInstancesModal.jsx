import React from "react";
import CustomModal from "../../components/forms/modal/CustomModal";
import CustomButton from "../../components/forms/fields/CustomButton";
import { EMPTY_VALUE } from "../../utils/timeParse";

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
      title={`${form?.form_name || 'Form'} - Instances`}
        minHeight="500px"
        maxHeight="90vh"
        minWidth="900px"
        maxWidth="1200px"
      >
        {form && (
          <div className="instances-modal">
            <div className="instances-header-section">
              <div className="instances-summary">
                <h3>Total Instances: {form.instances.length}</h3>
                <p>Maximum allowed: {form.general_form.max_count}</p>
              </div>
              <CustomButton
                text="+ Create New Instance"
                onClick={() => onCreateInstance(form.form_type)}
              />
            </div>

            {form.instances.length === 0 ? (
              <div className="empty-instances">
                <p>No instances yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="instances-list">
                {form.instances.map((instance) => (
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
                        onClick={() => onDeleteForm(form.form_type, instance.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <div className="instance-card-body">
                      <div className="instance-controls">
                        <div className="control-group">
                          <label htmlFor={`admin-form-management-stage-${instance.id}`}>Stage</label>
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
                          <label htmlFor={`admin-form-management-current-step-index-in-steps-${instance.id}`}>Current Step (Index in Steps)</label>
                          <input id={`admin-form-management-current-step-index-in-steps-${instance.id}`}
                            type="number"
                            value={instance.current_step || 0}
                            min="0"
                            max={(instance.steps?.length || 1) - 1}
                            onChange={(e) => {
                              const newCurrentStep = parseInt(e.target.value);
                              const newMaximumStep = Math.max(instance.maximum_step || 0, newCurrentStep);
                              onUpdateSteps(
                                form.form_type,
                                instance.id,
                                newCurrentStep,
                                newMaximumStep
                              );
                            }}
                            className="control-input"
                          />
                        </div>

                        <div className="control-group">
                          <label htmlFor={`admin-form-management-maximum-step-max-reached-${instance.id}`}>Maximum Step (Max Reached)</label>
                          <input id={`admin-form-management-maximum-step-max-reached-${instance.id}`}
                            type="number"
                            value={instance.maximum_step || 0}
                            min={instance.current_step || 0}
                            max={(instance.steps?.length || 1) - 1}
                            onChange={(e) =>
                              onUpdateSteps(
                                form.form_type,
                                instance.id,
                                instance.current_step,
                                parseInt(e.target.value)
                              )
                            }
                            className="control-input"
                          />
                        </div>

                        <div className="control-group full-width">
                          <label>Steps Sequence (Current: {instance.steps?.[instance.current_step] || EMPTY_VALUE})</label>
                          <span className="steps-display-modal">
                            {instance.steps?.map((step, idx) => (
                              <span key={idx} className={idx === instance.current_step ? 'current-step' : idx <= (instance.maximum_step || 0) ? 'reached-step' : ''}>
                                {step}
                                {idx < instance.steps.length - 1 ? ' → ' : ''}
                              </span>
                            )) || EMPTY_VALUE}
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
