import React, { useEffect, useMemo, useState } from 'react';
import Panel from '../panel/Panel';
import StatusNotice from '../common/StatusNotice';
import LoadError from '../common/LoadError';
import FilterBar from '../filterBar/FilterBar';
import CustomButton from '../forms/fields/CustomButton';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import { useRowMenu } from '../../hooks/useRowMenu';
import './LocalTable.css';

/**
 * A small list read whole (a page view's table of kind 'local'): either with
 * a search head drawn as PagenationTable draws its own, filtered in the
 * browser (the clerks), or in a titled panel with a way to read it again (a
 * queue of changes to approve).
 *
 * Filtering follows the server's rules: a field given two values widens
 * (either matches), two fields narrow each other, and the search box sends one
 * value across every field at once, which is an OR. A filter key the view maps
 * to a list on the row (a clerk's departments) matches when any entry does.
 */
const LocalTable = ({ table, refreshKey, onRowAction }) => {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState({ conditions: [] });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // The row a request is in flight for; its buttons stay off until it answers.
  const [busyId, setBusyId] = useState(null);
  const { openMenu, shownMenu, menuClosing, menuStyle, toggleMenu, closeMenu } = useRowMenu();
  const prefix = table.class_prefix;

  const load = async () => {
    setLoading(true);
    const res = await customFetch(baseURL + table.endpoint, 'GET', {}, !table.quiet, false);
    setLoading(false);
    setLoadFailed(!res.success);
    if (res.success) setRows(res.response.data || []);
  };

  useEffect(() => {
    load();
    // Read again when the page says its rows changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const shown = useMemo(() => {
    const conditions = filter.conditions || [];
    const mandatory = filter.mandatory_filter || [];
    if (conditions.length === 0 && mandatory.length === 0) return rows;

    const valuesOf = (row, key) => {
      const list = table.lists?.[key];
      return list ? (row[list.list] || []).map((entry) => entry[list.key] ?? '') : [row[key] ?? ''];
    };

    const matches = (row, condition) => {
      const wanted = String(condition.value ?? '').toLowerCase();
      if (!wanted) return true;
      return valuesOf(row, condition.key).some((held) => {
        const value = String(held).toLowerCase();
        return condition.op === '=' ? value === wanted : value.includes(wanted);
      });
    };

    const groupedByKey = (list) => Object.values(list.reduce((all, condition) => {
      (all[condition.key] = all[condition.key] || []).push(condition);
      return all;
    }, {}));

    return rows.filter((row) => {
      if (!mandatory.every((condition) => matches(row, condition))) return false;
      if (conditions.length === 0) return true;
      return filter.combine === 'or'
        ? conditions.some((condition) => matches(row, condition))
        : groupedByKey(conditions).every((group) => group.some((condition) => matches(row, condition)));
    });
  }, [rows, filter, table.lists]);

  const cell = (row, column) => {
    if (column.list_of) {
      const list = row[column.key] || [];
      return list.length === 0
        ? <span className={`${prefix}-none`}>{EMPTY_VALUE}</span>
        : list.map((entry) => entry[column.list_of]).join(', ');
    }
    if (column.format === 'date') return formatDate(row[column.key]);
    return column.empty !== undefined ? row[column.key] || column.empty : row[column.key];
  };

  const act = async (action, row) => {
    if (action.request) setBusyId(row.id);
    try {
      await onRowAction(action, row);
    } finally {
      if (action.request) setBusyId(null);
    }
  };

  // The row's actions as buttons of their own, or behind a menu.
  const actionsFor = (row, index) => (table.inline ? (
    <div className="row-actions-inline">
      {table.actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={`row-action-btn${action.danger ? ' danger' : ''}`}
          onClick={() => act(action, row)}
          disabled={busyId === row.id}
        >
          {action.label}
        </button>
      ))}
    </div>
  ) : (
    <div className="row-actions">
      <button
        className="row-actions-trigger"
        title="Actions"
        aria-expanded={openMenu === index}
        onClick={(e) => toggleMenu(index, e)}
      >
        <i className="fa fa-ellipsis-v"></i>
      </button>
      {shownMenu === index && (
        <div className={`row-actions-menu${menuClosing ? ' is-closing' : ''}`} style={menuStyle} onClick={(e) => e.stopPropagation()}>
          {table.actions.map((action) => (
            <button
              key={action.label}
              className="row-actions-item"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                act(action, row);
              }}
            >
              <span className="ra-icon">
                <i className={action.icon}></i>
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  ));

  // A state drawn in its own padded box where the list has a search head.
  const state = (content) => (prefix ? <div className={`${prefix}-state`}>{content}</div> : content);

  const body = loading ? (
    state(<StatusNotice tone="loading" title={table.loading} />)
  ) : loadFailed ? (
    state(<LoadError message={table.failed} onRetry={load} />)
  ) : shown.length === 0 ? (
    state(table.empty_title
      ? <StatusNotice tone="empty" title={table.empty_title} />
      : <StatusNotice tone="empty">{rows.length === 0 ? table.empty : table.no_match}</StatusNotice>)
  ) : (
    <div className="data-table-wrap reveal">
      <table className="data-table">
        <thead>
          <tr>
            <th>S.No</th>
            {table.columns.map((column) => <th key={column.key}>{column.title}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={table.panel ? index : row.id} className={table.panel ? undefined : 'form-row'}>
              <td>{index + 1}</td>
              {table.columns.map((column) => <td key={column.key}>{cell(row, column)}</td>)}
              <td>{actionsFor(row, index)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (table.panel) {
    return (
      <Panel
        title={table.panel.title}
        flush={!loading && !loadFailed && rows.length > 0}
        actions={<CustomButton text={table.panel.refresh} variant="quiet" size="sm" onClick={load} />}
      >
        {body}
      </Panel>
    );
  }

  return (
    <Panel flush>
      <div className="panel-head">
        <div className={`table-search ${prefix}-search`}>
          <FilterBar path={table.search.path} onSearch={(next) => setFilter(next || { conditions: [] })} />
        </div>
      </div>
      {body}
    </Panel>
  );
};

export default LocalTable;
