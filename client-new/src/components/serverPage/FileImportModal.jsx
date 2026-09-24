import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
import CustomModal from '../forms/modal/CustomModal';
import CustomButton from '../forms/fields/CustomButton';

/**
 * A CSV import that posts the file as it is (a page view's import of kind
 * 'file'): the columns it expects, then the file, then Import. The answer's
 * counts say whether anything came in, and the rows it could not take are
 * listed, the first three by name.
 */
const FileImportModal = ({ spec, isOpen, onClose, onImported }) => {
  const [csvFile, setCsvFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { setLoading } = useLoading();

  const close = () => {
    onClose();
    setCsvFile(null);
  };

  const importFile = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);

      const body = new FormData();
      body.append('file', csvFile);

      const response = await fetch(baseURL + spec.path, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body,
      });

      const data = await response.json();

      if (data.success) {
        const { success_count = 0, update_count = 0, errors = [] } = data.data || {};
        if (success_count + update_count > 0) toast.success(data.message);
        else toast.error(data.message);
        if (errors.length > 0) {
          const more = errors.length > 3 ? `; and ${errors.length - 3} more` : '';
          toast.warning(`Check these rows: ${errors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
        }
        onClose();
        setCsvFile(null);
        onImported();
      } else {
        toast.error(data.message || 'Failed to import');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import CSV');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={close} title={spec.title}>
      <>
        <section className="csv-import-section">
          <h4 className="csv-import-heading">CSV format</h4>
          <ul className="csv-import-columns">
            {spec.columns.map((column) => <li key={column}>{column}</li>)}
          </ul>
          <p className="csv-import-note">{spec.note}</p>
        </section>

        <div className="csv-import-file">
          <input
            type="file"
            accept=".csv"
            aria-label="Choose a CSV file to import"
            onChange={(e) => setCsvFile(e.target.files[0])}
            className="csv-import-input"
          />
        </div>

        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={close} />
          <CustomButton text="Import" onClick={importFile} busy={submitting} disabled={!csvFile} />
        </div>
      </>
    </CustomModal>
  );
};

export default FileImportModal;
