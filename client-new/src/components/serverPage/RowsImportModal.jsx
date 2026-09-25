import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { baseURL } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
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

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');

// A list of rows the server could not take, the first three by name.
const rowsToCheck = (errors) => {
  const more = errors.length > 3 ? `; and ${errors.length - 3} more` : '';
  return `Check these rows: ${errors.slice(0, 3).join('; ')}${more}`;
};

/**
 * A CSV import read in the browser and posted as rows (a page view's import of
 * kind 'rows'). What the rows mean is the server's to read.
 *
 * Posted whole, the answer says what to tell the reader (messages). With
 * confirm_first the server is asked what the import will do before anything is
 * written, and the reader confirms it.
 *
 * Posted in batches (spec.batch), a long sheet goes a batch at a time, each
 * tried three times, with the progress shown; the counts the batches answer
 * are added up and said once at the end in the view's words.
 */
const RowsImportModal = ({ spec, isOpen, onClose, onImported }) => {
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  // The answers to the view's extra questions (whether to mail sign-in links).
  const [extra, setExtra] = useState(() => Object.fromEntries((spec.extra || []).map((question) => [question.key, false])));
  const { setLoading } = useLoading();
  const url = baseURL + spec.path;

  const importWhole = async (preview, reset) => {
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

  const importInBatches = async (preview, reset) => {
    const { batch } = spec;
    const loader = batch.loader !== false;
    try {
      setSubmitting(true);
      if (loader) setLoading(true);

      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please login again.');
        return;
      }

      // One id for the run, repeated on every batch, so Send sign-in links
      // can mail exactly the people this import brought in.
      const run = batch.run_id ? { import_batch: crypto.randomUUID() } : {};

      const rows = preview.data;
      const batches = [];
      for (let i = 0; i < rows.length; i += batch.size) batches.push(rows.slice(i, i + batch.size));

      const total = { created: 0, updated: 0, errors: 0 };
      let rowErrors = [];

      for (let index = 0; index < batches.length; index++) {
        const rowsInBatch = batches[index];
        setUploadProgress({
          current: Math.min((index + 1) * batch.size, rows.length),
          total: rows.length,
          percentage: Math.round(((index + 1) / batches.length) * 100),
        });

        for (let attempt = 0; attempt <= 2; attempt++) {
          const res = await customFetch(url, 'POST', { rows: rowsInBatch, ...run, ...extra }, batch.reports_failures === true);
          // A 401 has already sent the page to sign in; there is no going on.
          if (!res.success && !localStorage.getItem('token')) return;

          if (res.success && res.response?.success !== false) {
            const counts = res.response?.data || {};
            total.created += counts.success_count || 0;
            total.updated += counts.update_count || 0;
            total.errors += counts.error_count || 0;
            rowErrors = rowErrors.concat(counts.errors || []);
            break;
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          toast.error(res.networkError && batch.failed.includes('{message}')
            ? NETWORK_ERROR_MESSAGE
            : fill(batch.failed, { n: index + 1, message: res.response?.message || 'Server error' }));
          total.errors += rowsInBatch.length;
        }
      }

      const summary = fill(batch.summary, total);
      if (total.created + total.updated > 0) toast.success(fill(batch.done, { summary }));
      else toast.error(fill(batch.none, { summary }));
      if (rowErrors.length > 0) toast.warning(rowsToCheck(rowErrors), { autoClose: 10000 });

      onClose();
      reset?.();
      setUploadProgress(null);
      onImported();
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error(batch.crashed);
    } finally {
      if (loader) setLoading(false);
      setSubmitting(false);
      setUploadProgress(null);
    }
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
      onImport={spec.batch ? importInBatches : importWhole}
      submitting={submitting}
      uploadProgress={spec.batch ? uploadProgress : undefined}
      extraControls={(spec.extra || []).map((question) => (
        <label key={question.key} className="csv-import-note" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={extra[question.key]}
            onChange={(e) => setExtra((now) => ({ ...now, [question.key]: e.target.checked }))}
          />
          {question.label}
        </label>
      ))}
    />
  );
};

export default RowsImportModal;
