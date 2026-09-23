import React, { useRef, useState } from 'react';
import CustomModal from '../forms/modal/CustomModal';
import CustomButton from '../forms/fields/CustomButton';
import { toast } from 'react-toastify';
import { parseCsv } from '../../utils/csv';

/**
 * The import dialog every page shares.
 *
 * The columns come from the sample CSV's own header row, so the list on screen
 * and the file you download can never disagree. They used to be passed in
 * separately as one long comma-joined string, printed in a monospace block that
 * broke mid-word.
 *
 * `required` names the columns a new record cannot be created without, and
 * `rules` is what happens to a record that already exists. Both are lists
 * rather than prose, because that is the shape of the question being asked.
 */
const UnifiedBulkImportModal = ({
  isOpen,
  onClose,
  title,
  required = [],
  rules = [],
  sampleFileName,
  sampleCsvContent,
  onImport,
  submitting = false,
  uploadProgress = null,
  // A page with a decision of its own to offer, such as whether the import
  // should mail the people it creates. Rendered beside the actions rather than
  // grown into another prop per question.
  extraControls = null,
}) => {
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const fileInputRef = useRef(null);

  const columns = sampleCsvContent ? parseCsv(sampleCsvContent)[0] || [] : [];
  const isRequired = (column) => required.some((name) => name.toLowerCase() === column.toLowerCase());

  const resetState = () => {
    setCsvFile(null);
    setCsvPreview(null);
    // Otherwise picking the same file again fires no change and loads nothing.
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        const rows = parseCsv(event.target.result);

        if (rows.length === 0) {
          toast.error('CSV file is empty');
          setCsvPreview(null);
          return;
        }

        const headers = rows[0];
        const data = rows.slice(1).map((values, index) => {
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
      <>
        <section className="csv-import-section">
          <h4 className="csv-import-heading">Columns</h4>
          <ul className="csv-import-columns">
            {columns.map((column) => (
              <li key={column} className={isRequired(column) ? 'is-required' : undefined}>
                {column}
              </li>
            ))}
          </ul>
          {required.length > 0 && (
            <p className="csv-import-note">Marked columns are needed to create a new record.</p>
          )}
        </section>

        {rules.length > 0 && (
          <section className="csv-import-section">
            <h4 className="csv-import-heading">What the import does</h4>
            <ul className="csv-import-rules">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="csv-import-file">
          <CustomButton text="Download sample CSV" variant="secondary" onClick={downloadSampleCSV} />
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            aria-label="Choose a CSV file to import"
            onChange={handleFileChange}
            className="csv-import-input"
          />
        </div>

        {csvPreview && (
          <div className="csv-import-preview">
            <div className="csv-import-preview-head">
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
                          {row[header] || <span className="csv-import-empty">empty</span>}
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
          <div className="csv-import-progress">
            <div className="csv-import-progress-head">
              <span>Processing...</span>
              <span>
                {uploadProgress.current} / {uploadProgress.total} rows ({uploadProgress.percentage}%)
              </span>
            </div>
            <div className="csv-import-progress-track">
              <div
                className="csv-import-progress-bar"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {extraControls}

        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={handleClose} />
          <CustomButton
            text={submitting ? 'Importing...' : 'Import'}
            onClick={handleConfirm}
            disabled={submitting || !csvPreview}
          />
        </div>
      </>
    </CustomModal>
  );
};

export default UnifiedBulkImportModal;
