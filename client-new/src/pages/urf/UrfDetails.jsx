import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import UrfRecord from '../../components/urf/UrfRecord';
import { apiUrfShow, apiUrfStatus } from '../../api/urf';

// The decisions open to the admin at each stage. The server accepts any stage,
// but these are the moves the fellowship actually makes.
const DECISIONS = {
  applied: [
    { status: 'selected', label: 'Select' },
    { status: 'rejected', label: 'Reject', variant: 'secondary' },
  ],
  selected: [
    { status: 'ongoing', label: 'Mark Ongoing' },
    { status: 'rejected', label: 'Reject', variant: 'secondary' },
  ],
  ongoing: [{ status: 'completed', label: 'Mark Completed' }],
  rejected: [{ status: 'applied', label: 'Reconsider', variant: 'secondary' }],
  completed: [],
};

/** Admin → URF → one project: its complete record and the decision on it. */
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
      <PageHeader
        title={record?.project_title || 'URF Project'}
        subtitle="Undergraduate Research Fellowship"
        actions={record && DECISIONS[record.status]?.map((d) => (
          <CustomButton key={d.status} text={d.label} variant={d.variant} onClick={() => setPending(d)} />
        ))}
      />
      {record && <UrfRecord record={record} />}

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
