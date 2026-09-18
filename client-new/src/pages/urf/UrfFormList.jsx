import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import FilterBar from '../../components/filterBar/FilterBar';
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
 * and a row opens that submission's own page, which holds what was filled in
 * and what each step of the chain said about it.
 */
const UrfFormList = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ conditions: [] });

  return (
    <Layout>
      <PageHeader title={TITLES[pathname.split('/').pop()]} subtitle="Undergraduate Research Fellowship" />
      <FilterBar
        placeholder="Search by project, student, roll no or mentor…"
        onSearch={setFilters}
      />
      <div className="urf-list">
        <PagenationTable
          endpoint={pathname}
          filters={filters}
          enableSelect={false}
          customOpenForm={(row) => navigate(`${pathname}/${row.id}`)}
        />
      </div>
    </Layout>
  );
};

export default UrfFormList;
