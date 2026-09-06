import React, { useState } from 'react';
import CustomModal from '../forms/modal/CustomModal';
import CustomButton from '../forms/fields/CustomButton';
import { toast } from 'react-toastify';

export const parseCsvRow = (row) => {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQ && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
};

const UnifiedBulkImportModal = ({
  isOpen,
  onClose,
  title,
  formatString,
  infoNodes,
  sampleFileName,
  sampleCsvContent,
  onImport,
  submitting = false,
  uploadProgress = null,
}) => {
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);

  const resetState = () => {
    setCsvFile(null);
    setCsvPreview(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = sampleFileName || 'bulk_import_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Sample CSV downloaded successfully');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      resetState();
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).filter((r) => r.trim());

        if (rows.length === 0) {
          toast.error('CSV file is empty');
          setCsvPreview(null);
          return;
        }

        const headers = parseCsvRow(rows[0]);
        const data = rows.slice(1).map((row, index) => {
          const values = parseCsvRow(row);
          const rowData = { _rowNumber: index + 2 };
          headers.forEach((header, i) => {
            rowData[header] = values[i] || '';
          });
          return rowData;
        });

        setCsvPreview({ headers, data });
      } catch (error) {
        toast.error('Failed to parse CSV file');
        setCsvPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirm = () => {
    if (!csvFile || !csvPreview || csvPreview.data.length === 0) {
      toast.error('Please select a valid CSV file with data');
      return;
    }
    onImport(csvPreview, resetState);
  };

  return (
    <CustomModal isOpen={isOpen} onClose={handleClose} title={title} width="90vw">
      <div className="modal-form">
        <div
          className="info-box"
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          {formatString && (
            <>
              <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                <strong>CSV Format:</strong>
              </p>
              <p
                style={{
                  margin: '0.25rem 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  background: '#e0f2fe',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  wordBreak: 'break-all',
                }}
              >
                {formatString}
              </p>
            </>
          )}
          {infoNodes}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <CustomButton
            text="Download Sample CSV"
            onClick={downloadSampleCSV}
            style={{
              backgroundColor: '#FF9800',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '500',
              marginBottom: '1rem',
            }}
          />
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{
            padding: '0.5rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            fontSize: '1rem',
            cursor: 'pointer',
            marginBottom: '1rem',
            width: '100%',
          }}
        />

        {csvPreview && (
          <div
            style={{
              marginTop: '1rem',
              marginBottom: '1rem',
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                background: '#f9fafb',
                borderBottom: '1px solid var(--border-color)',
                fontWeight: '600',
              }}
            >
              Preview: {csvPreview.data.length} row(s) found
            </div>
            <div className="csv-preview-wrap">
              <table className="csv-preview">
                <thead>
                  <tr>
                    <th>Row</th>
                    {csvPreview.headers.map((header, i) => (
                      <th key={i}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.data.map((row, i) => (
                    <tr key={i}>
                      <td className="csv-rownum">{row._rowNumber}</td>
                      {csvPreview.headers.map((header, j) => (
                        <td key={j}>
                          {row[header] || (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>empty</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {uploadProgress && (
          <div
            style={{
              marginTop: '1rem',
              marginBottom: '1rem',
              padding: '1rem',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#0369a1',
              }}
            >
              <span>Processing...</span>
              <span>
                {uploadProgress.current} / {uploadProgress.total} rows ({uploadProgress.percentage}%)
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: '#e0f2fe',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${uploadProgress.percentage}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <CustomButton text="Cancel" variant="secondary" onClick={handleClose} />
          <CustomButton
            text={submitting ? 'Importing...' : 'Import'}
            onClick={handleConfirm}
            disabled={submitting || !csvFile}
          />
        </div>
      </div>
    </CustomModal>
  );
};

export default UnifiedBulkImportModal;