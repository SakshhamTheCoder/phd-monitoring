import React from "react";
import "./FacultyProfile.css";
import { useNavigate } from "react-router-dom";

const FacultyProfile = ({ faculty }) => {
  const navigate = useNavigate();

  if (!faculty) {
    return (
      <div className="faculty-container">
        <h3 style={{ fontSize: "1.2rem", color: "#1f2937", margin: 0 }}>No faculty profile</h3>
        <p className="faculty-sub" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          There's no faculty record linked to this account. Use the menu to open the section you need.
        </p>
      </div>
    );
  }

  return (
    <div className="faculty-container">
      <h2>{faculty.faculty_name}</h2>
      <p className="faculty-sub">
        {faculty.designation}, {faculty.department}
      </p>

      <div className="faculty-info-grid">
        <div><strong>Email:</strong> {faculty.email}</div>
        <div><strong>Phone:</strong> {faculty.phone || "N/A"}</div>
        <div><strong>Faculty Code:</strong> {faculty.faculty_code}</div>
        <div><strong>Supervised (Within TIET):</strong> {faculty.supervised_campus ?? 0}</div>
        <div><strong>Supervised (Outside TIET):</strong> {faculty.supervised_outside ?? 0}</div>
      </div>

      {/* Supervising Students */}
      <div className="faculty-table-section">
        <h3>Supervising Students</h3>
        {faculty.supervised_students?.length === 0 ? (
          <p className="empty-msg">No students currently being supervised.</p>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Date of Admission</th>
                </tr>
              </thead>
              <tbody>
                {faculty.supervised_students?.map((student, idx) => (
                  <tr
                    key={idx}
                    onClick={() => navigate(`/students/${student.roll_no}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="col-tight">{idx + 1}</td>
                    <td>{student.name}</td>
                    <td className="col-tight">{student.roll_no}</td>
                    <td>{student.email}</td>
                    <td className="col-tight">{student.phone}</td>
                    <td className="col-tight">{student.date_of_admission || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Doctoral Committee */}
      <div className="faculty-table-section">
        <h3>Doctoral Committee Membership</h3>
        {faculty.doctoral_committee_students?.length === 0 ? (
          <p className="empty-msg">Not a member of any doctoral committee.</p>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Department</th>
                  <th>Date of Admission</th>
                </tr>
              </thead>
              <tbody>
                {faculty.doctoral_committee_students?.map((student, idx) => (
                  <tr
                    key={idx}
                    onClick={() => navigate(`/students/${student.roll_no}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="col-tight">{idx + 1}</td>
                    <td>{student.name}</td>
                    <td className="col-tight">{student.roll_no}</td>
                    <td>{student.email}</td>
                    <td className="col-tight">{student.phone}</td>
                    <td className="col-tight">{student.department || "N/A"}</td>
                    <td className="col-tight">{student.date_of_admission || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyProfile;
