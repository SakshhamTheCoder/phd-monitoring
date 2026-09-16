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
import { column } from "../../components/bulkImport/columns";
import { toast } from "react-toastify";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import useCapabilities from "../../hooks/useCapabilities";
import Tabs from "../../components/tabs/Tabs";
import UgStudentForm from "../../components/urf/UgStudentForm";
import { apiUgStudentImport } from "../../api/urf";

const StudentsPage = () => {
  const [filter, setFilter] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const can = useCapabilities();
  // Manage Forms has no capability of its own yet, so it keeps the role
  // check it always had rather than borrowing an unrelated capability.
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
  // The two lists are read from different places.
  const [tab, setTab] = useState('phd');
  const [ugFilter, setUgFilter] = useState({ conditions: [] });
  const [ugStudent, setUgStudent] = useState(null);
  const [ugFormOpen, setUgFormOpen] = useState(false);
  const [ugImportOpen, setUgImportOpen] = useState(false);
  const [ugRefreshKey, setUgRefreshKey] = useState(0);

  const UG_SAMPLE_CSV = `full_name,email,roll_no,programme,branch_code,year,phone,gender
Nikhil Verma,nverma_be23@thapar.edu,102303001,BE,COE,2,9876500000,Male
Aarti Singh,asingh_btech22@thapar.edu,102203002,BTech,CSE,3,9876500001,Female`;

  const importUgStudents = async (preview, reset) => {
    setSubmitting(true);
    const res = await apiUgStudentImport(preview.data);
    setSubmitting(false);

    if (!res.success) {
      toast.error(res.response?.message || 'Could not import the students.');
      return;
    }

    const { added = 0, updated = 0, errors = [] } = res.response || {};
    toast.success(`${added} students added, ${updated} updated`);
    errors.forEach((message) => toast.warn(message, { autoClose: 10000 }));
    reset();
    setUgImportOpen(false);
    setUgRefreshKey((k) => k + 1);
  };

  const STUDENT_HEADERS = "Registration Number,Full Name,Email,Phone,Department Code,Father Name,Gender,Enrollment Type,Date of Admission,Date of IRB,Date of Synopsis,Date of Thesis,CGPA,Overall Progress,PhD Title,JRF?,Permanent Address,Supervisor 1 Name,Supervisor 1 Email,Supervisor 2 Name,Supervisor 2 Email,Supervisor 3 Name,Supervisor 3 Email,Committee Member 1 Name,Committee Member 1 Email,Committee Member 2 Name,Committee Member 2 Email,Committee Member 3 Name,Committee Member 3 Email";

  const studentsSampleCsv = `${STUDENT_HEADERS}
900011,Scholar One,scholar.one@demo.invalid,9800000011,CSED,Parent One,Female,Full Time,2024-08-01,,,,8.4,10,,Yes,Patiala,Supervisor One,supervisor.one@thapar.edu,,,,,Committee One,committee.one@thapar.edu,,,,`;

  // The sheet says "Full Time"; the portal stores "full-time".
  const enrolmentType = (value) => value.trim().toLowerCase().replace(/\s+/g, '-');

  // A blank JRF cell means nobody has said yet, which is not the same as No.
  const yesNo = (value) => (value === '' ? null : /^y/i.test(value));

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

        // Every column is read by the institute sheet's wording or the
        // portal's older template, and a blank cell is sent as an empty string
        // the server treats as "not supplied". Sending null or 0 for a blank
        // is what used to wipe stored values on an update.
        const students = batch.map(r => ({
          full_name: column(r, 'Full Name', 'full_name')
            || [column(r, 'First Name'), column(r, 'Last Name')].filter(Boolean).join(' '),
          email: column(r, 'Email', 'email'),
          phone: column(r, 'Phone', 'phone'),
          roll_no: column(r, 'Registration Number', 'Roll Number', 'roll_no'),
          department_code: column(r, 'Department Code', 'department_code'),
          gender: column(r, 'Gender', 'gender'),
          date_of_registration: column(r, 'Date of Admission', 'Date of Registration (YYYY-MM-DD)', 'date_of_registration'),
          date_of_irb: column(r, 'Date of IRB', 'Date of URB or IRB', 'Date of IRB (YYYY-MM-DD)', 'date_of_irb'),
          date_of_synopsis: column(r, 'Date of Synopsis', 'date_of_synopsis'),
          date_of_thesis: column(r, 'Date of Thesis', 'date_of_thesis'),
          phd_title: column(r, 'PhD Title', 'phd_title'),
          fathers_name: column(r, 'Father Name', "Father's Name", 'fathers_name'),
          address: column(r, 'Permanent Address', 'Address', 'address'),
          current_status: enrolmentType(column(r, 'Enrollment Type', 'Enrolment Type', 'Current Status', 'current_status')),
          cgpa: column(r, 'CGPA', 'cgpa'),
          is_jrf: yesNo(column(r, 'JRF?', 'JRF', 'is_jrf')),
          overall_progress: column(r, 'Overall Progress', 'overall_progress'),
          supervisors: [1, 2, 3]
            .map((slot) => column(r, `Supervisor ${slot} Email`))
            .filter(Boolean),
          committee: [1, 2, 3]
            .map((slot) => column(r, `Committee Member ${slot} Email`))
            .filter(Boolean),
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

          {can("can_manage_urf") && (
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'phd', label: 'PhD Scholars' },
                { value: 'ug', label: 'UG Students' },
              ]}
            />
          )}

          {tab === 'ug' ? (
            <>
              <FilterBar
                path="/ug-students"
                placeholder="Search by name, roll number or branch…"
                onSearch={setUgFilter}
              />
              <PagenationTable
                key={ugRefreshKey}
                endpoint="/ug-students"
                filters={ugFilter}
                enableApproval={false}
                enableSelect={false}
                extraTopbarComponents={
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <CustomButton
                      text="Bulk Import"
                      variant="secondary"
                      onClick={() => setUgImportOpen(true)}
                    />
                    <CustomButton
                      text="Add UG Student +"
                      onClick={() => { setUgStudent(null); setUgFormOpen(true); }}
                    />
                  </div>
                }
                actions={[{
                  icon: <i className="fa-solid fa-pen-to-square"></i>,
                  tooltip: "Edit",
                  onClick: (student) => { setUgStudent(student); setUgFormOpen(true); },
                }]}
              />
            </>
          ) : (
          <>
          <FilterBar onSearch={handleFilterChange} />

          <PagenationTable
            key={refreshKey}
            endpoint={location.pathname}
            filters={filter}
            enableApproval={false}
            extraTopbarComponents={
              can("can_manage_students") ? (
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
              ) : null
            }
            actions={[
              ...(can("can_manage_students") ? [{
                icon: <i className="fa-solid fa-pen-to-square"></i>,
                tooltip: "Edit",
                onClick: (studentData) => {
                  handleOpenForm(studentData);
                },
              }] : []),
              ...(can("can_propose_supervisor_changes") ? [{
                icon: <i className="fa-solid fa-users-gear"></i>,
                tooltip: "Manage Supervisors/Doctoral",
                onClick: (studentData) => {
                  setStudentToEdit(studentData);
                  setIsModalEditStudentOpen(true);
                },
              }] : []),
              ...(role === "admin" ? [{
                icon: <i className="fa-solid fa-file-lines"></i>,
                tooltip: "Manage Forms",
                onClick: (studentData) => {
                  navigate(`/forms/manage?roll_no=${studentData.roll_no}`);
                },
              }] : []),
            ]}
          />
          </>
          )}

          <CustomModal
            isOpen={ugFormOpen}
            onClose={() => setUgFormOpen(false)}
            title={ugStudent ? "Edit UG Student" : "Add UG Student"}
            width="60vw"
          >
            <UgStudentForm
              student={ugStudent}
              onClose={() => setUgFormOpen(false)}
              onSaved={() => setUgRefreshKey((k) => k + 1)}
            />
          </CustomModal>

          <UnifiedBulkImportModal
            isOpen={ugImportOpen}
            onClose={() => setUgImportOpen(false)}
            title="Bulk Import UG Students"
            required={['full_name', 'email', 'roll_no', 'branch_code', 'year']}
            rules={[
              'Matched on email, so importing a corrected file updates rather than duplicates.',
              'branch_code is the code from Configuration, and programme narrows it when two degrees share one.',
              'year is the year of study, 1 to 4.',
              'A new student is emailed a link to set their password.',
            ]}
            sampleFileName="ug_students_sample.csv"
            sampleCsvContent={UG_SAMPLE_CSV}
            onImport={importUgStudents}
            submitting={submitting}
          />

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
            {can("can_propose_supervisor_changes") && (
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
            required={['Registration Number', 'Full Name', 'Email', 'Phone', 'Department Code', 'Date of Admission', 'Enrollment Type']}
            rules={[
              'Matched by registration number, then email. Both must belong to the same scholar.',
              'A blank cell never clears a stored value. Clear one on the scholar\'s profile.',
              'Supervisors and committee: filled cells replace the whole list, all blank leaves it alone.',
              'Enrollment Type is Full Time, Part Time or Executive.',
              'IRB member and external expert columns are read past, not imported yet.',
            ]}
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
