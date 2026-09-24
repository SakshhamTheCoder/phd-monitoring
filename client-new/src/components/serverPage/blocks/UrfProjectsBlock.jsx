import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Tabs from '../../tabs/Tabs';
import FilterBar from '../../filterBar/FilterBar';
import PagenationTable from '../../pagenationTable/PagenationTable';
import CustomButton from '../../forms/fields/CustomButton';
import CustomModal from '../../forms/modal/CustomModal';
import DropdownField from '../../forms/fields/DropdownField';
import FacultyLink from '../../facultyLink/FacultyLink';
import { openStoredFile } from '../../../api/fileAccess';
import { apiUrfStatus } from '../../../api/urf';
import { EMPTY_VALUE } from '../../../utils/timeParse';
import { URF_STATUSES, capitalize } from '../../urf/UrfRecord';

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

/**
 * The URF projects under their heading: the stage tabs and the session they
 * apply to on one bar, the search, and the table. The office decides applied
 * projects here, one row or everything ticked, after confirming, since each
 * decision notifies the students.
 */
const UrfProjectsBlock = ({ props, scope, refreshKey, onChanged }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ conditions: [] });
  const [tab, setTab] = useState(URF_STATUSES[0]);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const session = scope?.value ?? '';

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
    onChanged();
  };

  // The same decision, taken on one row or on everything ticked. Only an
  // applied project is still to be decided, so the table carries these on that
  // tab alone and the other tabs offer no buttons and no way to select rows.
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
    openStoredFile(row.proposal);
  };

  // The stage and the session are the page's own scope; the search box is the
  // filter bar's. Joined here so the table has one filter object and makes one
  // request for it.
  const query = useMemo(() => ({
    ...filter,
    mandatory_filter: [
      { key: 'status', op: '=', value: tab },
      ...(session ? [{ key: 'session', op: '=', value: session }] : []),
      ...(filter.mandatory_filter ?? []),
    ],
  }), [filter, tab, session]);

  const decidable = tab === 'applied' && props.decides;

  return (
    <>
      <section className="urf-projects">
        <h2 className="section-heading">{props.heading}</h2>
        <div className="urf-stage-bar">
          <Tabs
            items={URF_STATUSES.map((s) => ({ value: s, label: capitalize(s) }))}
            value={tab}
            onChange={setTab}
          />
          {scope?.options?.length > 0 && (
            <div className="urf-session-picker">
              <DropdownField
                options={scope.options}
                initialValue={session}
                onChange={scope.set}
              />
            </div>
          )}
        </div>
        {/* Not the table's search slot: the table is keyed on the tab, and the
            box would be remounted empty on every tab while the search it had
            sent stayed applied. */}
        <FilterBar
          placeholder="Search projects by title, student, roll no or mentor…"
          exclude={['session']}
          onSearch={setFilter}
        />
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
      </section>

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
          <CustomButton text="Cancel" variant="quiet" onClick={() => setPending(null)} />
          <CustomButton text={pending?.label} onClick={decide} busy={saving} />
        </div>
      </CustomModal>
    </>
  );
};

export default UrfProjectsBlock;
