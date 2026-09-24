import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import RecommendationField from '../forms/fields/RecommendationField';
import { apiUrfDecide } from '../../api/urf';
import './UrfForms.css';

const ROLE_LABELS = { mentor: 'Faculty Mentor', adordc: 'ADORDC', dordc: 'DORDC' };

// The radio field answers with { approval, rejected }.
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
 * Answering a URF form. Rejected ends the project and is the DORDC's alone, so
 * the third radio is offered to nobody else.
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
          <CustomButton text="Submit" onClick={submit} busy={saving} />,
        ]}
      />
    </div>
  );
};

export default UrfApproval;
