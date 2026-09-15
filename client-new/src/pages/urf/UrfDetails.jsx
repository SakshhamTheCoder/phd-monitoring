import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import UrfRecord, { URF_STATUSES, capitalize } from '../../components/urf/UrfRecord';
import { apiUrfShow, apiUrfStatus } from '../../api/urf';

/** Admin → URF → one project, with the control that moves it between stages. */
const UrfDetails = () => {
  const { id } = useParams();
  const [record, setRecord] = useState(null);

  const load = useCallback(async () => {
    const res = await apiUrfShow(id);
    if (res.success) setRecord(res.response);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status) => {
    const res = await apiUrfStatus(id, status);
    if (res.success) {
      toast.success(`Project marked ${status}`);
      load();
    }
  };

  return (
    <Layout>
      <PageHeader
        title={record?.project_title || 'URF Project'}
        subtitle="Undergraduate Research Fellowship"
        actions={record && (
          <label className="input-label">
            Status{' '}
            <select className="input-field" value={record.status} onChange={(e) => changeStatus(e.target.value)}>
              {URF_STATUSES.map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
            </select>
          </label>
        )}
      />
      {record && <UrfRecord record={record} />}
    </Layout>
  );
};

export default UrfDetails;
