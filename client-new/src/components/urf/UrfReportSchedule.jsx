import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import CustomModal from '../forms/modal/CustomModal';
import DropdownField from '../forms/fields/DropdownField';
import DateField from '../forms/fields/DateField';
import InputField from '../forms/fields/InputField';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import FormActions from '../common/FormActions';
import Panel, { PanelSection } from '../panel/Panel';
import { apiUrfDeleteReportWindow, apiUrfReportWindows, apiUrfSaveReportWindow } from '../../api/urf';
import { REPORT_TYPES } from './UrfRecord';
import { localDateString } from '../../utils/leaveBalance';
import useDoneFlash from '../../hooks/useDoneFlash';
import './UrfForms.css';

const TYPES = Object.entries(REPORT_TYPES).map(([value, title]) => ({ value, title }));

const empty = (session) => ({ session: String(session), type: 'half_yearly', opens_on: '', closes_on: '', notes: '' });

const fromRound = (round) => ({
  session: String(round.session),
  type: round.type,
  opens_on: round.opens_on || '',
  closes_on: round.closes_on || '',
  notes: round.notes || '',
});

const today = () => localDateString(new Date());

// The round the office is most likely to want: the one running, or the next one
// due if none is. Dates are stored as YYYY-MM-DD, which compares as text.
const currentRound = (rounds) => rounds.find((round) => round.is_open)
  ?? rounds
    .filter((round) => round.opens_on > today())
    .sort((a, b) => a.opens_on.localeCompare(b.opens_on))[0];

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
  // The round the form is editing. Set from the session's current round on
  // load, so the office lands on the one that is running rather than on a
  // blank form and a table to hunt through.
  const [round, setRound] = useState(null);
  const [pending, setPending] = useState(null);
  const [saved, flashSaved] = useDoneFlash();

  const load = useCallback(async () => {
    const res = await apiUrfReportWindows();
    if (res.success) setWindows(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Following the page's session means the rounds below are the ones for the
  // projects above, rather than every year at once.
  useEffect(() => { setForm(empty(session)); }, [session]);

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

  const forSession = windows.filter((one) => Number(one.session) === Number(form.session));

  // One round runs at a time, so there is one round to be looking at: the one
  // running, or the next one due. Only when neither exists is there a round to
  // schedule, which is when the semester card offers to create one too.
  const current = currentRound(forSession);
  const rows = forSession
    .filter((one) => one.id !== current?.id)
    .map((one) => ({ ...one, report: REPORT_TYPES[one.type], state: stateOf(one) }));

  // The session's current round, shown ready to edit. Reruns when the rounds
  // reload after a save, so the panel settles back on what is running.
  useEffect(() => {
    setRound(current ?? null);
    setForm(current ? fromRound(current) : empty(form.session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, form.session]);

  const openRound = (one) => {
    setForm(fromRound(one));
    setRound(one);
  };

  // Fellows are filing to the dates of a round that is running, so its opening
  // day is settled while it runs and only its closing day can move. A round
  // already closed is free again, which is how one is run a second time.
  const running = !!round && round.is_open;

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
    flashSaved();
    load();
  };

  const remove = async () => {
    const res = await apiUrfDeleteReportWindow(pending.id);
    setPending(null);
    if (!res.success) return;

    toast.success('Round removed');
    load();
  };

  return (
    <Panel title="Report rounds" className="urf-schedule">
      <PanelSection
        title={round
          ? `${REPORT_TYPES[round.type]}: ${stateOf(round).toLowerCase()}`
          : `No round scheduled for URF ${form.session}`}
      >
        {!round && (
          <p className="urf-round-notice">
            One round runs at a time. Schedule the next one here; it will open on
            the day you set and close itself on the last.
          </p>
        )}

        <GridContainer
          elements={[
            <DropdownField label="Session" options={sessionOptions} initialValue={form.session} onChange={set('session')} required />,
            <DropdownField label="Report" options={TYPES} initialValue={form.type} onChange={set('type')} isLocked={!!round} required />,
            <DateField
              label="Opens On"
              initialValue={form.opens_on}
              onChange={set('opens_on')}
              max={form.closes_on || undefined}
              isLocked={running}
              required
            />,
            <DateField label="Closes On" initialValue={form.closes_on} onChange={set('closes_on')} min={form.opens_on || undefined} required />,
            <InputField label="Note for fellows" initialValue={form.notes} onChange={set('notes')} />,
          ]}
        />

        <FormActions>
          <CustomButton
            text={existing ? 'Update round' : 'Schedule round'}
            onClick={save}
            busy={saving}
            done={saved}
          />
        </FormActions>
      </PanelSection>

      {rows.length > 0 && (
        <PanelSection title="Other rounds this session">
          <TableComponent
            data={rows}
            keys={['session', 'report', 'opens_on', 'closes_on', 'state', 'notes', 'id']}
            titles={['Session', 'Report', 'Opens on', 'Closes on', 'Status', 'Note', ' ']}
            components={[{
              // The round it names, opened into the form above to be moved.
              key: 'report',
              component: ({ row, data }) => (
                <button type="button" className="cell-link" onClick={() => openRound(row)}>
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
          />
        </PanelSection>
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
          <CustomButton text="Cancel" variant="quiet" onClick={() => setPending(null)} />
          <CustomButton text="Call off round" variant="danger" onClick={remove} />
        </div>
      </CustomModal>
    </Panel>
  );
};

export default UrfReportSchedule;
