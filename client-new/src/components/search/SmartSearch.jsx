import React, { useEffect, useMemo, useRef, useState } from 'react';
import DropdownField from '../forms/fields/DropdownField';
import InputSuggestions from '../forms/fields/InputSuggestions';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import './SmartSearch.css';

// What a field is matched with, decided per field instead of asked for.
const operatorFor = (filter) => (filter.options || filter.data_type === 'date' || filter.data_type === 'number' ? '=' : 'LIKE');

/**
 * One search box, and the page's filters behind "Filters".
 *
 * Typing searches every text field of the page at once (an OR), so nothing has
 * to be picked first; a filter applies the moment it is set, and removing one
 * re-runs the search. The page's own mandatory filters (a tab, say) are passed
 * through untouched, and any filter chosen here joins them, so a search within
 * a filter still narrows rather than widens.
 */
const SmartSearch = ({ placeholder = 'Search…', mandatory = [], alsoSearch = [], onSearch }) => {
  const [filters, setFilters] = useState([]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState({});
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    customFetch(`${baseURL}${window.location.pathname}/filters`, 'GET', null, false)
      .then((res) => {
        const raw = res?.response;
        setFilters(Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);
      })
      .catch(() => setFilters([]));
  }, []);

  // The box searches the fields that are free text; a dropdown or a date is not
  // something anyone types into a search box.
  const searchable = useMemo(
    () => filters.filter((f) => !f.options && f.data_type !== 'date' && f.data_type !== 'number'),
    [filters],
  );
  // Every text field of the page, plus the ones the page names itself, such as
  // the second student on a URF project.
  const searchFields = useMemo(
    () => [...searchable.map((f) => ({ key: f.key_name, label: f.label })), ...alsoSearch],
    [searchable, JSON.stringify(alsoSearch)],
  );

  const conditionsFrom = (picks) => Object.entries(picks)
    .filter(([, entry]) => entry.value !== '' && entry.value !== null && entry.value !== undefined)
    .map(([key, entry]) => ({ label: entry.label, key, op: entry.op, value: entry.value }));

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

  // Re-run when the page's own filters change, e.g. a tab.
  useEffect(() => { emit(text, chosen); }, [JSON.stringify(mandatory)]);

  const runSearch = () => emit(text, chosen);

  // Setting a filter fills it in; the search itself waits for Enter or Search,
  // so nothing runs half-typed. Clearing one searches at once, so the table
  // never keeps a filter that is no longer on screen.
  const choose = (filter, value, andSearch = false) => {
    const next = { ...chosen };
    if (value === '' || value === null || value === undefined) delete next[filter.key_name];
    else next[filter.key_name] = { label: filter.label, op: operatorFor(filter), value };
    setChosen(next);
    if (andSearch || value === '' || value === null || value === undefined) emit(text, next);
  };

  const clearAll = () => {
    setText('');
    setChosen({});
    emit('', {});
  };

  const control = (filter) => {
    const value = chosen[filter.key_name]?.value ?? '';
    if (filter.options) {
      return (
        <DropdownField
          label={filter.label}
          options={filter.options.map((o) => (typeof o === 'string' ? { title: o, value: o } : o))}
          initialValue={value}
          onChange={(v) => choose(filter, v, true)}
        />
      );
    }
    if (filter.api_url) {
      return (
        <InputSuggestions
          label={filter.label}
          apiUrl={baseURL + filter.api_url}
          initialValue={value}
          suggestionManadatory={false}
          onSelect={(picked) => choose(filter, picked?.name ?? '', true)}
        />
      );
    }
    return (
      <div className="input-field-container">
        <label className="input-label">{filter.label}</label>
        <input
          className="input-field"
          type={filter.data_type === 'date' ? 'date' : filter.data_type === 'number' ? 'number' : 'text'}
          value={value}
          placeholder={`Any ${filter.label.toLowerCase()}`}
          onChange={(e) => choose(filter, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
      </div>
    );
  };

  const chips = conditionsFrom(chosen);

  return (
    <div className="smart-search">
      <div className="smart-search-row">
        <span className="smart-search-icon"><i className="fa fa-search" aria-hidden="true"></i></span>
        <input
          className="smart-search-input"
          type="search"
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button type="button" className="smart-search-go" onClick={runSearch}>Search</button>
        {filters.length > 0 && (
          <button type="button" className="smart-search-toggle" onClick={() => setOpen(!open)}>
            <i className="fa fa-sliders" aria-hidden="true"></i> Filters{chips.length ? ` (${chips.length})` : ''}
          </button>
        )}
        {(text || chips.length > 0) && (
          <button type="button" className="smart-search-clear" onClick={clearAll}>Clear</button>
        )}
      </div>

      {open && (
        <div className="smart-search-fields">
          {filters.map((filter) => <div key={filter.key_name} className="smart-search-field">{control(filter)}</div>)}
        </div>
      )}

      {chips.length > 0 && (
        <div className="smart-search-chips">
          {chips.map((chip) => (
            <span key={chip.key} className="smart-search-chip">
              {chip.label}: {String(chip.value)}
              <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={() => choose({ key_name: chip.key }, '')}>&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartSearch;
