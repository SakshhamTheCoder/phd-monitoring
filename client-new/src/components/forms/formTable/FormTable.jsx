import React, { useEffect, useState } from "react";
import "./FormList.css";
import { useLocation } from "react-router-dom";
import { baseURL } from "../../../api/urls";
import { customFetch } from "../../../api/base";
import { useLoading } from "../../../context/LoadingContext";
import GridContainer from "../fields/GridContainer";
import { toast } from "react-toastify";

const FormTable = ({ filters }) => {
  const [forms, setForms] = useState([]);
  const [fields, setFields] = useState(["name", "roll_no"]);
  const [fieldsTitle, setFieldsTitle] = useState(["name", "roll_no"]);
  const [selectedForms, setSelectedForms] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selectMode, setSelectMode] = useState(false);

  const { setLoading } = useLoading();
  const location = useLocation();
  const [role, setRole] = useState("student");

  const fetchData = async (page = 1, rows = rowsPerPage, filters = null) => {
    setLoading(true);

    let url = `${baseURL}${location.pathname}?page=${page}&rows=${rows}`;

    if (filters) {
      const filterStr = encodeURIComponent(JSON.stringify(filters));
      url += `&filters=${filterStr}`;
    }

    try {
      const data = await customFetch(url, "GET");
      if (data && data.success) {
        setFields(data.response.fields || []);
        setFieldsTitle(data.response.fieldsTitles || []);
        setForms(data.response.forms || []);
        setTotalPages(data.response.totalPages || 1);
        setRole(data.response.role || "student");
      
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, rowsPerPage, filters);
  }, [location.pathname, currentPage, rowsPerPage, filters]);

  const toggleSelectOne = (id) => {
    setSelectedForms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const changePage = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRowsChange = (e) => {
    const value = parseInt(e.target.value);
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleSelectToggle = () => {
    setSelectMode(!selectMode);
    if (!selectMode) setSelectedForms(new Set());
  };
  const openForm = (id) => {
    let link = `${location.pathname}/${id}`;
    window.open(link, "_blank");
  };
  const handleApproval = () => {
    setLoading(true);
    console.log("Selected Forms:", selectedForms);
    const selectedIds = Array.from(selectedForms);
    console.log("Selected IDs:", selectedIds);
    const url = `${baseURL}${location.pathname}/bulk`;
    customFetch(url, "POST", { form_ids: selectedIds })
      .then((data) => {
        if (data && data.success) {
          toast.success("Selected forms approved successfully.");
          fetchData(currentPage, rowsPerPage);
          setLoading(false);
        } else {
          toast.error("Failed to approve selected forms.");
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error(error);
        alert("An error occurred while approving forms.");
      });
  };

  return (
    <div className="form-list-container">
      <GridContainer
  elements={[
    <div className="form-actions-wrapper">
      <div className="form-actions-left">
        <button onClick={handleSelectToggle}>
          {selectMode ? " Deselect" : " Select"}
        </button>
      </div>

      <div className="form-actions-right">
        {selectMode && (
          <button onClick={handleApproval}>
            Approve Selected rows ({selectedForms.size})
          </button>
        )}
      </div>
    </div>,
    <></>,
  ]}
/>


      

      <table className="form-table">
        <thead>
          <tr>
            {selectMode && (
              <th>
                <input
                  type="checkbox"
                  checked={
                    selectedForms.size === forms.length && forms.length > 0
                  }
                  onChange={(e) => {
                    e.stopPropagation(); 

                    if (e.target.checked) {
                      const allFormIds = new Set(
                        forms.map((form) => form.id || form.form_id)
                      );
                      setSelectedForms(allFormIds);
                    } else {
                      setSelectedForms(new Set());
                    }
                  }}
                />
              </th>
            )}
            <th>S.No</th>
            {fieldsTitle.map((title, index) => (
              <th key={index}>{title}</th>
            ))}
            {role==='admin' && (
                 <th>Actions</th>
            )}
            {!selectMode && <th></th>}
         
          </tr>
        </thead>

        <tbody>
          {forms.map((form,index) => (
         
            <tr
              key={form.id || form.form_id}
              className={`form-row row-link ${
                selectedForms.has(form.id || form.form_id) ? "selected-row" : ""
              }`}
              tabIndex={0}
              onClick={() =>
                selectMode
                  ? toggleSelectOne(form.id || form.form_id)
                  : openForm(form.id || form.form_id)
              }
              onKeyDown={(e) =>
                e.key === "Enter" &&
                (selectMode
                  ? toggleSelectOne(form.id || form.form_id)
                  : openForm(form.id || form.form_id))
              }
            >
              <td>{index + 1}</td>
              {selectMode && (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedForms.has(form.id || form.form_id)}
                    onChange={(e) => {
                      e.stopPropagation(); // Prevent row click event
                      // toggleSelectOne(form.id || form.form_id);
                    }}
                  />
                </td>
              )}

              {fields.map((field, index) => (
                <td key={index}>{form[field] == null ? "N/A" : form[field]}</td>
              ))}
              {role==='admin' && (
                <td>
                  <button
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent row click event
                      openForm(form.id || form.form_id);
                    }}
                  >
                    Edit
                  </button>
                  </td>
              )}
              {!selectMode && (
                <td className="row-go" title="Open form"><i className="fa fa-angle-right"></i></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-bottom">
        <label className="rows-per-page">
          Rows per page:
          <select value={rowsPerPage} onChange={handleRowsChange}>
            {[1, 5, 10, 20, 50, 100].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <div className="pagination">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormTable;
