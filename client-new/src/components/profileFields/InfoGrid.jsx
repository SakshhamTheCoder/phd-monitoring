import { EMPTY_VALUE } from '../../utils/timeParse';
import React from 'react';
import './InfoGrid.css';

/**
 * The field matrix both profiles show, and the inline editor both profiles use.
 *
 * A row is a plain object. It is read-only unless it names a `field`, and a
 * named field turns into an input while `editing` is on, in place, where the
 * value already was. That is the whole edit mode: no dialog, nothing to find
 * the way back from.
 *
 * Row keys:
 *   label     what the field is called
 *   value     what to print when not editing
 *   node      richer output than a string, a link say; wins over `value`
 *   field     the key in `values`; its presence is what makes the row editable
 *   type      input type, default text
 *   hint      one line under the input, only while editing
 *   disabled  editable in principle, refused right now, with `hint` saying why
 *   span      'all' to run the row across the grid
 */
// Absent, not merely falsy: a citation count of 0 is a value, and printing a
// dash for it would be wrong.
const isBlank = (value) => value === null || value === undefined || value === '';

const InfoGrid = ({ className = '', rows, editing = false, values = {}, onChange }) => (
  <div className={`profile-info-grid ${className}`.trim()}>
    {rows.filter(Boolean).map((row) => (
      <div key={row.label} className={row.span === 'all' ? 'span-all' : undefined}>
        <strong>{row.label}:</strong>{' '}
        {editing && row.field ? (
          <>
            <input
              className="profile-inline-input"
              type={row.type || 'text'}
              aria-label={row.label}
              value={values[row.field] ?? ''}
              disabled={row.disabled}
              onChange={(e) => onChange(row.field, e.target.value)}
            />
            {row.hint && <small className="profile-field-hint">{row.hint}</small>}
          </>
        ) : (
          row.node != null ? row.node : (isBlank(row.value) ? EMPTY_VALUE : row.value)
        )}
      </div>
    ))}
  </div>
);

export default InfoGrid;
