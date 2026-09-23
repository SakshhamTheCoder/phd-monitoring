import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import UrfRecord from '../../components/urf/UrfRecord';
import LoadError from '../../components/common/LoadError';
import { apiUrfShow, apiUrfStatus } from '../../api/urf';

// An application is decided once: selected or rejected. A decided project
// offers no further decision.
const DECISIONS = {
  applied: [
    { status: 'selected', label: 'Select' },
    { status: 'rejected', label: 'Reject', variant: 'secondary' },
  ],
};

/** Admin, URF, one project, shown like a scholar's profile, with the decision on it. */
const UrfDetails = () => {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Refreshes the record after a decision, on the same id.
  const load = useCallback(async () => {
    const res = await apiUrfShow(id);
    if (res.success) setRecord(res.response);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    // Another project starts clean, so a decision cannot land on the last one.
    setRecord(null);
    setPending(null);
    setFailed(false);
    apiUrfShow(id).then((res) => {
      if (cancelled) return;
      if (res.success) setRecord(res.response);
      else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [id, attempt]);

  // Every change notifies the students, so it is confirmed before it is sent.
  const decide = async () => {
    setSaving(true);
    const res = await apiUrfStatus(id, pending.status);
    setSaving(false);
    if (res.success) {
      toast.success(`Project marked ${pending.status}`);
      setPending(null);
      load();
    }
  };

  return (
    <>
      {failed && (
        <LoadError message="Could not load this URF project. Check your connection and try again." onRetry={() => setAttempt((n) => n + 1)} />
      )}
      {record && (
        <UrfRecord
          record={record}
          actions={DECISIONS[record.status]?.map((d) => (
            <CustomButton key={d.status} text={d.label} variant={d.variant} onClick={() => setPending(d)} />
          ))}
        />
      )}

      <CustomModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={pending?.label}
        minHeight="140px"
        maxWidth="460px"
      >
        <p>
          Mark &ldquo;{record?.project_title}&rdquo; as <strong>{pending?.status}</strong>?
          The students on the project are notified.
        </p>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={() => setPending(null)} />
          <CustomButton text={pending?.label} onClick={decide} busy={saving} />
        </div>
      </CustomModal>
    </>
  );
};

export default UrfDetails;
