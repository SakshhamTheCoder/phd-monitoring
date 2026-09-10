import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import CustomButton from '../../fields/CustomButton';
import FileUploadField from '../../fields/FileUploadField';
import RadioButtonGroup from '../../fields/RadioButtonGroup';
import { apiLeaveBalance, apiLeaveLoad, apiLeaveSubmit } from '../../../../api/leave';
import { overageOf, formatDays, localDateString } from '../../../../utils/leaveBalance';

const DAY_PART_OPTIONS = [
  { value: 'full', label: 'Full day' },
  { value: 'first_half', label: 'First half' },
  { value: 'second_half', label: 'Second half' },
];

// Local (typed-in) dates round-trip through this pair rather than
// localDateString: these are dates the scholar is choosing right now via
// DatePicker, not values read back from the API, so there is no
// Laravel/APP_TIMEZONE shift to undo here — only the browser's own UTC
// offset, which this cancels the same way AttendancePage.jsx does.
const formatDate = (d) => {
  if (!d) return '';
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const parseDate = (str) => (str ? new Date(str + 'T00:00:00') : null);

const daysBetween = (from, to) => {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

/**
 * The scholar's side of a leave application. Unlike SemesterOff's Student
 * (which posts through the generic submitForm/location.pathname machinery,
 * meant for forms routed at /forms/:type/:id), this form is opened inline
 * from the attendance page, so it talks to the leave endpoints directly via
 * apiLeaveSubmit — see client-new/src/api/leave.js.
 */
const Student = ({ formData }) => {
  const [instance, setInstance] = useState(formData);
  const [leaveType, setLeaveType] = useState(formData?.leave_type || 'casual');
  const [fromDate, setFromDate] = useState(localDateString(formData?.from_date));
  const [toDate, setToDate] = useState(localDateString(formData?.to_date));
  const [dayPart, setDayPart] = useState(formData?.day_part || 'full');
  const [reason, setReason] = useState(formData?.reason || '');
  const [file, setFile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const lock = !!instance?.locks?.student;

  // apiLeaveBalance is student-only (403 for an HOD) — this component is
  // reused as-is for the HOD's review (see HodAttendancePage), which already
  // shows the scholar's balance via LeaveBalancePanel, fed from the
  // clerk-facing endpoint. Fetching it here unconditionally would 403 for the
  // HOD, and apiLeaveBalance's showToast=true would surface that 403 as a red
  // error toast for no reason.
  useEffect(() => {
    if (localStorage.getItem('userRole') !== 'student') return;
    apiLeaveBalance().then((res) => {
      if (res.success) setBalance(res.response);
    });
  }, []);

  // A half-day only makes sense on a single day — force full whenever the
  // range widens, mirroring the 422 the backend would otherwise return.
  useEffect(() => {
    if (fromDate !== toDate && dayPart !== 'full') setDayPart('full');
  }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Casual leave must carry no document — drop any picked file the moment
  // the type switches away from academic, so a stale selection can't ride
  // along on submit.
  useEffect(() => {
    if (leaveType !== 'academic') setFile(null);
  }, [leaveType]);

  const showDayPart = !!fromDate && !!toDate && fromDate === toDate;
  const requestedDays = dayPart !== 'full' ? 0.5 : daysBetween(fromDate, toDate);

  const balanceForType = balance?.[leaveType];
  const overage = balanceForType
    ? overageOf({
        quota: balanceForType.quota,
        used: (Number(balanceForType.used) || 0) + requestedDays,
      })
    : 0;

  const handleSubmit = async () => {
    if (!fromDate || !toDate) { toast.error('Select the from and to dates'); return; }
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    if (leaveType === 'academic' && !file) { toast.error('Attach a supporting PDF for an academic leave'); return; }

    const body = new FormData();
    body.append('leave_type', leaveType);
    body.append('from_date', fromDate);
    body.append('to_date', toDate);
    body.append('day_part', showDayPart ? dayPart : 'full');
    body.append('reason', reason);
    if (leaveType === 'academic' && file) body.append('supporting_document', file);

    setSubmitting(true);
    const res = await apiLeaveSubmit(instance.form_id, body);
    setSubmitting(false);
    if (res.success) {
      toast.success(res.response?.completed ? 'Form completed successfully' : 'Leave application submitted');
      const reloaded = await apiLeaveLoad(instance.form_id);
      if (reloaded.success) setInstance(reloaded.response);
    }
  };

  return (
    <div>
      <div className="input-field-container">
        <label className="input-label">Leave Type</label>
        {lock ? (
          <input
            className="input-field"
            value={leaveType === 'academic' ? 'Academic' : 'Casual'}
            disabled
            readOnly
          />
        ) : (
          <RadioButtonGroup
            titles={['Casual', 'Academic']}
            values={['casual', 'academic']}
            defaultValue={leaveType}
            onSelect={setLeaveType}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="input-field-container" style={{ flex: 1, minWidth: '180px' }}>
          <label className="input-label">From</label>
          <DatePicker
            selected={parseDate(fromDate)}
            onChange={(d) => d && setFromDate(formatDate(d))}
            dateFormat="yyyy-MM-dd"
            className="input-field"
            placeholderText="YYYY-MM-DD"
            maxDate={parseDate(toDate)}
            disabled={lock}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
          />
        </div>
        <div className="input-field-container" style={{ flex: 1, minWidth: '180px' }}>
          <label className="input-label">To</label>
          <DatePicker
            selected={parseDate(toDate)}
            onChange={(d) => d && setToDate(formatDate(d))}
            dateFormat="yyyy-MM-dd"
            className="input-field"
            placeholderText="YYYY-MM-DD"
            minDate={parseDate(fromDate)}
            disabled={lock}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
          />
        </div>
      </div>

      {/* day_part is only valid when from_date === to_date — a multi-day
          application must stay 'full' or the backend returns a 422. */}
      <div className="input-field-container">
        <label className="input-label" htmlFor="leave-day-part">Part of Day</label>
        <select
          id="leave-day-part"
          className="input-field"
          value={dayPart}
          onChange={(e) => setDayPart(e.target.value)}
          disabled={lock || !showDayPart}
        >
          {DAY_PART_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {!showDayPart && (
          <p className="field-hint">A half day applies to a single date only.</p>
        )}
      </div>

      <div className="input-field-container">
        <label className="input-label">Reason</label>
        <textarea
          className="input-field"
          rows={4}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={lock}
          placeholder="Why you need this leave (max 1000 characters)"
        />
      </div>

      {/* Academic leave requires a supporting PDF; casual leave must not
          carry one at all, so the field only exists for academic. */}
      {leaveType === 'academic' && (
        <FileUploadField
          label="Supporting Document"
          required
          initialValue={instance?.supporting_document}
          isLocked={lock}
          onChange={setFile}
          acceptedTypes=".pdf"
          fileTypeLabel="PDF"
        />
      )}

      {!lock && overage > 0 && (
        <div className="input-field-container">
          <span className="badge badge--danger">
            {formatDays(overage)} day(s) over your {leaveType} quota — this can still be submitted.
          </span>
        </div>
      )}

      {instance?.role === 'student' && !lock && (
        <div className="input-field-container" style={{ marginTop: '0.5rem' }}>
          <CustomButton
            text={submitting ? 'Submitting…' : 'Submit'}
            onClick={handleSubmit}
            disabled={submitting}
          />
        </div>
      )}
    </div>
  );
};

export default Student;
