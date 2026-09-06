import React, { useState } from "react";
import Layout from "../../components/dashboard/layout";
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLocation, useNavigate } from "react-router-dom";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import CustomModal from "../../components/forms/modal/CustomModal";
import StudentForm from "../../components/studentForm/StudentForm";
import CustomButton from "../../components/forms/fields/CustomButton";
import SupervisorDoctoralManager from "../../components/supervisorDoctoralManager/SupervisorDoctoralManager";
import UnifiedBulkImportModal from "../../components/bulkImport/UnifiedBulkImportModal";
import { toast } from "react-toastify";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";

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
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const studentsSampleCsv = `First Name,Last Name,Email,Phone,Roll Number,Department Code,Date of Registration (YYYY-MM-DD),Date of IRB (YYYY-MM-DD),PhD Title,Father's Name,Address,Current Status,CGPA,Overall Progress
John,Doe,john.doe@example.com,+1234567890,PHD2024001,CSED,2024-01-15,2024-03-20,Machine Learning Applications in Healthcare,Michael Doe,"123 Main Street, City",full-time,3.85,25.5`;

  const handleBulkImport = async (csvPreview, resetState) => {
    try {
      setSubmitting(true);

      const BATCH_SIZE = 50;
      const totalRows = csvPreview.data.length;
      const batches = [];
      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        batches.push(csvPreview.data.slice(i, i + BATCH_SIZE));
      }

      let totalSuccess = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let allErrors = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        setUploadProgress({
          current: (batchIndex + 1) * BATCH_SIZE > totalRows ? totalRows : (batchIndex + 1) * BATCH_SIZE,
          total: totalRows,
          percentage: Math.round(((batchIndex + 1) / batches.length) * 100)
        });

        const students = batch.map(r => ({
          first_name: r['First Name'],
          last_name: r['Last Name'] || '',
          email: r['Email'],
          phone: r['Phone'],
          roll_no: r['Roll Number'],
          department_code: r['Department Code'],
          date_of_registration: r['Date of Registration (YYYY-MM-DD)'],
          date_of_irb: r['Date of IRB (YYYY-MM-DD)'] || null,
          phd_title: r['PhD Title'] || null,
          fathers_name: r["Father's Name"] || null,
          address: r['Address'] || null,
          current_status: r['Current Status'],
          cgpa: r['CGPA'] || null,
          overall_progress: r['Overall Progress'] || 0
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          const res = await customFetch(baseURL + '/students/bulk-upload', 'POST', { students }, true);
          if (res.success) {
            const d = res.response.data || {};
            totalSuccess += d.success_count ?? res.response.successful ?? 0;
            totalUpdated += d.update_count ?? 0;
            totalErrors += d.error_count ?? res.response.failed ?? 0;
            allErrors = allErrors.concat(d.errors || res.response.errors || []);
            batchSuccess = true;
          } else if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            toast.error(`Batch ${batchIndex + 1} failed`);
            totalErrors += batch.length;
          }
        }
      }

      toast.success(`Import completed: ${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors`);
      if (allErrors.length > 0) {
        console.log('Import errors:', allErrors);
        toast.warning(`${totalErrors} rows failed. Check console for details.`);
      }

      setIsBulkUploadModalOpen(false);
      resetState?.();
      setUploadProgress(null);
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import CSV');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

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
          <PageHeader title="Students" subtitle="All PhD scholars and their current stage." />
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
                      text="Bulk Import"
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

          <UnifiedBulkImportModal
            isOpen={isBulkUploadModalOpen}
            onClose={() => { setIsBulkUploadModalOpen(false); }}
            title="Bulk Import Students"
            formatString="First Name,Last Name,Email,Phone,Roll Number,Department Code,Date of Registration (YYYY-MM-DD),Date of IRB (YYYY-MM-DD),PhD Title,Father's Name,Address,Current Status,CGPA,Overall Progress"
            infoNodes={
              <>
                <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Required for new students:</strong> First Name, Email, Phone, Roll Number, Department Code, Date of Registration, Current Status
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Optional:</strong> Last Name, Date of IRB, PhD Title, Father's Name, Address, CGPA, Overall Progress
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Current Status:</strong> part-time, full-time, executive
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Existing students matched by email or roll number will be updated with provided non-empty fields.
                </p>
              </>
            }
            sampleFileName="students_bulk_import_sample.csv"
            sampleCsvContent={studentsSampleCsv}
            onImport={handleBulkImport}
            submitting={submitting}
            uploadProgress={uploadProgress}
          />
        </>
      }
    />
  );
};

export default StudentsPage;
