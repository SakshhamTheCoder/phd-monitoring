import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import CustomButton from '../../components/forms/fields/CustomButton';
import DropdownField from '../../components/forms/fields/DropdownField';
import { fileUrlFrom } from '../../components/common/FileLink';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { EMPTY_VALUE } from '../../utils/timeParse';
import { URF_STATUSES, capitalize } from '../../components/urf/UrfRecord';
import { apiSettings, apiSaveSettings } from '../../api/settings';
import { apiUrfSessions } from '../../api/urf';
import './UrfList.css';

/** Admin → URF: every application, by stage, with the filters the students page has. */
// The URF forms, as cards like the PhD forms page. Each opens its own list.
const URF_FORMS = [
  { form_type: 'urf-application', form_name: 'URF Application Form' },
  { form_type: 'urf-additional-info', form_name: 'Additional Information Form' },
  { form_type: 'urf-half-yearly-report', form_name: 'Half-yearly Progress Report' },
  { form_type: 'urf-final-report', form_name: 'Final Report' },
];

// Each mentor opens their own profile. The click is kept off the row, which
// would otherwise open the project at the same time.
const MENTOR_CELL = [{
  key: 'mentors',
  component: ({ row }) => (row.mentor_list?.length ? (
    <span onClick={(e) => e.stopPropagation()}>
      {row.mentor_list.map((mentor, index) => (
        <React.Fragment key={mentor.code ?? index}>
          {index > 0 && ', '}
          <FacultyLink code={mentor.code} name={mentor.name} />
        </React.Fragment>
      ))}
    </span>
  ) : EMPTY_VALUE),
}];

const UrfList = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ conditions: [] });
  const [tab, setTab] = useState(URF_STATUSES[0]);
  const [open, setOpen] = useState(null);
  // null until the sessions arrive: the table waits for them rather than
  // showing every year at once for the moment before they land.
  const [sessions, setSessions] = useState(null);
  const [session, setSession] = useState('');

  useEffect(() => {
    apiSettings('urf').then((res) => res.success && setOpen(!!res.response.applications_open));
  }, []);

  // One session at a time, so the table never mixes two years. The newest is
  // the one to land on.
  useEffect(() => {
    apiUrfSessions()
      .then((res) => (res.success && Array.isArray(res.response) ? res.response : []))
      // An empty list still settles the page: the table shows what it has
      // rather than waiting for a year that is never coming.
      .catch(() => [])
      .then((years) => {
        setSessions(years);
        setSession(years.length ? String(years[0]) : '');
      });
  }, []);

  const toggleApplications = async () => {
    const res = await apiSaveSettings('urf', { applications_open: open ? 0 : 1 });
    if (res.success) {
      setOpen(!!res.response.applications_open);
      toast.success(res.response.applications_open ? 'URF applications opened' : 'URF applications closed');
    }
  };

  // The title opens the proposal it was written for; the chevron at the end of
  // the row still opens the project itself.
  const openProposal = (row) => {
    if (!row.proposal) {
      toast.info('No proposal was uploaded for this project.');
      return;
    }
    window.open(fileUrlFrom(row.proposal), '_blank', 'noopener,noreferrer');
  };

  // The stage and the session are filters the search bar keeps applying,
  // whatever is searched on top of them.
  const mandatory = useMemo(() => [
    { key: 'status', op: '=', value: tab },
    ...(session ? [{ key: 'session', op: '=', value: session }] : []),
  ], [tab, session]);

  // The filter bar emits after its own render, so the session reaches the table
  // a beat behind the dropdown. Waiting for it to actually be in the query
  // keeps two years from ever sharing the table, even for one frame. Nothing to
  // wait for when there are no projects at all.
  const scopedToOneSession = filter.mandatory_filter?.some((c) => c.key === 'session');
  const ready = scopedToOneSession || sessions?.length === 0;

  return (
    <Layout>
      <PageHeader
        title="URF"
        subtitle={`Undergraduate Research Fellowship. Applications are ${open ? 'open' : 'closed'}.`}
        actions={open !== null && (
          <CustomButton text={open ? 'Close Applications' : 'Open Applications'} onClick={toggleApplications} />
        )}
      />
      <FormGrid forms={URF_FORMS} />
      <div className="grid-label">All Projects</div>
      <div className="urf-stage-bar">
        <Tabs
          items={URF_STATUSES.map((s) => ({ value: s, label: capitalize(s) }))}
          value={tab}
          onChange={setTab}
        />
        {sessions?.length > 0 && (
          <div className="urf-session-picker">
            <DropdownField
              options={sessions.map((year) => ({ value: String(year), title: `URF ${year}` }))}
              initialValue={session}
              onChange={setSession}
            />
          </div>
        )}
      </div>
      <FilterBar
        placeholder="Search projects by title, student, roll no or mentor…"
        mandatory={mandatory}
        exclude={['session']}
        onSearch={setFilter}
      />
      <div className="urf-list">
        {ready && (
          <PagenationTable
            endpoint="/urf"
            filters={filter}
            enableSelect={false}
            linkField="project_title"
            onLinkClick={openProposal}
            components={MENTOR_CELL}
            customOpenForm={(row) => navigate(`/urf/${row.id}`)}
          />
        )}
      </div>
    </Layout>
  );
};

export default UrfList;
