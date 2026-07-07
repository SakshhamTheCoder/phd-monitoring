import React, { useEffect, useState } from "react";
import "./FormList.css";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import { useLoading } from "../../context/LoadingContext";
import { toast } from "react-toastify";
import FileLink, { isFilePath } from "../common/FileLink";

const PagenationTable = ({
  endpoint,
  filters,
  enableApproval = false,
  customOpenForm, // function(id)
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

  const { setLoading } = useLoading();

  const fetchData = async (page = 1, rows = rowsPerPage, filters = null) => {
    setLoading(true);
    let url = `${baseURL}${endpoint}?page=${page}&rows=${rows}`;
    if (filters) {
      const filterStr = encodeURIComponent(JSON.stringify(filters));
      url += `&filters=${filterStr}`;
    }

    try {
      const data = await customFetch(url, "GET");
      if (data?.success) {
        setFields(data.response.fields || []);
        setFieldsTitle(data.response.fieldsTitles || []);
        setForms(data.response.data || []);
        setTotalPages(data.response.totalPages || 1);
        setRole(data.response.role || "student");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("Fetching data for page:", currentPage, "with filters:", filters);
    fetchData(currentPage, rowsPerPage, filters);
  }, [endpoint, currentPage, rowsPerPage, filters,num]);

  const toggleSelectOne = (id) => {
    setSelectedForms((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const openForm = (form) => {
    if (customOpenForm) customOpenForm(form);
    else window.open(`${endpoint}/${form.id}`, "_blank");
  };

  const handleApproval = async () => {
    const selectedIds = Array.from(selectedForms);
    setLoading(true);

    if (customBulkAction) {
      await customBulkAction(selectedIds);
      fetchData(currentPage, rowsPerPage);
      setLoading(false);
      return;
    }

    const url = `${baseURL}${endpoint}/bulk`;
    customFetch(url, "POST", { form_ids: selectedIds,approval:true })
      .then((data) => {
        if (data.success) {
          toast.success("Selected forms approved successfully.");
          fetchData(currentPage, rowsPerPage);
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
    <div className="form-list-container">
      {role !== "student" && (
        <div className="form-topbar">
            <h3>{tableTitle}</h3>
          <div className="top-actions">
          {extraTopbarComponents && (
               <div className="extra-components">{extraTopbarComponents}</div> )}
               {enableSelect && (
            <button className="select-btn" onClick={() => {
              setSelectMode(!selectMode);
              if (!selectMode) setSelectedForms(new Set());
            }}>
              
              {selectMode ? "Deselect All" : "Select"}
            </button>
            )}
            {selectMode && enableApproval && (
              <button className="approve-btn" onClick={handleApproval}>
                Approve Selected Rows: {selectedForms.size}
              </button>
            )}
          </div>
        </div>
      )}

      <table className="form-table">
        <thead>
          <tr>
            {selectMode && <th><input
              type="checkbox"
              checked={selectedForms.size === forms.length && forms.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedForms(new Set(forms.map(f => f.id || f.id)));
                } else setSelectedForms(new Set());
              }}
            /></th>}
            <th>S.No</th>
            {fieldsTitle.map((title, index) => <th key={index}>{title}</th>)}
            {role === "admin" && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
        {forms.length === 0 && (
  <tr className="no-data-row">
    <td colSpan={fields.length + 2} className="no-data-cell">
      No Data to Display
    </td>
  </tr>
)}
   {forms.map((form, index) => {
            const formId = form.id || form.id;
            return (
              <tr
                key={formId}
                className={`form-row ${selectedForms.has(formId) ? "selected-row" : ""}`}
                onClick={() => selectMode ? toggleSelectOne(formId) : openForm(form)}
              >
                {selectMode && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedForms.has(formId)}
                      onChange={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td>{index + 1}</td>
                {fields.map((field, idx) => {
                  const val = form[field];
                  return (
                    <td key={idx}>
                      {isFilePath(val) ? <FileLink value={val} /> : (val ?? "N/A")}
                    </td>
                  );
                })}
                {role === "admin" && (
                  <>
                 {actions.length > 0 && (
                  <div className="action-icons">
                    {actions.map((action, index) => (
                      <button
                      key={index}
                      className="action-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(form);
                      }}
                      title={action.tooltip || ""}
                      style={{ marginLeft: "8px" }}
                    >
                      {action.icon}
                    </button>
                    ))}
                  </div>
                )}
                </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="table-bottom">
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
  );
};

export default PagenationTable;
