import React, { useEffect, useMemo, useRef, useState } from 'react';
import DropdownField from '../forms/fields/DropdownField';
import InputSuggestions from '../forms/fields/InputSuggestions';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import './FilterBar.css';

// What a field is matched with, decided per field instead of asked for.
const operatorFor = (filter) => (filter.options || filter.data_type === 'date' || filter.data_type === 'number' ? '=' : 'LIKE');

const inputTypes = { date: 'date', time: 'time', number: 'number' };

/**
 * One search box, and the page's filters behind "Filters".
 *
 * Typing searches every text field of the page at once (an OR), so nothing has
 * to be picked first; a filter applies the moment it is set, and removing one
 * re-runs the search. The page's own mandatory filters (a tab, say) are passed
 * through untouched, and any filter chosen here joins them, so a search within
 * a filter still narrows rather than widens.
 *
 * A field holds more than one value: two departments mean either department,
 * while a department and a roll number mean both. Each value is a chip of its
 * own, and removing one leaves the rest of that field standing.
 *
 * `exclude` names filters the page already drives itself, so they are not
 * offered here a second time to be set to something that contradicts it.
 *
 * `path` names the list being filtered, for a page holding more than one. It
 * defaults to the page's own path, which is where the filters usually live.
 */
const FilterBar = ({ placeholder = 'Search…', mandatory = [], exclude = [], path, onSearch }) => {
  // null until the page's filter definitions arrive.
  const [filters, setFilters] = useState(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  // key_name -> { label, op, values: [] }. A field holds every value chosen for
  // it, not just the last one.
  const [chosen, setChosen] = useState({});
  // What is being typed into each field, cleared once it becomes a chip.
  const [drafts, setDrafts] = useState({});
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    // /filters may 404 or answer with an object on a page that defines none.
    // Never store a non-array: the render maps over it.
    // The page's own path, unless it holds more than one list and says which.
    customFetch(`${baseURL}${path || window.location.pathname}/filters`, 'GET', null, false)
      .then((res) => {
        const raw = res?.response;
        setFilters(Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);
      })
      .catch(() => setFilters([]));
  }, [path]);

  // The box searches the fields that are free text; a dropdown or a date is not
  // something anyone types into a search box.
  const searchable = useMemo(
    () => (filters || []).filter((f) => !f.options && f.data_type !== 'date' && f.data_type !== 'number'),
    [filters],
  );
  // A field's key may name two columns, so one of these searches both students
  // of a URF project at once.
  const searchFields = useMemo(
    () => searchable.map((f) => ({ key: f.key_name, label: f.label })),
    [searchable],
  );

  // One condition per value: the server reads several on one key as "either of
  // these", and keys against each other as "and".
  const conditionsFrom = (picks) => Object.entries(picks)
    .flatMap(([key, entry]) => entry.values.map((value) => ({ label: entry.label, key, op: entry.op, value })));

  // A search across fields is an OR, so anything else has to be a mandatory
  // filter to keep narrowing the result rather than widening it.
  const emit = (nextText, picks) => {
    const query = nextText.trim();
    const picked = conditionsFrom(picks);
    onSearchRef.current(query
      ? {
        combine: 'or',
        conditions: searchFields.map((f) => ({ label: f.label, key: f.key, op: 'LIKE', value: query })),
        mandatory_filter: [...mandatory, ...picked],
      }
      : { combine: 'and', conditions: picked, mandatory_filter: mandatory });
  };

  // Re-run when the page's own filters change, e.g. a tab. Not on the first
  // render: the page loads its own list, and the field list is still on its way.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) emit(text, chosen);
    else mounted.current = true;
  }, [JSON.stringify(mandatory)]);

  const runSearch = () => emit(text, chosen);

  // A value joins the ones already chosen for its field rather than replacing
  // them, so two departments mean either department. Picking one searches at
  // once; a typed one waits for Enter, so nothing runs half-typed.
  const addValue = (filter, value) => {
    if (value === '' || value === null || value === undefined) return;

    const key = filter.key_name;
    const entry = chosen[key] ?? { label: filter.label, op: operatorFor(filter), values: [] };

    // The same value twice is the same filter, and reads as a duplicate chip.
    if (entry.values.some((held) => String(held).toLowerCase() === String(value).toLowerCase())) {
      setDrafts((all) => ({ ...all, [key]: '' }));
      return;
    }

    const next = { ...chosen, [key]: { ...entry, values: [...entry.values, value] } };
    setChosen(next);
    setDrafts((all) => ({ ...all, [key]: '' }));
    emit(text, next);
  };

  // Removing a chip searches at once, so the table never keeps a filter that is
  // no longer on screen. The field's other values stay.
  const removeValue = (key, value) => {
    const entry = chosen[key];
    if (!entry) return;

    const values = entry.values.filter((held) => held !== value);
    const next = { ...chosen };
    if (values.length) next[key] = { ...entry, values };
    else delete next[key];

    setChosen(next);
    emit(text, next);
  };

  const clearAll = () => {
    setText('');
    setChosen({});
    setDrafts({});
    emit('', {});
  };

  const control = (filter) => {
    const draft = drafts[filter.key_name] ?? '';
    if (filter.options) {
      return (
        <DropdownField
          label={filter.label}
          options={filter.options.map((o) => (typeof o === 'string' ? { title: o, value: o } : o))}
          initialValue=""
          onChange={(v) => addValue(filter, v)}
        />
      );
    }
    if (filter.api_url) {
      return (
        <InputSuggestions
          label={filter.label}
          apiUrl={baseURL + filter.api_url}
          initialValue=""
          suggestionManadatory={false}
          onSelect={(picked) => addValue(filter, picked?.name ?? '')}
        />
      );
    }
    return (
      <div className="input-field-container">
        <label className="input-label">{filter.label}</label>
        <input
          className="input-field"
          type={inputTypes[filter.data_type] || 'text'}
          value={draft}
          placeholder={`Any ${filter.label.toLowerCase()}`}
          onChange={(e) => setDrafts((all) => ({ ...all, [filter.key_name]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            // Enter adds what was typed as a chip, rather than searching the
            // box, so a second value can follow it into the same field.
            e.preventDefault();
            addValue(filter, draft);
          }}
        />
      </div>
    );
  };

  const chips = conditionsFrom(chosen);

  // A page that defines no filters has nothing to search, so it gets no bar.
  if (!filters || filters.length === 0) return null;

  return (
    <div className="filter-bar">
      <div className="filter-bar-row">
        <span className="filter-bar-icon"><i className="fa fa-search" aria-hidden="true"></i></span>
        <input
          className="filter-bar-input"
          type="search"
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button type="button" className="filter-bar-go" onClick={runSearch}>Search</button>
        <button type="button" className="filter-bar-toggle" onClick={() => setOpen(!open)}>
          <i className="fa fa-sliders" aria-hidden="true"></i> Filters{chips.length ? ` (${chips.length})` : ''}
        </button>
        {(text || chips.length > 0) && (
          <button type="button" className="filter-bar-clear" onClick={clearAll}>Clear</button>
        )}
      </div>

      {open && (
        <div className="filter-bar-fields">
          {filters
            .filter((filter) => !exclude.includes(filter.key_name))
            .map((filter) => <div key={filter.key_name} className="filter-bar-field">{control(filter)}</div>)}
        </div>
      )}

      {chips.length > 0 && (
        <div className="filter-bar-chips">
          {chips.map((chip) => (
            // A field can hold several values, so a chip is known by both.
            <span key={`${chip.key}:${chip.value}`} className="filter-chip">
              {chip.label}: {String(chip.value)}
              <button
                type="button"
                aria-label={`Remove ${chip.label} ${chip.value} filter`}
                onClick={() => removeValue(chip.key, chip.value)}
              >&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
