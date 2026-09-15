import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import SmartSearch from '../../components/search/SmartSearch';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import './UrfList.css';

const TITLES = {
  'urf-application': 'URF Application Form',
  'urf-additional-info': 'Additional Information Form',
  'urf-half-yearly-report': 'Half-yearly Progress Report',
  'urf-final-report': 'Final Report',
};

/**
 * Admin → URF → one form: who filled it in, listed the way the PhD form lists
 * are. The table and filter bar read the page's own path as their endpoint,
 * and a row opens the project the submission belongs to.
 */
const UrfFormList = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ conditions: [] });

  return (
    <Layout>
      <PageHeader title={TITLES[pathname.split('/').pop()]} subtitle="Undergraduate Research Fellowship" />
      <SmartSearch placeholder="Search by project, student, roll no or mentor…" onSearch={setFilters} />
      <div className="urf-list">
        <PagenationTable
          endpoint={pathname}
          filters={filters}
          enableSelect={false}
          customOpenForm={(row) => navigate(`/urf/${row.application_id ?? row.id}`)}
        />
      </div>
    </Layout>
  );
};

export default UrfFormList;
