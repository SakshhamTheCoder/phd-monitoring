import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import DropdownField from '../forms/fields/DropdownField';
import DateField from '../forms/fields/DateField';
import InputField from '../forms/fields/InputField';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import { apiUrfDeleteReportWindow, apiUrfReportWindows, apiUrfSaveReportWindow } from '../../api/urf';
import { REPORT_TYPES } from './UrfRecord';

const TYPES = Object.entries(REPORT_TYPES).map(([value, title]) => ({ value, title }));

const empty = (session) => ({ session, type: 'half_yearly', opens_on: '', closes_on: '', notes: '' });

/**
 * When a report round opens and closes: a fellow is offered the form only
 * while its round is open. One round per session per report.
 */
const UrfReportSchedule = ({ session }) => {
  const [windows, setWindows] = useState([]);
  const [form, setForm] = useState(empty(session));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiUrfReportWindows();
    if (res.success) setWindows(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm((prev) => ({ ...prev, session })); }, [session]);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.opens_on || !form.closes_on) {
      toast.error('A round needs the day it opens and the day it closes.');
      return;
    }

    setSaving(true);
    const res = await apiUrfSaveReportWindow(form);
    setSaving(false);
    if (!res.success) return;

    toast.success('Round scheduled');
    setForm(empty(session));
    load();
  };

  const remove = async (row) => {
    if (!window.confirm(`Call off the ${REPORT_TYPES[row.type]} round for URF ${row.session}?`)) return;
    const res = await apiUrfDeleteReportWindow(row.id);
    if (res.success) {
      toast.success('Round removed');
      load();
    }
  };

  const rows = windows.map((w) => ({
    ...w,
    report: REPORT_TYPES[w.type],
    state: w.is_open ? 'Open' : 'Closed',
  }));

  return (
    <div className="urf-report-schedule">
      <div className="filter-bar">
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: '140px' }}>
            <InputField label="Session" type="number" initialValue={form.session} onChange={set('session')} />
          </div>
          <div style={{ minWidth: '220px' }}>
            <DropdownField label="Report" options={TYPES} initialValue={form.type} onChange={set('type')} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <DateField label="Opens On" initialValue={form.opens_on} onChange={set('opens_on')} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <DateField label="Closes On" initialValue={form.closes_on} onChange={set('closes_on')} />
          </div>
          <div style={{ minWidth: '240px' }}>
            <InputField label="Note for fellows" initialValue={form.notes} onChange={set('notes')} />
          </div>
          <CustomButton text={saving ? 'Saving…' : 'Schedule round'} onClick={save} disabled={saving} />
        </div>
      </div>

      {rows.length > 0 && (
        <GridContainer
          elements={[
            <TableComponent
              data={rows}
              keys={['session', 'report', 'opens_on', 'closes_on', 'state', 'notes', 'id']}
              titles={['Session', 'Report', 'Opens On', 'Closes On', 'Status', 'Note', ' ']}
              components={[{
                key: 'id',
                component: ({ row }) => (
                  <button type="button" className="icon-action" onClick={() => remove(row)} title="Call off this round" aria-label="Call off this round">
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                ),
              }]}
            />,
          ]}
          space={3}
        />
      )}
    </div>
  );
};

export default UrfReportSchedule;
