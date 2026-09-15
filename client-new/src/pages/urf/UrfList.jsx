import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomButton from '../../components/forms/fields/CustomButton';
import { URF_STATUSES, capitalize } from '../../components/urf/UrfRecord';
import { apiSettings, apiSaveSettings } from '../../api/settings';

/** Admin → URF: every application, by stage, with the filters the students page has. */
const UrfList = () => {
  const [filter, setFilter] = useState({ conditions: [] });
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    apiSettings('urf').then((res) => res.success && setOpen(!!res.response.applications_open));
  }, []);

  const toggleApplications = async () => {
    const res = await apiSaveSettings('urf', { applications_open: open ? 0 : 1 });
    if (res.success) {
      setOpen(!!res.response.applications_open);
      toast.success(res.response.applications_open ? 'URF applications opened' : 'URF applications closed');
    }
  };

  // A new object only when the search or the tab changes; the table refetches
  // whenever it receives a different one.
  const filters = useMemo(() => ({
    ...filter,
    mandatory_filter: tab === 'all' ? [] : [{ key: 'status', op: '=', value: tab }],
  }), [filter, tab]);

  return (
    <Layout>
      <PageHeader
        title="URF"
        subtitle={`Undergraduate Research Fellowship. Applications are ${open ? 'open' : 'closed'}.`}
        actions={open !== null && (
          <CustomButton text={open ? 'Close Applications' : 'Open Applications'} onClick={toggleApplications} />
        )}
      />
      <Tabs
        items={['all', ...URF_STATUSES].map((s) => ({ value: s, label: capitalize(s) }))}
        value={tab}
        onChange={setTab}
      />
      <FilterBar onSearch={setFilter} />
      <PagenationTable endpoint="/urf" filters={filters} enableSelect={false} />
    </Layout>
  );
};

export default UrfList;
