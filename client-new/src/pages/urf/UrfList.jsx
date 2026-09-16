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
import useCapabilities from '../../hooks/useCapabilities';
import TableComponent from '../../components/forms/table/TableComponent';
import GridContainer from '../../components/forms/fields/GridContainer';
import { apiUrfQueue } from '../../api/urf';
import UrfReportSchedule from '../../components/urf/UrfReportSchedule';
import CustomModal from '../../components/forms/modal/CustomModal';
import { apiUrfSessions, apiUrfStatus } from '../../api/urf';
import './UrfList.css';

/** Admin → URF: every application, by stage, with the filters the students page has. */
// The URF forms, as cards like the PhD forms page. Each opens its own list.
const FORM_NAMES = {
  'urf-application': 'Application',
  'urf-additional-info': 'Additional Information',
  'urf-half-yearly-report': 'Half-yearly Report',
  'urf-final-report': 'Final Report',
};

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
          {mentor.department ? ` · ${mentor.department}` : ''}
        </React.Fragment>
      ))}
    </span>
  ) : EMPTY_VALUE),
}];

// A project is decided once, either way. The table offers both on an applied
// project and neither on one already decided, as the project page does.
const DECISIONS = [
  { status: 'selected', label: 'Select', icon: <i className="fa-solid fa-check"></i> },
  { status: 'rejected', label: 'Reject', icon: <i className="fa-solid fa-xmark"></i>, danger: true },
];

const isApplied = (row) => String(row.status).toLowerCase() === 'applied';

const UrfList = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ conditions: [] });
  const can = useCapabilities();
  // What is waiting on whoever is reading. The office has the stage column.
  const [queue, setQueue] = useState([]);
  const [tab, setTab] = useState(URF_STATUSES[0]);
  const [open, setOpen] = useState(null);
  // null until the sessions arrive: the table waits for them rather than
  // showing every year at once for the moment before they land.
  const [sessions, setSessions] = useState(null);
  const [session, setSession] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  // A decision is confirmed before it is sent, because it notifies the students.
  const decide = async () => {
    setSaving(true);
    const results = await Promise.all(pending.rows.map((row) => apiUrfStatus(row.id, pending.status)));
    setSaving(false);

    const failed = results.filter((res) => !res.success).length;
    if (failed) {
      toast.error(`${failed} of ${results.length} could not be updated`);
    } else {
      toast.success(`${results.length} project${results.length > 1 ? 's' : ''} marked ${pending.status}`);
    }

    pending.done?.();
    setPending(null);
    setRefreshKey((key) => key + 1);
  };

  // The same decision, taken on one row or on everything ticked. Only an applied
  // project is still to be decided, so the table carries these on that tab alone
  // and the other tabs offer no buttons and no way to select rows.
  const rowActions = DECISIONS.map((decision) => ({
    ...decision,
    tooltip: decision.label,
    show: isApplied,
    onClick: (row) => setPending({ ...decision, rows: [row] }),
  }));

  const bulkActions = DECISIONS.map((decision) => ({
    label: decision.label,
    danger: decision.danger,
    onClick: (ids, done, rows) => {
      const applied = rows.filter(isApplied);

      if (applied.length === 0) {
        toast.info('Only an applied project can be selected or rejected.');
        return;
      }

      setPending({ ...decision, rows: applied, done, skipped: rows.length - applied.length });
    },
  }));

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

  // Only an applied project is still to be decided, so the tick boxes, the
  // select-all and the decisions themselves belong to that tab alone. A mentor
  // reads the projects they are on; deciding them is the office's.
  const decidable = tab === 'applied' && can('can_manage_urf');

  useEffect(() => {
    if (can('can_manage_urf')) return;
    apiUrfQueue().then((res) => res.success && setQueue(res.response.data || []));
  }, [refreshKey]);

  return (
    <Layout>
      <PageHeader
        title="URF"
        subtitle={can('can_manage_urf')
          ? `Undergraduate Research Fellowship. Applications are ${open ? 'open' : 'closed'}.`
          : 'The Undergraduate Research Fellowship projects you mentor.'}
        actions={can('can_manage_urf') && open !== null && (
          <CustomButton text={open ? 'Close Applications' : 'Open Applications'} onClick={toggleApplications} />
        )}
      />
      {can('can_manage_urf') && <FormGrid forms={URF_FORMS} />}

      {can('can_manage_urf') && (
        <>
          <div className="grid-label">Report Rounds</div>
          <UrfReportSchedule session={Number(session) || new Date().getFullYear()} />
        </>
      )}
      {queue.length > 0 && (
        <GridContainer
          label={`Waiting on you (${queue.length})`}
          elements={[
            <TableComponent
              data={queue}
              keys={['session', 'project_title', 'students', 'form', 'waiting_since']}
              titles={['Session', 'Project Title', 'Students', 'Form', 'Waiting Since']}
              components={[{
                key: 'project_title',
                component: ({ row, data }) => (
                  <button type="button" className="urf-link-cell" onClick={() => navigate(`/urf/${row.application_id}`)}>
                    {data}
                  </button>
                ),
              }, {
                key: 'form',
                component: ({ data }) => FORM_NAMES[data] || data,
              }]}
            />,
          ]}
          space={3}
        />
      )}

      <div className="grid-label">{can('can_manage_urf') ? 'All Projects' : 'Projects You Mentor'}</div>
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
            // The tab is part of the key, so leaving it drops what was ticked
            // rather than keeping a selection the other tabs cannot act on.
            key={`${tab}-${refreshKey}`}
            endpoint="/urf"
            filters={filter}
            enableSelect={decidable}
            persistentSelect={decidable}
            enableApproval={false}
            actions={decidable ? rowActions : []}
            inlineActions
            bulkActions={decidable ? bulkActions : []}
            linkField="project_title"
            onLinkClick={openProposal}
            components={MENTOR_CELL}
            customOpenForm={(row) => navigate(`/urf/${row.id}`)}
          />
        )}
      </div>

      <CustomModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={pending?.label}
        minHeight="140px"
        maxWidth="460px"
      >
        <p>
          Mark{' '}
          {pending?.rows?.length === 1
            ? <>&ldquo;{pending.rows[0].project_title}&rdquo;</>
            : <><strong>{pending?.rows?.length}</strong> projects</>}
          {' '}as <strong>{pending?.status}</strong>? The students on each project are notified.
        </p>
        {pending?.skipped > 0 && (
          <p>
            {pending.skipped} already decided{' '}
            {pending.skipped === 1 ? 'project is' : 'projects are'} left as they are.
          </p>
        )}
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="secondary" onClick={() => setPending(null)} />
          <CustomButton text={saving ? 'Saving…' : pending?.label} onClick={decide} disabled={saving} />
        </div>
      </CustomModal>
    </Layout>
  );
};

export default UrfList;
