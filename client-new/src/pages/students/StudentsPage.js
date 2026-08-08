import React, { useState } from "react";
import Layout from "../../components/dashboard/layout";
import { useLocation, useNavigate } from "react-router-dom";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import CustomModal from "../../components/forms/modal/CustomModal";
import StudentForm from "../../components/studentForm/StudentForm";
import CustomButton from "../../components/forms/fields/CustomButton";
import SupervisorDoctoralManager from "../../components/supervisorDoctoralManager/SupervisorDoctoralManager";
import BulkUploadStudents from "../../components/bulkUploadStudents/BulkUploadStudents";

const StudentsPage = () => {
  const [filter, setFilter] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const role = localStorage.getItem("userRole");
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isModalEditStudentOpen, setIsModalEditStudentOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const closeForm = () => {
    setIsModalOpen(false);
    setEditMode(false);
    setStudentToEdit(null);
  };

  const handleFormSuccess = () => {
    closeForm();
    setRefreshKey((k) => k + 1);
  };

  const handleOpenForm = (studentData = null) => {
    if (studentData) {
      setEditMode(true);
      setStudentToEdit(studentData);
    } else {
      setEditMode(false);
      setStudentToEdit(null);
    }
    setIsModalOpen(true);
  };

  return (
    <Layout
      children={
        <>
          <FilterBar onSearch={handleFilterChange} />

          {role === "admin" ? (
            <>
              <PagenationTable
                key={refreshKey}
                endpoint={location.pathname}
                filters={filter}
                enableApproval={false}
                extraTopbarComponents={
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <CustomButton
                      text="Bulk Upload"
                      variant="secondary"
                      onClick={() => setIsBulkUploadModalOpen(true)}
                    />
                    <CustomButton
                      text="Add Student +"
                      onClick={() => handleOpenForm()}
                    />
                  </div>
                }
                actions={[
                  {
                    icon: <i className="fa-solid fa-pen-to-square"></i>,
                    tooltip: "Edit",
                    onClick: (studentData) => {
                      handleOpenForm(studentData);
                    },
                  },
                  {
                    icon: <i className="fa-solid fa-users-gear"></i>,
                    tooltip: "Manage Supervisors/Doctoral",
                    onClick: (studentData) => {
                      setStudentToEdit(studentData);
                      setIsModalEditStudentOpen(true);
                    },
                  },
                  {
                    icon: <i className="fa-solid fa-file-lines"></i>,
                    tooltip: "Manage Forms",
                    onClick: (studentData) => {
                      navigate(`/forms/manage?roll_no=${studentData.roll_no}`);
                    },
                  },
                ]}
              />
            </>
          ) : role === "phd_coordinator" ||
            role === "hod" ||
            role === "dordc" ? (
            <>
              <PagenationTable
                endpoint={location.pathname}
                filters={filter}
                enableApproval={false}
                actions={[
                  {
                    icon: <i className="fa-solid fa-pen-to-square"></i>,
                    tooltip: "Edit",
                    onClick: (studentData) => {
                      setStudentToEdit(studentData);
                      setIsModalEditStudentOpen(true);
                    },
                  },
                ]}
              />
            </>
          ) : (
            <>
              <PagenationTable
                endpoint={location.pathname}
                filters={filter}
                enableApproval={false}
              />
            </>
          )}
          <CustomModal
            isOpen={isModalOpen}
            onClose={closeForm}
            setIsOpen={setIsModalOpen}
            title={editMode ? "Edit Student" : "Add Student"}
            width="80vw"
          >
            <StudentForm
              edit={editMode}
              studentData={studentToEdit}
              onClose={closeForm}
              onSuccess={handleFormSuccess}
            />
          </CustomModal>

          <CustomModal
            isOpen={isModalEditStudentOpen}
            onClose={() => {
              setIsModalEditStudentOpen(false);
            }}
            title={"Add Student Panel"}
          >
              {/* {role=== "admin" && <AssignPanel roll_no={studentToEdit?.roll_no}/>} */}
            {(role === "hod" ||
              role === "phd_coordinator" ||
              role === "dordc" ||
              role === "admin") && (
              <SupervisorDoctoralManager
                studentId={studentToEdit?.roll_no}
                supervisors={studentToEdit?.supervisors}
                doctoralCommittee={studentToEdit?.doctoral}
                onClose={() => {
                  setIsModalEditStudentOpen(false);
                }}
              />
            )}
          </CustomModal>

          <CustomModal
            isOpen={isBulkUploadModalOpen}
            onClose={() => {
              setIsBulkUploadModalOpen(false);
            }}
            title={"Bulk Upload Students"}
            width="90vw"
          >
            <BulkUploadStudents
              onSuccess={() => {
                setIsBulkUploadModalOpen(false);
                setRefreshKey((k) => k + 1);
              }}
            />
          </CustomModal>
        </>
      }
    />
  );
};

export default StudentsPage;
