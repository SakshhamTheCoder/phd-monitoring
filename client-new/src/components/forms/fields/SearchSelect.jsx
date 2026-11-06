import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import './Fields.css';

/**
 * A choice from a list that can be searched.
 *
 * Each option is {value, title, keywords?}. Only the title is shown, but the
 * search also reads `keywords`, so a department is written by its code (CSED)
 * and still found by typing part of its full name. A native select cannot do
 * this: it matches only the text it displays.
 *
 * `emptyTitle` adds a first choice with value '' ("Select", "All departments").
 */
const SearchSelect = ({ id, value, options = [], onChange, emptyTitle = 'Select', required = false, className = 'input-field', ariaLabel, disabled = false }) => {
  const generated = useId();
  const fieldId = id || generated;
  const listId = `${fieldId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);

  const selected = options.find((option) => String(option.value) === String(value));
  const all = useMemo(
    () => (emptyTitle === null ? options : [{ value: '', title: emptyTitle, empty: true }, ...options]),
    [options, emptyTitle],
  );
  const shown = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return all;
    return options.filter((option) => `${option.title} ${option.keywords ?? ''}`.toLowerCase().includes(wanted));
  }, [all, options, query]);

  useEffect(() => { setActive(0); }, [query, open]);

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (option) => {
    onChange(String(option.value));
    close();
  };

  // A click outside closes the list without choosing.
  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) close(); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((now) => Math.min(now + 1, shown.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((now) => Math.max(now - 1, 0));
    } else if (event.key === 'Enter' && open && shown[active]) {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      close();
    }
  };

  const text = open ? query : (selected ? selected.title : '');

  return (
    <div className="input-suggestions-container" ref={rootRef}>
      <input
        id={fieldId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-required={required || undefined}
        autoComplete="off"
        className={className}
        disabled={disabled}
        value={text}
        placeholder={selected ? selected.title : emptyTitle ?? 'Search'}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="suggestions-list" id={listId} role="listbox">
          {shown.length === 0 && <li className="suggestion-item no-suggestions-message">No match</li>}
          {shown.map((option, index) => (
            <li
              key={option.empty ? '__empty' : option.value}
              role="option"
              aria-selected={String(option.value) === String(value)}
              className={`suggestion-item${index === active ? ' active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              title={option.keywords || undefined}
            >
              {option.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchSelect;
