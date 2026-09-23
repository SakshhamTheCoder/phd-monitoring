import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Page from '../../components/page/Page';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import DropdownField from '../../components/forms/fields/DropdownField';
import { apiUrfSessions } from '../../api/urf';
import useCapabilities, { useCapabilitiesKnown } from '../../context/CapabilitiesContext';
import './UrfList.css';

const TITLES = {
  'urf-application': 'URF Application Form',
  'urf-additional-info': 'Additional Information Form',
  'urf-half-yearly-report': 'Half-yearly Progress Report',
  'urf-final-report': 'Final Report',
};

/**
 * Admin, URF, one form: who filled it in, listed the way the PhD form lists
 * are. The table and filter bar read the page's own path as their endpoint,
 * and a row opens that submission's own page, which holds what was filled in
 * and what each step of the chain said about it.
 *
 * One session at a time, as the projects table reads, so a form list never
 * mixes two years. The newest is the one to land on.
 */
const UrfFormList = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ conditions: [] });
  // null until the sessions arrive: the table waits for them rather than
  // showing every year at once for the moment before they land.
  const [sessions, setSessions] = useState(null);
  const [session, setSession] = useState('');
  // Scoped to what the reader may read: the office gets every year, a mentor
  // the years they mentor in.
  const can = useCapabilities();
  const readsUrf = can('can_manage_urf') || can('can_read_urf_mentees');
  const capabilitiesKnown = useCapabilitiesKnown();

  useEffect(() => {
    if (!capabilitiesKnown) return;
    if (!readsUrf) {
      setSessions([]);
      return;
    }
    apiUrfSessions()
      .then((res) => (res.success && Array.isArray(res.response) ? res.response : []))
      // An empty list still settles the page: the table shows what it has
      // rather than waiting for a year that is never coming.
      .catch(() => [])
      .then((years) => {
        setSessions(years);
        setSession(years.length ? String(years[0]) : '');
      });
  }, [capabilitiesKnown, readsUrf]);

  // The session is the page's own scope and the search box is the filter bar's.
  // They are joined here so the table has one filter object and makes one
  // request for it.
  const query = useMemo(() => ({
    ...filters,
    mandatory_filter: [
      ...(session ? [{ key: 'session', op: '=', value: session }] : []),
      ...(filters.mandatory_filter ?? []),
    ],
  }), [filters, session]);

  return (
    <Page
      title={TITLES[pathname.split('/').pop()]}
      description="Undergraduate Research Fellowship"
      actions={sessions?.length > 0 && (
        <div className="urf-session-picker">
          <DropdownField
            options={sessions.map((year) => ({ value: String(year), title: `URF ${year}` }))}
            initialValue={session}
            onChange={setSession}
          />
        </div>
      )}
    >
      {sessions !== null && (
        <PagenationTable
          endpoint={pathname}
          filters={query}
          search={(
            <FilterBar
              placeholder="Search by project, student, roll no or mentor…"
              exclude={['session']}
              onSearch={setFilters}
            />
          )}
          enableSelect={false}
          customOpenForm={(row) => navigate(`${pathname}/${row.id}`)}
        />
      )}
    </Page>
  );
};

export default UrfFormList;
