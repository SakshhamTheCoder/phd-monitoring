import React, { useEffect, useState } from "react";
import Page from "../../components/page/Page";
import FormList from "../../components/forms/formList/FormList";
import { useLocation } from "react-router-dom";
import CreateNewBar from "../../components/forms/formList/CreateNewBar";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import GridContainer from "../../components/forms/fields/GridContainer";
import CustomButton from "../../components/forms/fields/CustomButton";
import CustomModal from "../../components/forms/modal/CustomModal";
import InputField from "../../components/forms/fields/InputField";
import BulkAllocateSupervisors from "../../components/bulkAllocateSupervisors/BulkAllocateSupervisors";
import useScholarInPath from "../../hooks/useScholarInPath";
import { currentRole } from '../../auth/access';

// Forms a reviewer raises on a scholar's behalf, from that scholar's own form
// list. The supervisor raises the list of examiners. The PhD coordinator raises
// a supervisor change for a scholar who has not raised it themselves; it is the
// ordinary form either way and still opens at the scholar's step, because the
// preferences and the reason are theirs to give.
const RAISED_FOR_A_SCHOLAR = {
  'list-of-examiners': { role: 'faculty', label: 'Create new form' },
  'supervisor-change': { role: 'phd_coordinator', label: 'Raise supervisor change' },
};

const FormListPage = () => {
  const location = useLocation();
  const scholar = useScholarInPath();
  // The form type is the last path segment: /forms/synopsis-submission reads
  // "Synopsis submission", with the acronyms kept whole.
  const formTypeLabel = (location.pathname.split('/').filter(Boolean).pop() || 'Forms')
    .replace(/[-_]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\b(irb|urf|phd)\b/gi, (word) => (word.toLowerCase() === 'phd' ? 'PhD' : word.toUpperCase()));
  const [role, setRole] = useState();
  const [showBar, setShowBar] = useState(false);
  // Read from the path on every render: this page is reused across form
  // types, so state copied from an earlier path would carry over.
  const scholarFormMatch = location.pathname.match(/^\/students\/(\d+)\/forms\/([\w-]+)$/);
  // The entry from RAISED_FOR_A_SCHOLAR this page offers, or null.
  const raisable = (scholarFormMatch && RAISED_FOR_A_SCHOLAR[scholarFormMatch[2]]) || null;
  const modalButtonShow = location.pathname === "/forms/list-of-examiners";
  // Typed into the list of examiners modal.
  const [rollNumber, setRollNumber] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Reopening starts from an empty roll number, not the confirm step for the
  // last scholar typed.
  const closeExaminersModal = () => {
    setIsModalOpen(false);
    setShowBar(false);
    setRollNumber(null);
  };
  const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({}); // Initialize filters state

  // Only the PhD Coordinator allocates supervisors, and only from the
  // department-wide allocation list (not a single student's form list).
  // Admin can view this form but the write path rejects them on every row.
  const showBulkAllocate =
    role === "phd_coordinator" &&
    location.pathname === "/forms/supervisor-allocation";

  useEffect(() => {
    // Set the user role from localStorage
    setRole(currentRole());
  }, [location]);
  // One place for the page's primary action, so it sits in the header next to
  // the title instead of floating in a band of its own.
  const headerAction =
    role === "student" ? <CreateNewBar />
    : raisable && role === raisable.role
      ? <CreateNewBar rollNumber={scholarFormMatch[1]} label={raisable.label} />
    : role === "faculty" && modalButtonShow ? (
      <CustomButton onClick={() => setIsModalOpen(true)} text="Create new form" />
    ) : null;

  const handleSearch = (query) => {
    setFilters((prev) => {
      return JSON.stringify(prev) !== JSON.stringify(query) ? query : prev;
    });
  };

  return (
    <Page
      title={formTypeLabel}
      description={scholar ? `Viewing ${scholar.label}` : undefined}
      actions={headerAction}
    >
      {role !== "student" ? (
        <PagenationTable
          key={refreshKey}
          search={<FilterBar onSearch={handleSearch} />}
          endpoint={location.pathname}
          filters={filters}
          // Offered where the server says this reader may bulk-approve.
          enableApproval={true}
          enableSelect={role !== "faculty" && role !== "admin"}
          extraTopbarComponents={
            showBulkAllocate ? (
              <CustomButton
                text="Bulk allocate"
                variant="secondary"
                onClick={() => setIsBulkAllocateOpen(true)}
              />
            ) : null
          }
        />
      ) : (
        <FormList />
      )}
      <CustomModal
        isOpen={isBulkAllocateOpen}
        onClose={() => setIsBulkAllocateOpen(false)}
        width="90vw"
      >
        <BulkAllocateSupervisors
          onSuccess={() => {
            setIsBulkAllocateOpen(false);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      </CustomModal>
      <CustomModal
        isOpen={isModalOpen}
        onClose={closeExaminersModal}
        minWidth="500px"
        maxWidth="600px"
        minHeight="200px"
        maxHeight="400px"
        children={[
            <>
            {!showBar ? (
            <GridContainer 
            label="Enter the student roll number to initiate a list of examiners"
            elements={[
                <InputField 
                    hint={"Enter roll number"}
                    label={"Roll number"}
                    onChange={(value)=>{setRollNumber(value.trim())}}
                />,
                <CustomButton
                    label=" "
                    text="Submit"
                    disabled={!rollNumber}
                    onClick={()=>{
                       setShowBar(true);
                    }}
                />
            ]}
                
            />):(<CreateNewBar rollNumber={rollNumber} label={"Confirm form for "+rollNumber} />)}
            </>,
        ]}
      />
    </Page>
  );
};

export default FormListPage;
