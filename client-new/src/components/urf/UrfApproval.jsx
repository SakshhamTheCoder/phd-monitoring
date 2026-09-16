import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import CustomModal from '../forms/modal/CustomModal';
import { apiUrfDecide } from '../../api/urf';
import './UrfForms.css';

const STEP_NAMES = {
  student: 'the student',
  mentor: 'the faculty mentor',
  adordc: 'the ADORDC',
  dordc: 'the DORDC',
  complete: 'nobody, it is through',
};

const STEPS = ['student', 'mentor', 'adordc', 'dordc'];

/** Where a form has reached, written as a line anyone can read. */
export const stageLine = (form) => (form?.stage === 'complete'
  ? 'Approved by the mentor, the ADORDC and the DORDC.'
  : `Waiting on ${STEP_NAMES[form?.stage] || 'the student'}.`);

// What each answer means, and what it says once it is sent.
const DECISIONS = {
  approve: {
    label: 'Approve',
    title: 'Approve this form',
    blurb: 'It passes to the next reader, and the students are told.',
    prompt: 'Comments (optional)',
    done: 'Approved and passed on',
  },
  send_back: {
    label: 'Send back',
    title: 'Send this form back',
    blurb: 'Not as it stands. It goes back to the students to correct, and the reading starts again from the mentor once they resubmit.',
    prompt: 'What needs fixing',
    done: 'Sent back to the student',
  },
  reject: {
    label: 'Reject project',
    title: 'Reject this project',
    blurb: 'The project is over. The students are told why, and they can apply again in a later session.',
    prompt: 'Why the project is rejected',
    done: 'Project rejected',
  },
};

/**
 * Reading a URF form and answering it.
 *
 * Shown to whoever the form is waiting on. Approving passes it to the next
 * reader. Sending it back returns it to the student to correct. Rejecting ends
 * the project, which is the DORDC's alone, so the button is only there for
 * them. Anything but an approval has to say why, since the student reads it.
 */
const UrfApproval = ({ form, formKey, applicationId, onDecided }) => {
  const [pending, setPending] = useState(null);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  if (!form?.awaiting_me) return null;

  const choice = DECISIONS[pending];

  const send = async () => {
    if (pending !== 'approve' && !comments.trim()) {
      toast.error('Say why, so the students can read it.');
      return;
    }

    setSaving(true);
    const res = await apiUrfDecide(formKey, form.id, {
      decision: pending,
      comments: comments.trim() || null,
    });
    setSaving(false);
    if (!res.success) return;

    toast.success(choice.done);
    setPending(null);
    setComments('');
    onDecided();
  };

  return (
    <div className="urf-approval">
      <div className="urf-approval-row">
        <span>This form is with you.</span>
        <CustomButton text="Approve" onClick={() => setPending('approve')} />
        <CustomButton text="Send back" variant="secondary" onClick={() => setPending('send_back')} />
        {form.may_reject && (
          <CustomButton text="Reject project" variant="secondary" onClick={() => setPending('reject')} />
        )}
      </div>

      <CustomModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={choice?.title}
        minHeight="220px"
        maxWidth="520px"
      >
        <p>{choice?.blurb}</p>
        <div className="input-field-container">
          <label className="input-label" htmlFor="urf-decision-comments">
            {choice?.prompt}
          </label>
          <textarea
            id="urf-decision-comments"
            className="input-field"
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="secondary" onClick={() => setPending(null)} />
          <CustomButton
            text={saving ? 'Saving…' : choice?.label}
            onClick={send}
            disabled={saving}
          />
        </div>
      </CustomModal>
    </div>
  );
};

/** What each reader said, in the order they said it. */
export const UrfApprovalTrail = ({ form }) => {
  const said = STEPS.filter((step) => form?.[`${step}_comments`]);
  if (!form || (!said.length && !form.stage)) return null;

  return (
    <div className="urf-approval-trail">
      <p className="urf-approval-stage">{stageLine(form)}</p>
      {said.map((step) => (
        <p key={step}>
          <strong>{STEP_NAMES[step]}:</strong> {form[`${step}_comments`]}
        </p>
      ))}
    </div>
  );
};

export default UrfApproval;
