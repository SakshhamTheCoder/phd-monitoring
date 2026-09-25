import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";
import CustomButton from "../fields/CustomButton";
import FileUploadField from "../fields/FileUploadField";
import RadioButtonGroup from "../fields/RadioButtonGroup";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";
import { overageOf, formatDays, localDateString } from "../../../utils/leaveBalance";

// Dates the scholar is picking right now round-trip through this pair rather
// than localDateString: there is no server timezone shift to undo, only the
// browser's own UTC offset.
const toText = (date) => {
  if (!date) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const toDate = (text) => (text ? new Date(text + "T00:00:00") : null);

const daysBetween = (from, to) => {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

// A leave application (Field::leave on the server): the type, the dates as a
// range, the part of a single day, the reason and a document where the type
// needs one, with the scholar's balance for the type chosen. It posts to the
// form's own path and reads the form again after, so the page can follow.
const LeaveApplication = ({ field: initial, onReload, onDraftDeleted }) => {
  const [field, setField] = useState(initial);
  const answers = initial.answers || {};
  const [leaveType, setLeaveType] = useState(answers.leave_type || initial.default_type);
  const [fromDate, setFromDate] = useState(localDateString(answers.from_date));
  const [toDateText, setToDate] = useState(localDateString(answers.to_date));
  const [dayPart, setDayPart] = useState(answers.day_part || initial.day_parts[0].value);
  const [reason, setReason] = useState(answers.reason || "");
  const [file, setFile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const locked = !field.editable;
  const { messages } = field;
  const needsDocument = field.document_types.includes(leaveType);
  const full = field.day_parts[0].value;

  // Only the scholar may read their own balance; the server leaves the path
  // out for anyone else, so an HOD is never shown a refusal for it.
  useEffect(() => {
    if (!initial.balance_path) return;
    customFetch(baseURL + initial.balance_path, "GET", {}, true).then((res) => {
      if (res.success) setBalance(res.response);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A part of a day only makes sense on a single date: back to a full day
  // whenever the range widens, as the server would otherwise refuse.
  useEffect(() => {
    if (fromDate !== toDateText && dayPart !== full) setDayPart(full);
  }, [fromDate, toDateText]); // eslint-disable-line react-hooks/exhaustive-deps

  // A type that takes no document drops any file picked for another type.
  useEffect(() => {
    if (!needsDocument) setFile(null);
  }, [leaveType]); // eslint-disable-line react-hooks/exhaustive-deps

  const singleDay = !!fromDate && !!toDateText && fromDate === toDateText;
  const requestedDays = dayPart !== full ? 0.5 : daysBetween(fromDate, toDateText);
  const forType = balance?.[leaveType];
  const overage = forType ? overageOf({ quota: forType.quota, used: (Number(forType.used) || 0) + requestedDays }) : 0;

  const submit = async () => {
    if (!fromDate || !toDateText) { toast.error(messages.dates); return; }
    if (!reason.trim()) { toast.error(messages.reason); return; }
    if (needsDocument && !file && !field.answers?.supporting_document) { toast.error(messages.document); return; }

    const body = new FormData();
    body.append("leave_type", leaveType);
    body.append("from_date", fromDate);
    body.append("to_date", toDateText);
    body.append("day_part", singleDay ? dayPart : full);
    body.append("reason", reason);
    if (needsDocument && file) body.append("supporting_document", file);

    setSubmitting(true);
    const res = await customFetch(baseURL + field.form_path, "POST", body, true, true);
    setSubmitting(false);
    if (res.success) {
      toast.success(res.response?.completed ? messages.completed : messages.submitted);
      const reloaded = await customFetch(baseURL + field.form_path, "GET", {}, true);
      if (reloaded.success) {
        const next = reloaded.response.view?.sections?.[0]?.rows?.find((row) => row.kind === "leave");
        if (next) setField(next);
        onReload?.(reloaded.response);
      }
    }
  };

  const deleteDraft = async () => {
    if (!window.confirm(messages.delete)) return;
    const res = await customFetch(baseURL + field.form_path, "DELETE", {}, true);
    if (res.success) onDraftDeleted?.();
  };

  const typeTitle = (value) => field.types.find((type) => type.value === value)?.title;

  return (
    <>
      <div className="input-field-container">
        <label className="input-label">Leave type</label>
        {locked ? (
          <input className="input-field" value={typeTitle(leaveType) || typeTitle(initial.default_type)} disabled readOnly />
        ) : (
          <RadioButtonGroup
            titles={field.types.map((type) => type.title)}
            values={field.types.map((type) => type.value)}
            defaultValue={leaveType}
            onSelect={setLeaveType}
          />
        )}
      </div>
      <div className="student-leave-dates">
        <div className="input-field-container">
          <label className="input-label" htmlFor="student-from">From</label>
          <DatePicker id="student-from"
            selected={toDate(fromDate)}
            onChange={(d) => d && setFromDate(toText(d))}
            dateFormat="yyyy-MM-dd"
            className="input-field"
            placeholderText="YYYY-MM-DD"
            maxDate={toDate(toDateText)}
            disabled={locked}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
          />
        </div>
        <div className="input-field-container">
          <label className="input-label" htmlFor="student-to">To</label>
          <DatePicker id="student-to"
            selected={toDate(toDateText)}
            onChange={(d) => d && setToDate(toText(d))}
            dateFormat="yyyy-MM-dd"
            className="input-field"
            placeholderText="YYYY-MM-DD"
            minDate={toDate(fromDate)}
            disabled={locked}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
          />
        </div>
      </div>
      <div className="input-field-container">
        <label className="input-label" htmlFor="student-part-of-day">Part of day</label>
        <select
          id="student-part-of-day"
          className="input-field"
          value={dayPart}
          onChange={(e) => setDayPart(e.target.value)}
          disabled={locked || !singleDay}
        >
          {field.day_parts.map((part) => (
            <option key={part.value} value={part.value}>{part.label}</option>
          ))}
        </select>
        {!singleDay && <p className="field-hint">{field.half_day_hint}</p>}
      </div>
      <div className="input-field-container">
        <label className="input-label" htmlFor="student-reason">Reason</label>
        <textarea id="student-reason"
          className="input-field"
          rows={4}
          maxLength={field.reason_max}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={locked}
          placeholder={field.reason_hint}
        />
      </div>
      {needsDocument && (
        <FileUploadField
          label="Supporting document"
          required={!field.answers?.supporting_document}
          initialValue={field.answers?.supporting_document}
          isLocked={locked}
          onChange={setFile}
          acceptedTypes=".pdf"
          fileTypeLabel="PDF"
        />
      )}
      {!locked && overage > 0 && (
        <div className="input-field-container">
          <span className="badge badge--danger">
            {messages.over.replace("{days}", formatDays(overage)).replace("{type}", leaveType)}
          </span>
        </div>
      )}
      {!locked && (
        <div className="input-field-container leave-actions">
          <CustomButton text="Submit" onClick={submit} busy={submitting} />
          {field.deletable && <CustomButton text="Delete draft" variant="danger-outline" onClick={deleteDraft} />}
        </div>
      )}
    </>
  );
};

export default LeaveApplication;
