import React, { useEffect, useMemo, useState } from 'react';
import Panel from '../panel/Panel';
import StatusNotice from '../common/StatusNotice';
import LoadError from '../common/LoadError';
import FilterBar from '../filterBar/FilterBar';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { EMPTY_VALUE } from '../../utils/timeParse';
import { useRowMenu } from '../../hooks/useRowMenu';
import './LocalTable.css';

/**
 * A small list read whole and filtered in the browser (a page view's table of
 * kind 'local'), drawn as the head PagenationTable gives its search so it reads
 * the same as the server-paged ones.
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
  const { openMenu, shownMenu, menuClosing, menuStyle, toggleMenu, closeMenu } = useRowMenu();
  const prefix = table.class_prefix;

  const load = async () => {
    setLoading(true);
    const res = await customFetch(baseURL + table.endpoint, 'GET', {}, true);
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
    return row[column.key];
  };

  return (
    <Panel flush>
      <div className="panel-head">
        <div className={`table-search ${prefix}-search`}>
          <FilterBar path={table.search.path} onSearch={(next) => setFilter(next || { conditions: [] })} />
        </div>
      </div>

      {loading ? (
        <div className={`${prefix}-state`}><StatusNotice tone="loading" title={table.loading} /></div>
      ) : loadFailed ? (
        <div className={`${prefix}-state`}>
          <LoadError message={table.failed} onRetry={load} />
        </div>
      ) : shown.length === 0 ? (
        <div className={`${prefix}-state`}>
          <StatusNotice tone="empty">{rows.length === 0 ? table.empty : table.no_match}</StatusNotice>
        </div>
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
                <tr key={row.id} className="form-row">
                  <td>{index + 1}</td>
                  {table.columns.map((column) => <td key={column.key}>{cell(row, column)}</td>)}
                  <td>
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
                                onRowAction(action, row);
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

export default LocalTable;
