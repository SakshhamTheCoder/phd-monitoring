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

/**
 * Reading a URF form and saying yes or no.
 *
 * Shown to whoever the form is waiting on. Approving passes it to the next
 * reader; sending it back returns it to the student, who has to be told why,
 * so the reason is required.
 */
const UrfApproval = ({ form, formKey, applicationId, onDecided }) => {
  const [pending, setPending] = useState(null);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  if (!form?.awaiting_me) return null;

  const send = async () => {
    const approving = pending === 'approve';
    if (!approving && !comments.trim()) {
      toast.error('Say what needs fixing, so the student can answer it.');
      return;
    }

    setSaving(true);
    const res = await apiUrfDecide(formKey, form.id, {
      approval: approving,
      comments: comments.trim() || null,
    });
    setSaving(false);
    if (!res.success) return;

    toast.success(approving ? 'Approved and passed on' : 'Sent back to the student');
    setPending(null);
    setComments('');
    onDecided();
  };

  return (
    <div className="urf-approval">
      <div className="urf-approval-row">
        <span>This form is with you.</span>
        <CustomButton text="Approve" onClick={() => setPending('approve')} />
        <CustomButton text="Send back" variant="secondary" onClick={() => setPending('reject')} />
      </div>

      <CustomModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={pending === 'approve' ? 'Approve this form' : 'Send this form back'}
        minHeight="220px"
        maxWidth="520px"
      >
        <p>
          {pending === 'approve'
            ? 'It passes to the next reader, and the students are told.'
            : 'It goes back to the students to correct. Reading starts again from the mentor once they resubmit.'}
        </p>
        <div className="input-field-container">
          <label className="input-label" htmlFor="urf-decision-comments">
            {pending === 'approve' ? 'Comments (optional)' : 'What needs fixing'}
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
            text={saving ? 'Saving…' : (pending === 'approve' ? 'Approve' : 'Send back')}
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
