import React, { useEffect, useState } from "react";
import Page from '../../components/page/Page';
import { useLocation, useNavigate } from "react-router-dom";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import CustomModal from "../../components/forms/modal/CustomModal";
import StudentForm from "../../components/studentForm/StudentForm";
import CustomButton from "../../components/forms/fields/CustomButton";
import SupervisorDoctoralManager from "../../components/supervisorDoctoralManager/SupervisorDoctoralManager";
import UnifiedBulkImportModal from "../../components/bulkImport/UnifiedBulkImportModal";
import { column } from "../../components/bulkImport/columns";
import { formatDate } from "../../utils/timeParse";
import { toast } from "react-toastify";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import useCapabilities from '../../context/CapabilitiesContext';
import Tabs from "../../components/tabs/Tabs";
import UgStudentForm from "../../components/urf/UgStudentForm";
import { apiUgStudentImport } from "../../api/urf";
import { currentRole } from '../../auth/access';

const StudentsPage = () => {
  const [filter, setFilter] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const can = useCapabilities();
  // Manage Forms has no capability of its own yet, so it keeps the role
  // check it always had rather than borrowing an unrelated capability.
  const role = currentRole();
  // A mentor reads the UG students on the projects they mentor, so the tab is
  // theirs too. Adding, importing and editing one stay the office's.
  const managesStudents = can("can_manage_students");
  const managesUrf = can("can_manage_urf");
  const readsUrf = managesUrf || can("can_read_urf_mentees");
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

  const STUDENT_HEADERS = "Registration Number,Full Name,Email,Phone,Department Code,Father Name,Gender,Enrollment Type,Date of Admission,Date of IRB,Date of Synopsis,Date of Thesis,Date of thesis awarded,CGPA,Overall Progress,PhD Title,NET/Gate,JRF?,Permanent Address,Supervisor 1 Name,Supervisor 1 Email,Supervisor 2 Name,Supervisor 2 Email,Supervisor 3 Name,Supervisor 3 Email,Committee Member 1 Name,Committee Member 1 Email,Committee Member 2 Name,Committee Member 2 Email,Committee Member 3 Name,Committee Member 3 Email,IRB member1 email,IRB member2 email,IRB member3 email,External expert for IRB Name,External expert for IRB Mail,External expert for IRB Designation,External expert for IRB Department,External expert for IRB Institute name";

  const studentsSampleCsv = `${STUDENT_HEADERS}
900011,Scholar One,scholar.one@demo.invalid,9800000011,CSED,Parent One,Female,Full Time,2024-08-01,,,,,8.4,10,,Yes,Yes,Patiala,Supervisor One,supervisor.one@thapar.edu,,,,,Committee One,committee.one@thapar.edu,,,,,cognate.one@thapar.edu,,,Expert One,expert.one@elsewhere.edu,Professor,Physics,Elsewhere Institute`;

  // The office's sheet writes REG, PT and Executive; an older template writes
  // Full Time and Part Time; the portal stores full-time, part-time and
  // executive. The server rejects the whole batch over one unknown value, so a
  // sheet of REG rows used to import nothing at all.
  const ENROLMENT_TYPES = {
    reg: 'full-time', regular: 'full-time', ft: 'full-time', fulltime: 'full-time',
    pt: 'part-time', parttime: 'part-time',
    exec: 'executive', executive: 'executive',
  };

  const enrolmentType = (value) => {
    const key = value.trim().toLowerCase().replace(/[^a-z]/g, '');
    return ENROLMENT_TYPES[key] ?? value.trim().toLowerCase().replace(/\s+/g, '-');
  };

  // A blank cell means nobody has said yet, which is not the same as No.
  //
  // The sheet answers the NET/GATE column by naming the qualification rather
  // than saying yes: GATE, NET(UGC/CSIR), DBT-BET, GPAT. Reading only a
  // leading "y" filed every one of those as not qualified.
  const yesNo = (value) => {
    const answer = value.trim().toLowerCase();
    if (answer === '') return null;
    return !/^(no|n|none|not qualified)$/.test(answer);
  };

  // Off by default: an import of the institute's sheet is a migration of
  // records, and a reset link lives 24 hours, so mailing 800 of them days
  // before anyone has been told the portal exists sends 800 dead links.
  const [inviteOnImport, setInviteOnImport] = useState(false);

  const handleBulkImport = async (csvPreview, resetState) => {
    try {
      setSubmitting(true);

      // One id for the run, repeated on every batch below, so Send sign-in
      // links can mean "the scholars this import brought in" however many
      // requests it took.
      const importBatch = crypto.randomUUID();

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
          date_of_thesis_awarded: column(r, 'Date of thesis awarded', 'Date of Thesis Awarded', 'date_of_thesis_awarded'),
          phd_title: column(r, 'PhD Title', 'phd_title'),
          fathers_name: column(r, 'Father Name', "Father's Name", 'fathers_name'),
          address: column(r, 'Permanent Address', 'Address', 'address'),
          current_status: enrolmentType(column(r, 'Enrollment Type', 'Enrolment Type', 'Current Status', 'current_status')),
          cgpa: column(r, 'CGPA', 'cgpa'),
          is_jrf: yesNo(column(r, 'JRF?', 'JRF', 'is_jrf')),
          is_net_gate_qualified: yesNo(column(r, 'NET/Gate', 'NET/GATE', 'NET/Gate (Yes/No)', 'is_net_gate_qualified')),
          overall_progress: column(r, 'Overall Progress', 'overall_progress'),
          supervisors: [1, 2, 3]
            .map((slot) => column(r, `Supervisor ${slot} Email`))
            .filter(Boolean),
          committee: [1, 2, 3]
            .map((slot) => column(r, `Committee Member ${slot} Email`))
            .filter(Boolean),
          // The sheet spells these three inconsistently, so all its spellings
          // are read rather than one being picked and the rest dropped.
          irb_members: [1, 2, 3]
            .map((slot) => column(r, `IRB member${slot} email`, `IRB member ${slot} email`, `IRB member ${slot} mail`))
            .filter(Boolean),
          // The sheet stops prefixing after the expert's name, so its last five
          // columns read Mail, Designation, Department and Institute name.
          external_expert: {
            name: column(r, 'External expert for IRB Name'),
            email: column(r, 'External expert for IRB Mail', 'External expert for IRB Email', 'Mail'),
            designation: column(r, 'External expert for IRB Designation', 'Designation'),
            department: column(r, 'External expert for IRB Department', 'Department'),
            institution: column(r, 'External expert for IRB Institute name', 'Institute name'),
          },
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          const res = await customFetch(
            baseURL + '/students/bulk-upload',
            'POST',
            { students, import_batch: importBatch, send_invites: inviteOnImport },
            true
          );
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

      const summary = `${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors`;
      if (totalSuccess + totalUpdated > 0) toast.success(`Import completed: ${summary}`);
      else toast.error(`Nothing was imported: ${summary}`);
      if (allErrors.length > 0) {
        const more = allErrors.length > 3 ? `; and ${allErrors.length - 3} more` : '';
        toast.warning(`Check these rows: ${allErrors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
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

  // Adding and importing belong to the list on screen, so they follow the tab.
  const pageActions = tab === 'ug'
    ? managesUrf && (
      <>
        <CustomButton text="Bulk import" variant="secondary" onClick={() => setUgImportOpen(true)} />
        <CustomButton text="Add UG student" onClick={() => { setUgStudent(null); setUgFormOpen(true); }} />
      </>
    )
    : can("can_manage_students") && (
      <>
        <CustomButton text="Bulk import" variant="secondary" onClick={() => setIsBulkUploadModalOpen(true)} />
        <CustomButton text="Add student" onClick={() => handleOpenForm()} />
      </>
    );

  return (
    <Page
      title="Students"
      description="All PhD scholars and their current stage."
      actions={pageActions || undefined}
      tabs={readsUrf && (
        <Tabs
          value={tab}
          // Each tab's FilterBar unmounts when the other opens, so a search
          // it kept would still filter the list with nothing on screen to say so.
          onChange={(next) => {
            setTab(next);
            setFilter([]);
            setUgFilter({ conditions: [] });
          }}
          items={[
            { value: 'phd', label: 'PhD scholars' },
            { value: 'ug', label: 'UG students' },
          ]}
        />
      )}
    >
      {tab === 'ug' ? (
        <PagenationTable
          key={ugRefreshKey}
          search={
            <FilterBar
              path="/ug-students"
              placeholder="Search by name, roll number or branch…"
              onSearch={setUgFilter}
            />
          }
          endpoint="/ug-students"
          // UG students have no profile page; editing is in the row menu.
          rowClickable={false}
          filters={ugFilter}
          enableApproval={false}
          enableSelect={false}
          actions={managesUrf ? [{
            icon: <i className="fa fa-pencil-square-o"></i>,
            tooltip: "Edit",
            onClick: (student) => { setUgStudent(student); setUgFormOpen(true); },
          }] : []}
        />
      ) : (
      <PagenationTable
        key={refreshKey}
        search={<FilterBar onSearch={handleFilterChange} />}
        endpoint={location.pathname}
        filters={filter}
        enableApproval={false}
        actions={[
          ...(can("can_manage_students") ? [{
            icon: <i className="fa fa-pencil-square-o"></i>,
            tooltip: "Edit",
            onClick: (studentData) => {
              handleOpenForm(studentData);
            },
          }] : []),
          ...(can("can_propose_supervisor_changes") ? [{
            icon: <i className="fa fa-users"></i>,
            tooltip: "Manage supervisors/doctoral",
            onClick: (studentData) => {
              setStudentToEdit(studentData);
              setIsModalEditStudentOpen(true);
            },
          }] : []),
          ...(role === "admin" ? [{
            icon: <i className="fa fa-file-text-o"></i>,
            tooltip: "Manage forms",
            onClick: (studentData) => {
              navigate(`/forms/manage?roll_no=${studentData.roll_no}`);
            },
          }] : []),
        ]}
      />
      )}

      <CustomModal
        isOpen={ugFormOpen}
        onClose={() => setUgFormOpen(false)}
        closeOnOutsideClick={false}
        title={ugStudent ? "Edit UG student" : "Add UG student"}
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
        title="Bulk import UG students"
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
        closeOnOutsideClick={false}
        title={editMode ? "Edit student" : "Add student"}
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
        title="Add student panel"
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
        title="Bulk import students"
        required={['Registration Number', 'Full Name', 'Email', 'Phone', 'Department Code', 'Date of Admission', 'Enrollment Type']}
        rules={[
          'Matched by registration number, then email. Both must belong to the same scholar.',
          'A blank cell never clears a stored value. Clear one on the scholar\'s profile.',
          'Supervisors and committee: filled cells replace the whole list, all blank leaves it alone.',
          'Enrollment Type reads REG, PT and Exec as well as Full Time, Part Time and Executive.',
          'Nobody is mailed. Use Send sign-in links when the scholars are ready to be told.',
          'IRB members and the external expert go on the IRB committee only. The doctoral committee is a separate body, filled from its own columns.',
          'Named supervisors, a Date of IRB, of Synopsis and of Thesis each record that milestone as done, which opens the forms that come after it.',
          'Those forms are created complete and locked, and nothing in them is recorded as approved, because nobody approved them here.',
        ]}
        sampleFileName="students_bulk_import_sample.csv"
        sampleCsvContent={studentsSampleCsv}
        onImport={handleBulkImport}
        submitting={submitting}
        uploadProgress={uploadProgress}
        extraControls={
          <label className="csv-import-note" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={inviteOnImport}
              onChange={(e) => setInviteOnImport(e.target.checked)}
            />
            Email each new scholar their sign-in link now. The link lasts 24 hours, so
            leave this off until they have been told the portal exists.
          </label>
        }
      />
    </Page>
  );
};

export default StudentsPage;
