import React, { useState } from 'react';
import CustomModal from '../forms/modal/CustomModal';
import ServerPanel from '../forms/serverForm/ServerPanel';
import { useLoading } from '../../context/LoadingContext';
import { sendRequest } from './requests';

// The first of a field's sources the row fills: a key, or keys read as words.
const fromRow = (sources, row) => {
  for (const source of sources) {
    const value = Array.isArray(source)
      ? source.map((key) => `${row[key] ?? ''}`.trim()).filter(Boolean).join(' ')
      : row[source];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

// The dialog's rows with each field starting from the row it was opened on.
const startingFrom = (rows, row) =>
  !row ? rows : rows.map((entry) => {
    if (entry.rows) return { ...entry, rows: startingFrom(entry.rows, row) };
    if (entry.items) return { ...entry, items: startingFrom(entry.items, row) };
    return entry.from ? { ...entry, value: fromRow(entry.from, row) } : entry;
  });

/**
 * A dialog a page view describes (server: App\Pages\PageDefinition): its
 * fields drawn as a form's, and its request sent with the answers. `opened`
 * changes each time it opens, so every opening starts from the view again.
 */
const ServerDialog = ({ dialog, isOpen, row, opened, onClose, onSaved }) => {
  const { setLoading } = useLoading();
  const [busy, setBusy] = useState(false);

  const submit = async (values) => {
    setBusy(true);
    const saved = await sendRequest(dialog.request, row, values, setLoading);
    setBusy(false);
    if (saved) {
      onClose();
      onSaved();
    }
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={dialog.title}
      width={dialog.width}
      minWidth={dialog.min_width}
      maxWidth={dialog.max_width}
      minHeight={dialog.min_height}
      maxHeight={dialog.max_height}
      closeOnOutsideClick={dialog.close_outside}
    >
      <ServerPanel
        key={opened}
        rows={startingFrom(dialog.rows, row)}
        wrapped={false}
        host={{ submit, onCancel: onClose, busy }}
      />
    </CustomModal>
  );
};

export default ServerDialog;
