import React from 'react';
import Recommendation from '../layouts/Recommendation';

// Renders a form's approval chain from `formData.steps`.
//
// `steps` is stored per form row, not per form type, so two forms of the same
// kind can legitimately carry different chains: a supervisor change raised
// before the student's IRB submission is complete skips DORDC and DRA
// (SupervisorChangeFormController::createForm). Driving the panels from the
// array means a form with a shorter chain shows the right panels without a
// frontend change, and a step the server adds appears on its own.
//
// This replaces RoleBasedWrapper, which took `steps` only to count how far the
// reader sat and took the panel order from the order of its JSX children. The
// two had to agree and nothing said so, which is how Synopsis Submission came
// to show every approver above the supervisor the panel of the step below them.
//
// `panels` names the steps that need a bespoke component. Every other step gets
// a plain Recommendation. `stepProps` carries the handful of per-step extras.

// The steps array calls the supervisor's step "faculty". The approvals,
// comments and locks maps in the same payload key that person as "supervisor",
// and so does Recommendation.
const roleForStep = (step) => (step === 'faculty' ? 'supervisor' : step);

// Terminator rather than an approver. It has no panel and nobody holds it as a
// role, so it must not reach Recommendation, which would title a panel with it.
const isApprovalStep = (step) => step !== 'complete';

const FormLadder = ({ formData, panels = {}, stepProps = {} }) => {
    const steps = formData?.steps || [];
    const reached = steps.indexOf(formData?.role);
    // Admin reviews every stage. Everyone else sees their own step and the ones
    // before it; a role the chain does not contain sees nothing, which is also
    // what the API would allow.
    const visible = formData?.role === 'admin' ? steps : steps.slice(0, reached + 1);

    return (
        <>
            {visible.filter(isApprovalStep).map((step) => {
                const Panel = panels[step];
                const extra = stepProps[step] || {};
                return Panel ? (
                    <Panel key={step} formData={formData} {...extra} />
                ) : (
                    <Recommendation
                        key={step}
                        formData={formData}
                        role={roleForStep(step)}
                        allowRejection={false}
                        {...extra}
                    />
                );
            })}
        </>
    );
};

export default FormLadder;
