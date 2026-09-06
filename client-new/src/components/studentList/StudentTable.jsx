import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./StudentTable.css";
import StudentDetailsModal from "./StudentDetailsModal";


function StudentTable({ students }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYearGroup, setFilterYearGroup] = useState("");
  const [sortedColumn, setSortedColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const studentsPerPage = 3;
  const navigate = useNavigate();

  const handleSearch = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  const handleSort = (column) => {
    if (sortedColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortedColumn(column);
      setSortDirection("asc");
    }
  };

  const filteredStudents = students
    .filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return (
        fullName.includes(searchTerm) &&
        (filterYearGroup ? student.yearGroup === filterYearGroup : true)
      );
    })
    .sort((a, b) => {
      if (!sortedColumn) return 0;
      if (a[sortedColumn] < b[sortedColumn]) return sortDirection === "asc" ? -1 : 1;
      if (a[sortedColumn] > b[sortedColumn]) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const yearGroups = [...new Set(students.map((student) => student.yearGroup))];

  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const currentStudents = filteredStudents.slice(
    (currentPage - 1) * studentsPerPage,
    currentPage * studentsPerPage
  );

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleRowClick = (studentData) => {
    setSelectedStudent(studentData);
    setIsModalOpen(true);
  };

  return (
    <div className="student-table-container">
      <div className="table-header">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
        <select
          className="year-filter"
          value={filterYearGroup}
          onChange={(e) => setFilterYearGroup(e.target.value)}
        >
          <option value="">Status</option>
          {yearGroups.map((year, index) => (
            <option key={index} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <table className="student-table">
        <thead>
          <tr>
            <th onClick={() => handleSort("roll_no")}>Roll Number</th>
            <th onClick={() => handleSort("name")}>Name</th>
            <th onClick={() => handleSort("email")}>Email</th>
            <th onClick={() => handleSort("department")}>Department</th>
            <th onClick={() => handleSort("supervisors")}>Supervisors</th>
            <th onClick={() => handleSort("current_status")}>Current Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {currentStudents.map((student) => (
            <tr
              key={student.roll_no}
              className="form-row row-link"
              tabIndex={0}
              onClick={() => handleRowClick(student)}
              onKeyDown={(e) => e.key === "Enter" && handleRowClick(student)}
            >
              <td>{student.roll_no}</td>
              <td>{student.name}</td>
              <td>{student.email}</td>
              <td>{student.department}</td>
              <td>{student.supervisors?.join(", ")}</td>
              <td>{student.current_status}</td>
              <td className="row-go" title="Open student"><i className="fa fa-angle-right"></i></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>

      {/* Modal with student details */}
      {isModalOpen && selectedStudent && (
        <StudentDetailsModal
          formData={selectedStudent}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default StudentTable;
