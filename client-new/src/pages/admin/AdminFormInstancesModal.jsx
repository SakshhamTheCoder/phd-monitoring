import React from "react";
import CustomModal from "../../components/forms/modal/CustomModal";
import CustomButton from "../../components/forms/fields/CustomButton";
import StatusNotice from "../../components/common/StatusNotice";

// A step's lock is kept per role; the supervisor step is 'faculty' in the step
// list and in the lock keys, and stored as 'supervisor' on the stage.
const stepOf = (stage) => (stage === "supervisor" ? "faculty" : stage);

/**
 * Every instance of one form, drawn as the chain it goes through.
 *
 * It used to be a stage select, two raw step-index boxes and a lock for every
 * role in the portal, whether or not the form has that step. The chain says
 * the same things in the form's own order: which steps are done, which one it
 * waits on, and whose answers are locked. Moving the form is one action on the
 * step it should go to.
 */
const AdminFormInstancesModal = ({
  isOpen,
  form,
  stageOptions,
  onClose,
  onCreateInstance,
  onDeleteForm,
  onToggleLock,
  onMoveTo,
}) => {
  const labelOf = (step) => stageOptions.find((option) => option.value === step)?.label || step;

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${form?.form_name || 'Form'}: instances`}
      maxHeight="90vh"
      maxWidth="760px"
      minHeight="auto"
    >
      {form && (
        <div className="afm-instances">
          <div className="afm-instances-head">
            <p className="afm-muted">
              {form.instances.length} of {form.general_form.max_count} allowed. A form waits on one step at
              a time; move it to send it back or on, and the person at that step can act on it.
            </p>
            <CustomButton
              text="Create new instance"
              variant="secondary"
              onClick={() => onCreateInstance(form.form_type)}
              disabled={form.instances.length >= form.general_form.max_count}
            />
          </div>

          {form.instances.length === 0 ? (
            <StatusNotice tone="empty">No instances yet. Create one to start this form for the scholar.</StatusNotice>
          ) : (
            <div className="afm-instance-list">
              {form.instances.map((instance) => {
                const steps = (instance.steps || []).filter((step) => step !== "complete");
                const complete = instance.completion === "complete" || instance.stage === "complete";
                const current = complete ? steps.length : steps.indexOf(stepOf(instance.stage));
                return (
                  <section key={instance.id} className="afm-instance" aria-label={`Instance ${instance.id}`}>
                    <div className="afm-instance-head">
                      <div className="afm-instance-title">
                        <span className="afm-instance-id">Instance {instance.id}</span>
                        <span className={`badge ${complete ? "badge--success" : "badge--warning"}`}>
                          {complete ? "Complete" : `Waiting on ${labelOf(stepOf(instance.stage))}`}
                        </span>
                      </div>
                      <CustomButton
                        text="Delete"
                        variant="danger-outline"
                        size="sm"
                        onClick={() => onDeleteForm(form.form_type, instance.id)}
                      />
                    </div>

                    <ol className="afm-chain">
                      {steps.map((step, index) => {
                        const state = index < current ? "done" : index === current ? "current" : "ahead";
                        const locked = !!instance.locks?.[step];
                        return (
                          <li key={step} className={`afm-chain-step afm-chain-step--${state}`}>
                            <span className="afm-chain-marker" aria-hidden="true">
                              {state === "done" ? <i className="fa fa-check" /> : index + 1}
                            </span>
                            <span className="afm-chain-name">{labelOf(step)}</span>
                            <span className="afm-chain-state">
                              {state === "done" ? "Done" : state === "current" ? "Waiting here" : "Not reached yet"}
                            </span>
                            <button
                              type="button"
                              className={`afm-lock${locked ? " is-locked" : ""}`}
                              aria-pressed={locked}
                              title={locked ? "Their answers are locked. Press to let them edit again." : "They can still edit. Press to lock their answers."}
                              onClick={() => onToggleLock(form.form_type, instance.id, step, locked)}
                            >
                              <i className={`fa ${locked ? "fa-lock" : "fa-unlock"}`} aria-hidden="true" />
                              {locked ? " Locked" : " Editable"}
                            </button>
                            {state === "current" ? (
                              <span className="afm-chain-here">Current</span>
                            ) : (
                              <CustomButton
                                text="Move here"
                                variant="quiet"
                                size="sm"
                                onClick={() => onMoveTo(form.form_type, instance, step, instance.steps.indexOf(step))}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </CustomModal>
  );
};

export default AdminFormInstancesModal;
