import React, { useState } from 'react';
import { useLoading } from '../../context/LoadingContext';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../forms/fields/CustomButton';
import { toast } from 'react-toastify';
import { read, utils } from 'xlsx';
import GridContainer from '../forms/fields/GridContainer';

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

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = utils.sheet_to_json(sheet, { header: 1, raw: false });

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
    };

    reader.readAsArrayBuffer(file);
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
    <div style={{ padding: '20px' }}>
      <h3>Bulk Allocate Supervisors</h3>
      <p style={{ marginBottom: '10px' }}>
        Upload a CSV to allocate supervisors for many students at once. Download the sample CSV to see the required format.
      </p>
      <div
        style={{
          backgroundColor: '#f0f7ff',
          border: '1px solid #2196F3',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '14px',
        }}
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
            style={{
              marginTop: '10px',
              padding: '8px',
              border: '2px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          />,
          <CustomButton
            text='Download Sample CSV'
            onClick={downloadSampleCSV}
            style={{
              backgroundColor: '#FF9800',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '500',
            }}
          />,
        ]}
        space={2}
      />

      {rows.length > 0 && (
        <>
          <div style={{ marginTop: '20px', fontWeight: 'bold' }}>
            {rows.length} allocation(s) ready to submit
          </div>

          <div style={{ overflowX: 'auto', marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                backgroundColor: '#fff',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
              }}
            >
              <thead
                style={{
                  backgroundColor: '#f5f5f5',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <tr>
                  {['Row', 'Roll Number', 'Supervisors'].map((key) => (
                    <th
                      key={key}
                      style={{
                        border: '1px solid #ccc',
                        padding: '10px',
                        fontWeight: '600',
                        textAlign: 'left',
                        color: '#333',
                        whiteSpace: 'nowrap',
                      }}
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
                    style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9',
                    }}
                  >
                    {[row.row_number, row.roll_no, row.supervisors.join(', ')].map((value, idx) => (
                      <td
                        key={idx}
                        style={{
                          padding: '10px',
                          border: '1px solid #ddd',
                          color: '#444',
                        }}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <CustomButton
              text='Confirm Bulk Allocation'
              onClick={confirmBulkAllocate}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '16px',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default BulkAllocateSupervisors;
