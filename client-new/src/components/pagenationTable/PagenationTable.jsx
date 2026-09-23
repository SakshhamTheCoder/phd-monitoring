import React, { useEffect, useRef, useState } from "react";
import "./PagenationTable.css";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import { useLoading } from "../../context/LoadingContext";
import { toast } from "react-toastify";
import FileLink, { isFilePath } from "../common/FileLink";
import { EMPTY_VALUE } from "../../utils/timeParse";

const PagenationTable = ({
  endpoint,
  filters,
  enableApproval = false,
  customOpenForm, // function(id)
  rowClickable = true,
  linkField = null, // a column that opens something of its own, not the row
  onLinkClick = null, // what that column opens; the row still opens the row
  components = [], // [{ key, component }] to draw a cell itself, as TableComponent takes
  persistentSelect = false, // tick boxes on every row, with no mode to enter first
  inlineActions = false, // draw the row actions as buttons rather than behind a menu
  bulkActions = [], // [{ label, danger, onClick(ids, done) }] offered while selecting
  customBulkAction, // function(formIds)
  extraTopbarComponents = null,
  enableSelect=true,
  actions = [],
  num = null,
  tableTitle=""
}) => {
  const [forms, setForms] = useState([]);
  const [fields, setFields] = useState(["name", "roll_no"]);
  const [fieldsTitle, setFieldsTitle] = useState(["name", "roll_no"]);
  const [selectedForms, setSelectedForms] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [role, setRole] = useState("student");
  const [openMenu, setOpenMenu] = useState(null);
  // The table's own request, not the page-wide loader. That loader is one flag
  // shared by every request on the page, so it could already be off while this
  // table was still waiting, and the table said "No results yet." meanwhile.
  const [fetching, setFetching] = useState(true);

  const { setLoading } = useLoading();
  // Which request the table is waiting for. A filter changing while one is
  // still in flight leaves two answers coming back in whatever order the
  // network returns them, and the later answer is not always the newer one.
  // Only the newest request may write to the table.
  const latestRequest = useRef(0);

  // A different filter is a different result set: the page the user was on may
  // not exist in it ("Page 5 of 1"). Compared by value, since a caller may hand
  // over an equal object again. Adjusted during render so the fetch below
  // already asks for page 1.
  const filtersKey = JSON.stringify(filters ?? null);
  const [fetchedFiltersKey, setFetchedFiltersKey] = useState(filtersKey);
  if (filtersKey !== fetchedFiltersKey) {
    setFetchedFiltersKey(filtersKey);
    setCurrentPage(1);
  }

  const componentMap = components.reduce((all, one) => ({ ...all, [one.key]: one.component }), {});

  // The tick boxes can be on permanently. There is then no mode to enter, the
  // box itself does the ticking, and the row click still opens the row.
  const selecting = persistentSelect || selectMode;
  const allSelected = forms.length > 0 && selectedForms.size === forms.length;
  const toggleAll = () => setSelectedForms(allSelected ? new Set() : new Set(forms.map((form) => form.id)));

  // Close the open row-actions menu on any outside click
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const fetchData = async (page = 1, rows = rowsPerPage, filters = null) => {
    const request = (latestRequest.current += 1);
    const isCurrent = () => latestRequest.current === request;

    setLoading(true);
    setFetching(true);
    let url = `${baseURL}${endpoint}?page=${page}&rows=${rows}`;
    if (filters) {
      const filterStr = encodeURIComponent(JSON.stringify(filters));
      url += `&filters=${filterStr}`;
    }

    try {
      const data = await customFetch(url, "GET");
      if (data?.success && isCurrent()) {
        setFields(data.response.fields || []);
        setFieldsTitle(data.response.fieldsTitles || []);
        setForms(data.response.data || []);
        const pageCount = data.response.totalPages || 1;
        setTotalPages(pageCount);
        // Approving rows can empty the last page; step back to one that exists.
        if (page > pageCount) setCurrentPage(pageCount);
        setRole(data.response.role || "student");
      }
    } catch (err) {
      console.error(err);
    } finally {
      // A newer request is still running; it clears these when it lands.
      if (isCurrent()) {
        setLoading(false);
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    // Ticked rows that leave the screen must not ride along into a bulk action.
    setSelectedForms(new Set());
    fetchData(currentPage, rowsPerPage, filters);
  }, [endpoint, currentPage, rowsPerPage, filters,num]);

  const toggleSelectOne = (id) => {
    setSelectedForms((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  // FilterBar hands back { combine, conditions, mandatory_filter } and pages
  // start from an empty array, so the object itself is always truthy. Only a
  // condition the user actually added means the list was filtered.
  const hasFilters = Array.isArray(filters)
    ? filters.length > 0
    : (filters?.conditions?.length ?? 0) > 0;

  // The fallback treats `endpoint` as a client route, which it only is when the
  // caller passed location.pathname, as the form and presentation lists do. A
  // caller that passes an API path ("/courses/list") must set rowClickable to
  // false or pass customOpenForm, or every row opens a dead tab.
  const openForm = (form) => {
    if (customOpenForm) customOpenForm(form);
    else window.open(`${endpoint}/${form.id}`, "_blank");
  };

  const handleApproval = async () => {
    const selectedIds = Array.from(selectedForms);
    setLoading(true);

    if (customBulkAction) {
      await customBulkAction(selectedIds);
      fetchData(currentPage, rowsPerPage, filters);
      setLoading(false);
      return;
    }

    const url = `${baseURL}${endpoint}/bulk`;
    customFetch(url, "POST", { form_ids: selectedIds,approval:true })
      .then((data) => {
        if (data.success) {
          toast.success("Selected forms approved successfully.");
          setSelectedForms(new Set());
          fetchData(currentPage, rowsPerPage, filters);
        } else {
          toast.error("Failed to approve selected forms.");
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error("An error occurred while approving forms.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      {(role !== "student" || extraTopbarComponents) && (
        <div className="table-toolbar">
            {tableTitle && <h3>{tableTitle}</h3>}
          <div className="top-actions">
          {extraTopbarComponents && (
               <div className="extra-components">{extraTopbarComponents}</div> )}
               {enableSelect && persistentSelect && (
            <button className="select-btn" onClick={toggleAll}>
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            )}
               {enableSelect && !persistentSelect && (enableApproval || customBulkAction || bulkActions.length > 0) && (
            <button className="select-btn" onClick={() => {
              setSelectMode(!selectMode);
              setSelectedForms(new Set());
            }}>

              {selectMode ? "Deselect All" : "Select"}
            </button>
            )}
            {selectMode && enableApproval && (
              <button className="approve-btn" onClick={handleApproval}>
                Approve Selected Rows: {selectedForms.size}
              </button>
            )}
            {/* One button per bulk action, offered once something is ticked. */}
            {selecting && selectedForms.size > 0 && bulkActions.map((action, actionIndex) => (
              <button
                key={actionIndex}
                className={`bulk-action-btn${action.danger ? " danger" : ""}`}
                disabled={selectedForms.size === 0}
                onClick={() => action.onClick(
                  Array.from(selectedForms),
                  () => { setSelectedForms(new Set()); setSelectMode(false); },
                  forms.filter((row) => selectedForms.has(row.id)),
                )}
              >
                {action.label} ({selectedForms.size})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-list-container">
      <table className="form-table form-table--tint">
        <thead>
          <tr>
            {selecting && <th><input
              type="checkbox"
              aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
              checked={allSelected}
              onChange={toggleAll}
            /></th>}
            <th>S.No</th>
            {fieldsTitle.map((title, index) => <th key={index}>{title}</th>)}
            {actions.length > 0 && <th>Actions</th>}
            {rowClickable && !selectMode && <th></th>}
          </tr>
        </thead>

        <tbody>
        {forms.length === 0 && (
  <tr className="no-data-row">
    {/* S.No, the fields, and whichever of the tick box, actions and chevron
        columns this table is drawing. The chevron column exists only where a row
        opens something, so it is counted on the same condition that draws it. */}
    <td
      colSpan={fields.length + 1 + (selecting ? 1 : 0) + (actions.length > 0 ? 1 : 0) + (rowClickable && !selectMode ? 1 : 0)}
      className="no-data-cell"
    >
      {fetching ? "Loading…" : hasFilters ? "No results match your filters." : "No results yet."}
    </td>
  </tr>
)}
   {forms.map((form, index) => {
            const formId = form.id || form.id;
            const clickable = rowClickable || selectMode;
            return (
              <tr
                key={formId}
                className={`form-row ${clickable ? "row-link" : ""} ${selecting && selectedForms.has(formId) ? "selected-row" : ""}`}
                tabIndex={clickable ? 0 : -1}
                onClick={clickable ? () => selectMode ? toggleSelectOne(formId) : openForm(form) : undefined}
                onKeyDown={clickable ? (e) => e.key === "Enter" && (selectMode ? toggleSelectOne(formId) : openForm(form)) : undefined}
              >
                {selecting && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={selectedForms.has(formId)}
                      onChange={() => toggleSelectOne(formId)}
                      // The row opens the row; ticking it must not do that too.
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>
                {fields.map((field, idx) => {
                  const val = form[field];
                  // Progress monitoring is a percentage everywhere else it is
                  // shown, so a bare number here reads as a count of something.
                  const shown = field === 'overall_progress' && val != null ? `${val}%` : val;
                  const Custom = componentMap[field];
                  const content = Custom
                    ? <Custom row={form} data={val} />
                    : isFilePath(val) ? <FileLink value={val} /> : (shown ?? EMPTY_VALUE);

                  return (
                    // The field name rides along as a class so a page can style
                    // one of its own columns.
                    <td key={idx} className={`cell-${field}`}>
                      {linkField === field && !selectMode ? (
                        <button
                          type="button"
                          className="cell-link"
                          onClick={(e) => { e.stopPropagation(); (onLinkClick || openForm)(form); }}
                          // Enter on the button activates it; without this the
                          // same keypress also reaches the row and opens both.
                          onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
                        >
                          {content}
                        </button>
                      ) : content}
                    </td>
                  );
                })}
                {actions.length > 0 && (
                  <td>
                    {/* An action may name the rows it applies to, so a decided
                        row is not offered a decision again. */}
                    {(() => {
                      const rowActions = actions.filter((action) => !action.show || action.show(form));

                      if (rowActions.length === 0) return null;

                      if (inlineActions) {
                        return (
                          <div className="row-actions-inline">
                            {rowActions.map((action, actionIndex) => (
                              <button
                                key={actionIndex}
                                className={`row-action-btn${action.danger ? " danger" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(form);
                                }}
                              >
                                {action.icon}
                                {action.tooltip && <span>{action.tooltip}</span>}
                              </button>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <div className="row-actions">
                          <button
                            className="row-actions-trigger"
                            title="Actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(openMenu === index ? null : index);
                            }}
                          >
                            <i className="fa fa-ellipsis-v"></i>
                          </button>
                          {openMenu === index && (
                            <div className="row-actions-menu" onClick={(e) => e.stopPropagation()}>
                              {rowActions.map((action, actionIndex) => {
                                const danger = action.danger || /delete|remove/i.test(action.tooltip || "");
                                return (
                                  <button
                                    key={actionIndex}
                                    className={`row-actions-item${danger ? " danger" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenu(null);
                                      action.onClick(form);
                                    }}
                                  >
                                    <span className="ra-icon">{action.icon}</span>
                                    <span>{action.tooltip || "Action"}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                )}
                {rowClickable && !selectMode && (
                  <td className="row-go" title="Open"><i className="fa fa-angle-right"></i></td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="table-bottom table-bottom--paged">
        <label className="rows-per-page">
          Rows per page:
          <select value={rowsPerPage} onChange={(e) => {
            setRowsPerPage(parseInt(e.target.value));
            setCurrentPage(1);
          }}>
            {[1, 5, 10, 20, 50, 100].map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </label>

        <div className="pagination">
          <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default PagenationTable;
