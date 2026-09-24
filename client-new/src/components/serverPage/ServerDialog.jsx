import React, { useState } from 'react';
import CustomModal from '../forms/modal/CustomModal';
import ServerPanel from '../forms/serverForm/ServerPanel';
import { useLoading } from '../../context/LoadingContext';
import { sendRequest } from './requests';
import { fillFromRow } from '../../api/views';
import { toDateValue } from '../../utils/timeParse';

// A row value read the way a field keeps it (Field::fromAs on the server).
const AS = {
  // A timestamp as its day in the reader's time zone: the server sends 18:30
  // UTC the day before for a date on IST, and kept raw an untouched field was
  // saved back as that earlier day.
  date: (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : toDateValue(parsed);
  },
  // Yes, No, or '' for not stated: a null is a question nobody answered.
  yes_no: (value) => (value === null || value === undefined || value === '' ? '' : value ? '1' : '0'),
  flag: (value) => !!value,
  one_of: (value, source) => (source.of.includes(value) ? value : ''),
};
import DepartmentManagerBlock from './blocks/DepartmentManagerBlock';
import UserEditorBlock from './blocks/UserEditorBlock';
import SignInLinksBlock from './blocks/SignInLinksBlock';
import SupervisorDoctoralBlock from './blocks/SupervisorDoctoralBlock';
import SemesterEditorBlock from './blocks/SemesterEditorBlock';
import BulkAllocateBlock from './blocks/BulkAllocateBlock';
import ExaminerInitiatorBlock from './blocks/ExaminerInitiatorBlock';
import ChoiceDialog from './ChoiceDialog';

// Dialogs with behaviour of their own, which the server opens by name.
const BLOCKS = {
  'department-manager': DepartmentManagerBlock,
  'user-editor': UserEditorBlock,
  'sign-in-links': SignInLinksBlock,
  'supervisor-doctoral-manager': SupervisorDoctoralBlock,
  'semester-editor': SemesterEditorBlock,
  'bulk-allocate': BulkAllocateBlock,
  'examiner-initiator': ExaminerInitiatorBlock,
};

// What one of a field's sources reads from the row: a key, keys read as
// words, or a list read as its entries joined.
const readSource = (source, row) => {
  if (Array.isArray(source)) return source.map((key) => `${row[key] ?? ''}`.trim()).filter(Boolean).join(' ');
  if (source && typeof source === 'object') {
    if (source.words) return source.words.map((key) => row[key]).filter(Boolean).join(' ');
    const value = row[source.key];
    if (source.pluck) return (value || []).map((entry) => entry[source.pluck]);
    if (source.as) return AS[source.as](value, source);
    return Array.isArray(value) ? value.join(source.join) : value;
  }
  return row[source];
};

// The first of a field's sources the row fills, else what the field starts
// from anyway ('' unless the view gives it a default). A 0 or false reads as
// unfilled, as the forms this replaced read `row.value || default`.
const fromRow = (field, row) => {
  for (const source of field.from) {
    const value = readSource(source, row);
    if (value) return value;
  }
  return field.value ?? '';
};

// The dialog's rows with each field starting from the row it was opened on.
const startingFrom = (rows, row) =>
  !row ? rows : rows.map((entry) => {
    if (entry.rows) return { ...entry, rows: startingFrom(entry.rows, row) };
    if (entry.items) return { ...entry, items: startingFrom(entry.items, row) };
    if (entry.lines) return { ...entry, lines: entry.lines.map((line) => ({ ...line, value: row[line.key] })) };
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
const ServerDialog = ({ dialog, isOpen, row, opened, onClose, onSaved, onChoose }) => {
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

  // Mounted before anything opens, so the first opening animates as the rest do.
  if (!dialog) return <CustomModal isOpen={false} onClose={onClose} />;

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
      {dialog.kind === 'choice' ? (
        <ChoiceDialog dialog={dialog} onChoose={onChoose} onCancel={onClose} />
      ) : Block ? (
        <Block key={opened} row={row} props={dialog.props} onClose={onClose} onChanged={onSaved} />
      ) : (
        <ServerPanel
          key={opened}
          rows={startingFrom(dialog.rows, row)}
          wrapped={dialog.wrapped === true}
          host={{ submit, onCancel: onClose, busy }}
        />
      )}
    </CustomModal>
  );
};

export default ServerDialog;
