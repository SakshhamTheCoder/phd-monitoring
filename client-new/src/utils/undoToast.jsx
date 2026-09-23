import React from 'react';
import { toast } from 'react-toastify';

/**
 * A removal the server has not seen yet (a row dropped from a form before
 * Submit) happens at once, with a way back. Nothing is lost that Undo cannot
 * put back, so the removal needs no confirm dialog.
 *
 *   const removed = rows[index];
 *   setRows(rows.filter((_, i) => i !== index));
 *   toastUndo('Milestone removed.', () => setRows((now) => insertAt(now, index, removed)));
 */
export const toastUndo = (message, onUndo) =>
  toast.info(({ closeToast }) => (
    <div className="toast-undo">
      <span>{message}</span>
      <button type="button" onClick={() => { onUndo(); closeToast(); }}>Undo</button>
    </div>
  ), { autoClose: 6000 });

// Puts an item back where it was taken from.
export const insertAt = (list, index, item) => [...list.slice(0, index), item, ...list.slice(index)];
