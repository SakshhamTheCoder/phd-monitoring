import React, { useState } from 'react';
import CustomModal from '../forms/modal/CustomModal';
import ServerPanel from '../forms/serverForm/ServerPanel';
import { useLoading } from '../../context/LoadingContext';
import { sendRequest } from './requests';
import { fillFromRow } from '../../api/views';
import DepartmentManagerBlock from './blocks/DepartmentManagerBlock';

// Dialogs with behaviour of their own, which the server opens by name.
const BLOCKS = { 'department-manager': DepartmentManagerBlock };

// What one of a field's sources reads from the row: a key, keys read as
// words, or a list read as its entries joined.
const readSource = (source, row) => {
  if (Array.isArray(source)) return source.map((key) => `${row[key] ?? ''}`.trim()).filter(Boolean).join(' ');
  if (source && typeof source === 'object') {
    const value = row[source.key];
    if (source.pluck) return (value || []).map((entry) => entry[source.pluck]);
    return Array.isArray(value) ? value.join(source.join) : value;
  }
  return row[source];
};

// The first of a field's sources the row fills, else what the field starts
// from anyway ('' unless the view gives it a default).
const fromRow = (field, row) => {
  for (const source of field.from) {
    const value = readSource(source, row);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return field.value ?? '';
};

// The dialog's rows with each field starting from the row it was opened on.
const startingFrom = (rows, row) =>
  !row ? rows : rows.map((entry) => {
    if (entry.rows) return { ...entry, rows: startingFrom(entry.rows, row) };
    if (entry.items) return { ...entry, items: startingFrom(entry.items, row) };
    return {
      ...entry,
      ...(entry.from ? { value: fromRow(entry, row) } : {}),
      ...(entry.display_from ? { display: row[entry.display_from] ?? '' } : {}),
    };
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

  const Block = BLOCKS[dialog.block];

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={dialog.title && row ? fillFromRow(dialog.title, row) : dialog.title}
      width={dialog.width}
      minWidth={dialog.min_width}
      maxWidth={dialog.max_width}
      minHeight={dialog.min_height}
      maxHeight={dialog.max_height}
      closeOnOutsideClick={dialog.close_outside}
    >
      {Block ? (
        <Block key={opened} row={row} onClose={onClose} onChanged={onSaved} />
      ) : (
        <ServerPanel
          key={opened}
          rows={startingFrom(dialog.rows, row)}
          wrapped={false}
          host={{ submit, onCancel: onClose, busy }}
        />
      )}
    </CustomModal>
  );
};

export default ServerDialog;
