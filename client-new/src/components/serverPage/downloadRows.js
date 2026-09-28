import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';

/**
 * The records an endpoint says still need something, as a CSV.
 *
 * Written in the columns of the import that will read it back, so the round
 * trip is: take the file away, fill the one empty column in a spreadsheet,
 * send the same file back through the dialog it came from. The endpoint
 * answers { headers, rows }.
 */
export const downloadRows = async ({ path, filename }) => {
  const answer = await customFetch(baseURL + path, 'GET', {}, false);
  const { headers, rows } = answer?.response ?? {};

  if (!answer?.success || !headers) {
    toast.error('Could not prepare that file. Try again.');
    return;
  }

  if (!rows.length) {
    toast.info('Nothing to download: no record is missing that.');
    return;
  }

  const quote = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(quote).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default downloadRows;
