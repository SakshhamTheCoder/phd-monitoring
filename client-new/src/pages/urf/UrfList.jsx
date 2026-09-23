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
import useCapabilities, { useCapabilitiesKnown } from '../../context/CapabilitiesContext';
import TableComponent from '../../components/forms/table/TableComponent';
import GridContainer from '../../components/forms/fields/GridContainer';
import { apiUrfQueue } from '../../api/urf';
import UrfReportSchedule from '../../components/urf/UrfReportSchedule';
import CustomModal from '../../components/forms/modal/CustomModal';
import { apiUrfSessions, apiUrfStatus, apiUrfImportAwarded } from '../../api/urf';
import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
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
  { status: 'selected', label: 'Select', icon: <i className="fa fa-check"></i> },
  { status: 'rejected', label: 'Reject', icon: <i className="fa fa-times"></i>, danger: true },
];

const isApplied = (row) => String(row.status).toLowerCase() === 'applied';

// The office's awarded list. branch_code is only read for a student the portal
// has not seen before: an existing account already knows its branch, and a
// department maps to several branches so it cannot be guessed.
const AWARDED_SAMPLE_CSV = `project_title,session,student1_name,student1_roll_no,student1_email,student1_phone,student1_gender,student1_year,student1_branch_code,student2_name,student2_roll_no,student2_email,student2_phone,student2_gender,student2_year,student2_branch_code,mentor1_email,mentor2_email
Low power sensing for field robots,2026,Student One,102203001,student.one@thapar.edu,9800000001,Female,3,COE,Student Two,102203002,student.two@thapar.edu,9800000002,Male,3,COE,mentor.one@thapar.edu,`;

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
  // The applications switch, the import and the report schedule are the
  // office's. Everything else on the page is scoped to what the reader may
  // read, so a mentor gets the same page holding only their own projects.
  const managesUrf = can('can_manage_urf');
  const readsUrf = managesUrf || can('can_read_urf_mentees');
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const importAwarded = async (preview, reset) => {
    setImporting(true);
    const res = await apiUrfImportAwarded(preview.data);
    setImporting(false);

    if (!res.success) {
      toast.error(res.response?.message || 'Could not import the awarded projects.');
      return;
    }

    const { added = 0, updated = 0, errors = [] } = res.response || {};
    toast.success(`${added} projects added, ${updated} updated`);
    errors.forEach((message) => toast.warn(message, { autoClose: 10000 }));
    reset();
    setImportOpen(false);
    // An import can open a new session, so the session list is read again and
    // the page lands on the newest one. The table waits for it, then mounts once.
    setSessions(null);
    loadSessions();
    setRefreshKey((key) => key + 1);
  };
  const capabilitiesKnown = useCapabilitiesKnown();

  useEffect(() => {
    if (!managesUrf) return;
    apiSettings('urf').then((res) => res.success && setOpen(!!res.response.applications_open));
  }, [managesUrf]);

  // One session at a time, so the table never mixes two years. The newest is
  // the one to land on.
  const loadSessions = () => apiUrfSessions()
    .then((res) => (res.success && Array.isArray(res.response) ? res.response : []))
    // An empty list still settles the page: the table shows what it has
    // rather than waiting for a year that is never coming.
    .catch(() => [])
    .then((years) => {
      setSessions(years);
      setSession(years.length ? String(years[0]) : '');
    });

  useEffect(() => {
    if (!capabilitiesKnown) return;
    if (!readsUrf) {
      setSessions([]);
      return;
    }
    loadSessions();
  }, [capabilitiesKnown, readsUrf]);

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

  // The stage and the session are the page's own scope; the search box is the
  // filter bar's. They are joined here, so the table has one filter object and
  // makes one request for it.
  //
  // They used to be handed to the filter bar, which re-emitted them after its
  // own render. A tab press then fetched twice: once with the tab being left,
  // because the table re-rendered first, and once with the tab being opened.
  // Neither request waited for the other, so whichever answer arrived last was
  // the one shown, and the same tab gave a different table each time.
  const query = useMemo(() => ({
    ...filter,
    mandatory_filter: [
      { key: 'status', op: '=', value: tab },
      ...(session ? [{ key: 'session', op: '=', value: session }] : []),
      ...(filter.mandatory_filter ?? []),
    ],
  }), [filter, tab, session]);

  // Which session to open on is the session list's to say, so the table waits
  // for that list rather than showing every year for the moment before it
  // lands. An empty list still settles the page.
  const ready = sessions !== null;

  // The same dot a scholar reads on their own forms page: a card is lit when
  // something of that kind is waiting on this reader. The office holds no step
  // on a chain, so it fetches no queue and lights nothing.
  const formCards = useMemo(() => {
    const waiting = new Set(queue.map((row) => row.form));

    return URF_FORMS.map((form) => ({ ...form, action_required: waiting.has(form.form_type) }));
  }, [queue]);

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
        actions={can('can_manage_urf') && (
          <>
            <CustomButton text="Import Awarded" onClick={() => setImportOpen(true)} />
            {open !== null && (
              <CustomButton text={open ? 'Close Applications' : 'Open Applications'} onClick={toggleApplications} />
            )}
          </>
        )}
      />
      {readsUrf && <FormGrid forms={formCards} />}

      <UnifiedBulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Awarded Projects"
        required={['project_title', 'student1_name', 'student1_roll_no', 'student1_email', 'mentor1_email']}
        rules={[
          'For projects awarded before the portal. They are created already selected.',
          'Nothing is recorded as approved: the decision was taken elsewhere, and the history says so.',
          'Matched on the first student\'s email and the session, so the same file twice updates rather than duplicates.',
          'The mentor is matched by email against institute faculty. A mentor the portal does not know names the row and the row is skipped.',
          'branch_code is needed only for a student who has no account yet.',
          'Student accounts are created where they do not exist, and are emailed a link to set a password.',
          'The proposal PDF is not carried: it was filed outside the portal, so those projects show no proposal link.',
        ]}
        sampleFileName="urf_awarded_sample.csv"
        sampleCsvContent={AWARDED_SAMPLE_CSV}
        onImport={importAwarded}
        submitting={importing}
      />

      {can('can_manage_urf') && (
        <>
          <div className="grid-label">Report Rounds</div>
          <UrfReportSchedule
            session={Number(session) || new Date().getFullYear()}
            sessions={sessions || []}
          />
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
                  <button type="button" className="urf-link-cell" onClick={() => navigate(`/urf/${row.form}/${row.id}`)}>
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
            filters={query}
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
