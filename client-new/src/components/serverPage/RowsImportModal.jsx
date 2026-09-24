import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import UnifiedBulkImportModal from '../bulkImport/UnifiedBulkImportModal';
import { forgetKeptLists } from './requests';

// What an import's answer tells the reader, in order. A sticky one stays up
// long enough to read a list of rows.
export const showMessages = (messages = []) => {
  messages.forEach(({ tone, text, sticky }) => {
    const show = { success: toast.success, warn: toast.warn, info: toast.info, error: toast.error }[tone] || toast.info;
    show(text, sticky ? { autoClose: 10000 } : undefined);
  });
};

/**
 * A CSV import read in the browser and posted as rows (a page view's import of
 * kind 'rows'). What the rows mean is the server's to read; the answer says
 * what to tell the reader. With confirm_first the server is asked what the
 * import will do before anything is written, and the reader confirms it.
 */
const RowsImportModal = ({ spec, isOpen, onClose, onImported }) => {
  const [submitting, setSubmitting] = useState(false);
  const url = baseURL + spec.path;

  const importRows = async (preview, reset) => {
    const body = { rows: preview.data };
    if (spec.confirm_first) {
      const check = await customFetch(url, 'POST', { ...body, preview: true }, false);
      if (check.success && check.response?.confirm && !window.confirm(check.response.confirm)) return;
    }

    setSubmitting(true);
    const response = await customFetch(url, 'POST', body, false);
    setSubmitting(false);

    if (!response.success) {
      toast.error(response.response?.message || spec.failed);
      return;
    }

    forgetKeptLists(spec.invalidates);
    showMessages(response.response?.messages);
    reset();
    onClose();
    onImported();
  };

  return (
    <UnifiedBulkImportModal
      isOpen={isOpen}
      onClose={onClose}
      title={spec.title}
      required={spec.required}
      rules={spec.rules}
      sampleFileName={spec.sample.name}
      sampleCsvContent={spec.sample.csv}
      onImport={importRows}
      submitting={submitting}
    />
  );
};

export default RowsImportModal;
