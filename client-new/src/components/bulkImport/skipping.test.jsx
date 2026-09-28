// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import UnifiedBulkImportModal from './UnifiedBulkImportModal';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const sample = 'Emp id,Full Name,Broad Area of Expertise\n10001,Asha Rao,Signal Processing\n10002,Bhavna Jain,Wireless Communication\n';

const openWith = (onImport) => {
  render(
    <UnifiedBulkImportModal
      isOpen
      onClose={() => {}}
      title="Import faculty"
      required={['Emp id']}
      rules={[]}
      sampleFileName="sample.csv"
      sampleCsvContent={sample}
      onImport={onImport}
    />,
  );

  const file = new File([sample], 'faculty.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('Choose a CSV file to import'), { target: { files: [file] } });
};

/**
 * A sheet usually arrives with one column that is not ready: the institute's
 * faculty sheet names research areas the departments have not settled yet.
 * Leaving that column out of one import used to mean editing the file outside
 * the portal and losing track of which copy went in.
 */
describe('choosing what goes in', () => {
  afterEach(cleanup);

  it('leaves out a column the office ticks off', async () => {
    const onImport = vi.fn();
    openWith(onImport);

    expect(await screen.findByText(/2 row\(s\) found/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Import the Broad Area of Expertise column'));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const [sent] = onImport.mock.calls[0];
    expect(sent.headers).toEqual(['Emp id', 'Full Name']);
    expect(sent.data).toHaveLength(2);
    expect(sent.data[0]).not.toHaveProperty('Broad Area of Expertise');
    expect(sent.data[0]['Emp id']).toBe('10001');
  });

  it('leaves out a row the office ticks off, and keeps the rest', async () => {
    const onImport = vi.fn();
    openWith(onImport);

    expect(await screen.findByText(/2 row\(s\) found/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Import row 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const [sent] = onImport.mock.calls[0];
    expect(sent.data).toHaveLength(1);
    expect(sent.data[0]['Emp id']).toBe('10002');
  });

  it('refuses to import when every row is ticked off', async () => {
    const onImport = vi.fn();
    openWith(onImport);

    expect(await screen.findByText(/2 row\(s\) found/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Import row 2'));
    fireEvent.click(screen.getByLabelText('Import row 3'));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(onImport).not.toHaveBeenCalled();
  });
});
