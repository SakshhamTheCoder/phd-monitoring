import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import { baseURL } from '../../api/urls';
import { isNetworkError, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { parseCsv } from '../../utils/csv';
import { buildSaveMessage } from '../../utils/attendanceMark';

/**
 * Uploading a day's attendance as a file.
 *
 * Lifted out of AttendancePage, which was holding the file, its preview and the
 * upload in progress alongside the roster, the filters and four tabs of its
 * own. Nothing outside this dialog reads any of that.
 */
const AttendanceCsvDialog = ({ isOpen, onClose, onImported, editWindow }) => {
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setCsvFile(null);
    setCsvPreview(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(baseURL + '/clerks/attendance/template', { headers: { Authorization: `Bearer ${token}` } });
      // An error answer is JSON, and saving it would hand the clerk a
      // "template" that is really an error message.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Template download failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'attendance_template.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : 'Template download failed: ' + e.message); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) { reset(); return; }
    setCsvFile(file);
    try {
      // The shared parser rather than a split on commas: a quoted cell may hold
      // one, and the preview is what the user checks the file against.
      const rows = parseCsv(await file.text());
      if (rows.length === 0) { setCsvPreview(null); return; }
      const headers = rows[0].map((h) => h.toLowerCase());
      const data = rows.slice(1, 6).map((cells, i) => {
        const row = { _row: i + 2 };
        headers.forEach((header, idx) => { row[header] = cells[idx] || ''; });
        return row;
      });
      setCsvPreview({ headers, data, total: rows.length - 1 });
    } catch {
      setCsvPreview(null);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) { toast.error('Select a CSV file'); return; }
    setUploading(true);
    const form = new FormData(); form.append('file', csvFile);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(baseURL + '/clerks/attendance/csv', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (res.ok) {
        // data.data.skipped_on_leave (Task 7) counts rows the import refused
        // to write because the scholar has an approved leave for that date —
        // same silent-drop risk the Mark tab's save toast guards against, so
        // it gets the same treatment here.
        const saveMessage = buildSaveMessage(data.message || 'CSV imported', data.data?.skipped_on_leave);
        // A file whose every row was refused still answers 200.
        if ((data.data?.created ?? 0) + (data.data?.updated ?? 0) > 0) toast.success(saveMessage);
        else toast.error(saveMessage);
        const errors = data.data?.errors || [];
        if (errors.length) {
          const more = errors.length > 3 ? `; and ${errors.length - 3} more` : '';
          toast.warning(`Check these rows: ${errors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
        }
        close();
        onImported();
      } else toast.error(data.message || 'Import failed.');
    } catch (e) { toast.error(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : 'Upload failed: ' + e.message); } finally { setUploading(false); }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={close} title="Upload Attendance CSV" width="90vw">
      <div className="modal-form">
        <div className="info-box attendance-csv-info">
          <p className="attendance-csv-line"><strong>CSV Format:</strong></p>
          <p className="attendance-csv-line attendance-csv-code">roll_no,date,status</p>
          <p className="attendance-csv-line attendance-csv-required"><strong>Required:</strong> roll_no, date (YYYY-MM-DD ≤ today, ≥ registration), status (present/absent)</p>
          <p className="attendance-csv-line attendance-csv-warn">Only roll numbers in your tagged departments are accepted. Clerks can edit only within {editWindow} days.</p>
        </div>
        <div className="attendance-csv-template"><CustomButton text="Download Template" onClick={downloadTemplate} className="attendance-csv-template-btn" /></div>
        <input type="file" accept=".csv" onChange={handleFileChange} className="attendance-csv-file" />
        {csvPreview && (
          <div className="attendance-csv-preview">
            <div className="attendance-csv-preview-head">Preview: {csvPreview.total} row(s) found, showing 5</div>
            <div className="csv-preview-wrap"><table className="csv-preview"><thead><tr><th>Row</th>{csvPreview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{csvPreview.data.map(r => <tr key={r._row}><td className="csv-rownum">{r._row}</td>{csvPreview.headers.map(h => <td key={h}>{r[h] || <span className="attendance-note-muted">empty</span>}</td>)}</tr>)}</tbody></table></div>
          </div>
        )}
        <div className="attendance-csv-actions">
          <button type="button" className="attendance-csv-cancel" onClick={close}>Cancel</button>
          <button type="button" className="attendance-csv-upload" onClick={handleCsvUpload} disabled={uploading || !csvFile}>{uploading ? 'Uploading…' : 'Upload'}</button>
        </div>
      </div>
    </CustomModal>
  );
};

export default AttendanceCsvDialog;
