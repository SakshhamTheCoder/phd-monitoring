import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import RecommendationField from '../forms/fields/RecommendationField';
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

const ROLE_LABELS = { mentor: 'Faculty Mentor', adordc: 'ADORDC', dordc: 'DORDC' };

/** Where a form has reached, written as a line anyone can read. */
export const stageLine = (form) => (form?.stage === 'complete'
  ? 'Approved by the mentor, the ADORDC and the DORDC.'
  : `Waiting on ${STEP_NAMES[form?.stage] || 'the student'}.`);

// The radio field answers with { approval, rejected }; the chain reads those
// three combinations as its three decisions.
const decisionFrom = ({ approval, rejected }) => {
  if (rejected) return 'reject';
  return approval ? 'approve' : 'send_back';
};

const SENT = {
  approve: 'Recommended and passed on',
  send_back: 'Sent back to the student',
  reject: 'Project rejected',
};

/**
 * Reading a URF form and answering it, on the same recommendation field the
 * PhD forms use.
 *
 * Recommend passes it to the next reader. Not recommended sends it back to the
 * student to correct, and the reading starts again from the mentor. Rejected
 * ends the project, which is the DORDC's alone, so the third radio is offered
 * to nobody else. Either of the last two has to say why, since the student
 * reads it.
 */
const UrfApproval = ({ form, formKey, onDecided }) => {
  const [answer, setAnswer] = useState(null);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  if (!form?.awaiting_me) return null;

  const decision = answer && decisionFrom(answer);

  const submit = async () => {
    if (!decision) {
      toast.error('Choose a recommendation first.');
      return;
    }
    if (decision !== 'approve' && !comments.trim()) {
      toast.error('Say why, so the students can read it.');
      return;
    }

    setSaving(true);
    const res = await apiUrfDecide(formKey, form.id, {
      decision,
      comments: comments.trim() || null,
    });
    setSaving(false);
    if (!res.success) return;

    toast.success(SENT[decision]);
    setAnswer(null);
    setComments('');
    onDecided();
  };

  return (
    <div className="urf-approval">
      <RecommendationField
        role={ROLE_LABELS[form.stage] || form.stage}
        title={`Recommendation of ${ROLE_LABELS[form.stage] || 'the reader'}:`}
        allowRejection={!!form.may_reject}
        onRecommendationChange={setAnswer}
      />

      <GridContainer
        elements={[
          <InputField
            label={decision === 'approve' ? 'Remarks (if any)' : 'Remarks'}
            initialValue={comments}
            hint="Enter Comments.."
            onChange={setComments}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <CustomButton text={saving ? 'Submitting…' : 'Submit'} onClick={submit} disabled={saving} />,
        ]}
      />
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
