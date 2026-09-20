import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import CustomModal from '../forms/modal/CustomModal';
import DropdownField from '../forms/fields/DropdownField';
import DateField from '../forms/fields/DateField';
import InputField from '../forms/fields/InputField';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import { apiUrfDeleteReportWindow, apiUrfReportWindows, apiUrfSaveReportWindow } from '../../api/urf';
import { REPORT_TYPES } from './UrfRecord';

const TYPES = Object.entries(REPORT_TYPES).map(([value, title]) => ({ value, title }));

const empty = (session) => ({ session: String(session), type: 'half_yearly', opens_on: '', closes_on: '', notes: '' });

// is_open is today being inside the round, so a round that has not started yet
// answers false to it. Reading that as Closed said a round was over before it
// began; a fellow's own page already tells the two apart, and so does this.
const stateOf = (round) => {
  if (round.is_open) return 'Open';

  return new Date(round.opens_on) > new Date() ? 'Upcoming' : 'Closed';
};

/**
 * When a report round opens and closes: a fellow is offered the form only
 * while its round is open. One round per session per report, which is why
 * scheduling the same pair again moves its dates rather than opening a second
 * round, and why the button says so.
 */
const UrfReportSchedule = ({ session, sessions = [] }) => {
  const [windows, setWindows] = useState([]);
  const [form, setForm] = useState(empty(session));
  const [saving, setSaving] = useState(false);
  // The round a row opened, so the form can offer a way back out of it.
  const [opened, setOpened] = useState(null);
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    const res = await apiUrfReportWindows();
    if (res.success) setWindows(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Following the page's session means the rounds below are the ones for the
  // projects above, rather than every year at once.
  useEffect(() => {
    setForm(empty(session));
    setOpened(null);
  }, [session]);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const sessionOptions = useMemo(() => {
    const years = sessions.length ? sessions : [session];

    return [...new Set(years.map(Number))]
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), title: `URF ${year}` }));
  }, [sessions, session]);

  // The server keeps one round per session per report, so a pair already
  // scheduled is about to be moved rather than added.
  const existing = windows.find(
    (round) => Number(round.session) === Number(form.session) && round.type === form.type
  );

  const rows = windows
    .filter((round) => Number(round.session) === Number(form.session))
    .map((round) => ({ ...round, report: REPORT_TYPES[round.type], state: stateOf(round) }));

  const openRound = (round) => {
    setForm({
      session: String(round.session),
      type: round.type,
      opens_on: round.opens_on || '',
      closes_on: round.closes_on || '',
      notes: round.notes || '',
    });
    setOpened(round.id);
  };

  const save = async () => {
    if (!form.opens_on || !form.closes_on) {
      toast.error('A round needs the day it opens and the day it closes.');
      return;
    }

    setSaving(true);
    const res = await apiUrfSaveReportWindow(form);
    setSaving(false);
    if (!res.success) return;

    toast.success(existing ? 'Round updated' : 'Round scheduled');
    setForm(empty(form.session));
    setOpened(null);
    load();
  };

  const remove = async () => {
    const res = await apiUrfDeleteReportWindow(pending.id);
    setPending(null);
    if (!res.success) return;

    toast.success('Round removed');
    if (opened === pending.id) {
      setForm(empty(form.session));
      setOpened(null);
    }
    load();
  };

  return (
    <div className="urf-report-schedule">
      <GridContainer
        elements={[
          <DropdownField label="Session" options={sessionOptions} initialValue={form.session} onChange={set('session')} required />,
          <DropdownField label="Report" options={TYPES} initialValue={form.type} onChange={set('type')} required />,
          <DateField label="Opens On" initialValue={form.opens_on} onChange={set('opens_on')} max={form.closes_on || undefined} required />,
          <DateField label="Closes On" initialValue={form.closes_on} onChange={set('closes_on')} min={form.opens_on || undefined} required />,
          <InputField label="Note for fellows" initialValue={form.notes} onChange={set('notes')} />,
        ]}
      />

      <GridContainer
        elements={[
          <CustomButton
            text={saving ? 'Saving…' : (existing ? 'Update round' : 'Schedule round')}
            onClick={save}
            disabled={saving}
          />,
          ...(opened ? [<CustomButton text="Cancel" variant="secondary" onClick={() => { setForm(empty(form.session)); setOpened(null); }} />] : []),
        ]}
      />

      {rows.length > 0 && (
        <GridContainer
          elements={[
            <TableComponent
              data={rows}
              keys={['session', 'report', 'opens_on', 'closes_on', 'state', 'notes', 'id']}
              titles={['Session', 'Report', 'Opens On', 'Closes On', 'Status', 'Note', ' ']}
              components={[{
                // The round it names, opened into the form above to be moved.
                key: 'report',
                component: ({ row, data }) => (
                  <button type="button" className="urf-link-cell" onClick={() => openRound(row)}>
                    {data}
                  </button>
                ),
              }, {
                key: 'id',
                component: ({ row }) => (
                  <button type="button" className="icon-action" onClick={() => setPending(row)} title="Call off this round" aria-label="Call off this round">
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                ),
              }]}
            />,
          ]}
          space={3}
        />
      )}

      <CustomModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title="Call off this round"
        minHeight="140px"
        maxWidth="460px"
      >
        <p>
          Call off the <strong>{pending && REPORT_TYPES[pending.type]}</strong> round for URF {pending?.session}?
          Reports already filed stay where they are, and the form closes to anyone who has not filed one.
        </p>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="secondary" onClick={() => setPending(null)} />
          <CustomButton text="Call off round" onClick={remove} />
        </div>
      </CustomModal>
    </div>
  );
};

export default UrfReportSchedule;
