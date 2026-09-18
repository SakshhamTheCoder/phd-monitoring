import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../../components/dashboard/layout';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import UrfRecord from '../../components/urf/UrfRecord';
import { apiUrfShow, apiUrfStatus } from '../../api/urf';

// An application is decided once: selected or rejected. A decided project
// offers no further decision.
const DECISIONS = {
  applied: [
    { status: 'selected', label: 'Select' },
    { status: 'rejected', label: 'Reject', variant: 'secondary' },
  ],
};

/** Admin → URF → one project, shown like a scholar's profile, with the decision on it. */
const UrfDetails = () => {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiUrfShow(id);
    if (res.success) setRecord(res.response);
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
    <Layout>
      {record && (
        <UrfRecord
          record={record}
          forms
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
          <CustomButton text="Cancel" variant="secondary" onClick={() => setPending(null)} />
          <CustomButton text={saving ? 'Saving…' : pending?.label} onClick={decide} disabled={saving} />
        </div>
      </CustomModal>
    </Layout>
  );
};

export default UrfDetails;
