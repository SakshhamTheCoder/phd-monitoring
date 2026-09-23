import React, { useState } from 'react';
import { useLoading } from '../../context/LoadingContext';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../forms/fields/CustomButton';
import { toast } from 'react-toastify';
import { parseCsv } from '../../utils/csv';

// Number of supervisor columns offered in the sheet. Blank columns are dropped,
// so a row may allocate anywhere from one to MAX_SUPERVISORS supervisors.
const MAX_SUPERVISORS = 3;

const HEADERS = [
  'Roll Number',
  ...Array.from({ length: MAX_SUPERVISORS }, (_, i) => `Supervisor ${i + 1} (Faculty Code or Email)`),
];

const BulkAllocateSupervisors = ({ onSuccess }) => {
  const { setLoading } = useLoading();
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const downloadSampleCSV = () => {
    const sampleRows = [
      ['901234', 'ritu.sharma@thapar.edu', '', ''],
      ['901235', '104521', '104877', ''],
    ];

    const escape = (cell) => {
      const cellStr = String(cell ?? '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    };

    const csvContent = [
      HEADERS.join(','),
      ...sampleRows.map((row) => row.map(escape).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'bulk_allocate_supervisors_sample.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Sample CSV downloaded successfully');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Cleared so picking the same file again, once corrected, loads it again.
    e.target.value = '';

    file.text().then((text) => {
      const rawData = parseCsv(text);

      const parsed = [];
      // One toast for the whole sheet: one per bad row buried the screen.
      const rowErrors = [];

      rawData.forEach((rowArr, index) => {
        if (index === 0) return; // Skip header row

        if (!rowArr || rowArr.every((cell) => !cell || cell.toString().trim() === '')) {
          return;
        }

        // Spreadsheet row number, so errors line up with what the user sees.
        const rowNumber = index + 1;

        const rollNo = (rowArr[0] || '').toString().trim();
        if (!rollNo) {
          rowErrors.push(`Row ${rowNumber}: missing roll number`);
          return;
        }

        const supervisors = rowArr
          .slice(1, MAX_SUPERVISORS + 1)
          .map((cell) => (cell || '').toString().trim())
          .filter((cell) => cell !== '');

        if (supervisors.length === 0) {
          rowErrors.push(`Row ${rowNumber}: no supervisor given`);
          return;
        }

        if (new Set(supervisors).size !== supervisors.length) {
          rowErrors.push(`Row ${rowNumber}: the same supervisor is named twice`);
          return;
        }

        parsed.push({ row_number: rowNumber, roll_no: rollNo, supervisors });
      });

      if (rowErrors.length > 0) {
        const shown = rowErrors.slice(0, 5).join('; ');
        const more = rowErrors.length > 5 ? `; and ${rowErrors.length - 5} more` : '';
        toast.error(`${rowErrors.length} row(s) ignored. ${shown}${more}. Correct the file and choose it again.`, { autoClose: 10000 });
      }

      if (parsed.length === 0) {
        toast.error('No valid rows found in CSV');
        return;
      }

      setRows(parsed);
      toast.success(`Loaded ${parsed.length} allocation(s) from CSV`);
    });
  };

  const confirmBulkAllocate = () => {
    if (submitting) return;
    if (rows.length === 0) {
      toast.warn('Please upload a CSV file before confirming.');
      return;
    }

    setSubmitting(true);
    setLoading(true);

    customFetch(baseURL + '/forms/supervisor-allocation/bulk-allocate', 'POST', { batch_data: rows })
      .then((data) => {
        // customFetch wraps the body as { success, response }.
        const result = data?.response?.data;
        if (data && data.success && result) {
          if (result.success_count > 0) {
            toast.success(`Allocated supervisors for ${result.success_count} student(s)`);
          }
          if (result.error_count > 0) {
            toast.warn(`${result.error_count} row(s) failed`);
            (result.errors || []).forEach((error) => toast.error(error));
            console.error('Bulk allocation errors:', result.errors);
          }
          if (result.success_count > 0) {
            setRows([]);
            if (onSuccess) onSuccess();
          }
        } else {
          toast.error(data?.response?.message || 'Bulk allocation failed');
        }
      })
      .catch((error) => {
        toast.error('Error in bulk allocation: ' + error);
      })
      .finally(() => {
        setSubmitting(false);
        setLoading(false);
      });
  };

  return (
    <>
      <h2 className="modal-title">Bulk allocate supervisors</h2>
      <p className="modal-note">
        Upload a CSV to allocate supervisors for many students at once. Download the sample CSV to see the required format.
      </p>

      <section className="csv-import-section">
        <ul className="csv-import-rules">
          <li><strong>Roll Number:</strong> must belong to a student whose supervisor allocation form is awaiting you (the PhD Coordinator).</li>
          <li><strong>Supervisors:</strong> give each supervisor's faculty code or email. Leave unused supervisor columns blank.</li>
          <li><strong>After upload:</strong> each allocation is sent on to the HOD for approval, exactly as if you had filled the form in yourself.</li>
        </ul>
      </section>

      <div className="csv-import-file">
        <CustomButton text="Download sample CSV" variant="secondary" onClick={downloadSampleCSV} />
        <input
          type="file"
          accept=".csv"
          aria-label="Choose a CSV file to upload"
          onChange={handleFileUpload}
          className="csv-import-input"
        />
      </div>

      {rows.length > 0 && (
        <>
          <div className="csv-import-preview">
            <div className="csv-import-preview-head">
              {rows.length} allocation(s) ready to submit
            </div>
            <div className="csv-preview-wrap">
              <table className="csv-preview">
                <thead>
                  <tr>
                    {['Row', 'Roll number', 'Supervisors'].map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.row_number}>
                      <td className="csv-rownum">{row.row_number}</td>
                      <td>{row.roll_no}</td>
                      <td>{row.supervisors.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-actions">
            <CustomButton
              text="Confirm bulk allocation"
              onClick={confirmBulkAllocate}
              busy={submitting}
            />
          </div>
        </>
      )}
    </>
  );
};

export default BulkAllocateSupervisors;
