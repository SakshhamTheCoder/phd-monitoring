import React, { useState } from 'react';
import { useLoading } from '../../context/LoadingContext';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../forms/fields/CustomButton';
import { toast } from 'react-toastify';
import GridContainer from '../forms/fields/GridContainer';
import { parseCsv } from '../../utils/csv';
import '../bulkImport/bulkPreview.css';

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

    file.text().then((text) => {
      const rawData = parseCsv(text);

      const parsed = [];
      let invalidRows = 0;

      rawData.forEach((rowArr, index) => {
        if (index === 0) return; // Skip header row

        if (!rowArr || rowArr.every((cell) => !cell || cell.toString().trim() === '')) {
          return;
        }

        // Spreadsheet row number, so errors line up with what the user sees.
        const rowNumber = index + 1;

        const rollNo = (rowArr[0] || '').toString().trim();
        if (!rollNo) {
          invalidRows++;
          toast.error(`Row ${rowNumber}: Missing Roll Number`);
          return;
        }

        const supervisors = rowArr
          .slice(1, MAX_SUPERVISORS + 1)
          .map((cell) => (cell || '').toString().trim())
          .filter((cell) => cell !== '');

        if (supervisors.length === 0) {
          invalidRows++;
          toast.error(`Row ${rowNumber}: At least one supervisor is required`);
          return;
        }

        if (new Set(supervisors).size !== supervisors.length) {
          invalidRows++;
          toast.error(`Row ${rowNumber}: Supervisors must be unique`);
          return;
        }

        parsed.push({ row_number: rowNumber, roll_no: rollNo, supervisors });
      });

      if (invalidRows > 0) {
        toast.warn(`${invalidRows} row(s) ignored due to errors`);
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
    if (rows.length === 0) {
      toast.warn('Please upload a CSV file before confirming.');
      return;
    }

    setLoading(true);

    customFetch(baseURL + '/forms/supervisor-allocation/bulk-allocate', 'POST', { batch_data: rows })
      .then((data) => {
        const result = data?.data;
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
          toast.error(data?.message || 'Bulk allocation failed');
        }
        setLoading(false);
      })
      .catch((error) => {
        toast.error('Error in bulk allocation: ' + error);
        setLoading(false);
      });
  };

  return (
    <div className="bulk-preview">
      <h3>Bulk Allocate Supervisors</h3>
      <p className="bulk-preview-title">
        Upload a CSV to allocate supervisors for many students at once. Download the sample CSV to see the required format.
      </p>
      <div
        className="bulk-preview-info"
      >
        <strong>Roll Number:</strong> must belong to a student whose supervisor allocation form is awaiting you (the PhD Coordinator).<br />
        <strong>Supervisors:</strong> give each supervisor's faculty code or email. Leave unused supervisor columns blank.<br />
        <strong>After upload:</strong> each allocation is sent on to the HOD for approval, exactly as if you had filled the form in yourself.
      </div>

      <GridContainer
        elements={[
          <input
            type='file'
            accept='.csv'
            onChange={handleFileUpload}
            className="bulk-preview-file"
          />,
          <CustomButton
            text='Download Sample CSV'
            onClick={downloadSampleCSV}
            className="bulk-preview-template"
          />,
        ]}
        space={2}
      />

      {rows.length > 0 && (
        <>
          <div className="bulk-preview-heading">
            {rows.length} allocation(s) ready to submit
          </div>

          <div className="bulk-preview-scroll">
            <table
              className="bulk-preview-table"
            >
              <thead
                className="bulk-preview-head"
              >
                <tr>
                  {['Row', 'Roll Number', 'Supervisors'].map((key) => (
                    <th
                      key={key}
                      className="bulk-preview-th bulk-preview-th--nowrap"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.row_number}
                    className="bulk-preview-row"
                  >
                    {[row.row_number, row.roll_no, row.supervisors.join(', ')].map((value, idx) => (
                      <td
                        key={idx}
                        className="bulk-preview-cell"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bulk-preview-actions">
            <CustomButton
              text='Confirm Bulk Allocation'
              onClick={confirmBulkAllocate}
              className="bulk-preview-confirm"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default BulkAllocateSupervisors;
