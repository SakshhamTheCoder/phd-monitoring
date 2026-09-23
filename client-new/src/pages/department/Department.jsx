import React, { useState } from 'react';
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import DepartmentManager from '../../components/departmentManager/DepartmentManager';
import AddDepartmentForm from './AddDepartmentForm';
import CustomButton from '../../components/forms/fields/CustomButton';
import useCapabilities from '../../context/CapabilitiesContext';
import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
import { column } from '../../components/bulkImport/columns';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import { apiDepartmentList } from '../../api/lookups';

const DepartmentPage = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const { setLoading } = useLoading();
  const location = useLocation();
  const can = useCapabilities();
  // Every department write is gated on can_add_department server side, so a
  // role without it is shown the directory, not the controls.
  const mayManage = can('can_add_department');

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const openForm = async (data) => {
    if (data) {
      setLoading(true);
      setEditData(data);
      setIsOpen(true);
      setLoading(false);
    } else {
      setEditData(null);
      setIsOpen(true);
    }
  };

  const OFFICER_HEADERS = 'Department Code,HOD Name,HOD Personal Email,HOD Office Email,ADORDC Name,ADORDC Email,ADORDC Office Email,PhD Coordinator 1 Name,PhD Coordinator 1 Email,PhD Coordinator 2 Name,PhD Coordinator 2 Email,Clerk Name,Clerk Email,Clerk Phone';

  const officerSampleCsv = `${OFFICER_HEADERS}
CSED,Hod One,hod.one@thapar.edu,hcsed@thapar.edu,Adordc One,adordc.one@thapar.edu,adorsp4@thapar.edu,Coordinator One,coordinator.one@thapar.edu,Coordinator Two,coordinator.two@thapar.edu,Clerk One,clerk.one@thapar.edu,9800000031`;

  // People are matched by their personal address, so an office address such as
  // adorsp3@thapar.edu is reported rather than guessed at.
  const handleImport = async (preview, reset) => {
    setImporting(true);

    const rows = preview.data.map((row) => ({
      department_code: column(row, 'Department Code', 'department_code'),
      hod_email: column(row, 'HOD Personal Email', 'HOD Email', 'hod_email'),
      hod_office_email: column(row, 'HOD Office Email', 'hod_office_email'),
      adordc_email: column(row, 'ADORDC Email', 'ADORDC Personal Email', 'adordc_email'),
      adordc_office_email: column(row, 'ADORDC Office Email', 'adordc_office_email'),
      coordinator_1_email: column(row, 'PhD Coordinator 1 Email', 'coordinator_1_email'),
      coordinator_2_email: column(row, 'PhD Coordinator 2 Email', 'coordinator_2_email'),
      clerk_name: column(row, 'Clerk Name', 'clerk_name'),
      clerk_email: column(row, 'Clerk Email', 'clerk_email'),
      clerk_phone: column(row, 'Clerk Phone', 'clerk_phone'),
      row_number: row._rowNumber,
    })).filter((row) => row.department_code);

    const response = await customFetch(`${baseURL}/departments/import`, 'POST', { rows }, false);
    setImporting(false);

    if (!response.success) {
      toast.error(response.response?.message || 'Import failed');
      return;
    }

    apiDepartmentList.invalidate();
    const { update_count: updated = 0, errors = [] } = response.response.data || {};
    toast.success(`${updated} departments updated`);
    errors.forEach((message) => toast.warn(message));

    reset();
    setShowImport(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleUpdate = () => {
    setIsOpen(false);
    setEditData(null);
    setRefreshKey(prev => prev + 1);
  };

  // A change inside the manager keeps it open, showing what the server now
  // holds for that department, and refreshes the table behind it. Closing it
  // after every change meant reopening it for the next one.
  const handleManagerUpdate = async () => {
    setRefreshKey(prev => prev + 1);
    apiDepartmentList.invalidate();
    const res = await apiDepartmentList();
    const fresh = res.success ? (res.response?.data || []).find((d) => d.id === editData?.id) : null;
    if (fresh) setEditData((current) => (current?.id === fresh.id ? fresh : current));
  };

  return (
    <>
      <PageHeader title="Departments" subtitle="Departments, their HoD and PhD coordinators." />
      <FilterBar onSearch={handleFilterChange} />
      <PagenationTable
        key={refreshKey}
        endpoint={location.pathname}
        filters={filter}
        enableApproval={false}
        rowClickable={mayManage}
        customOpenForm={openForm}
        extraTopbarComponents={
          mayManage ? (
            <>
              <CustomButton text="Bulk Import" variant="secondary" onClick={() => setShowImport(true)} />
              <CustomButton text="Add Department +" onClick={() => openForm()} />
            </>
          ) : null
        }
        actions={mayManage ? [
          {
            icon: <i className="fa fa-users"></i>,
            tooltip: 'Manage HOD & Coordinators',
            onClick: (deptData) => openForm(deptData),
          },
        ] : []}
      />
      <CustomModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditData(null);
        }}
        width="90vw"
      >
        {editData ? (
          <DepartmentManager
            departmentId={editData.id}
            departmentName={editData.name || editData.department_name}
            hodEmail={editData.hod_email}
            currentHod={editData.hod}
            currentAdordc={editData.adordc}
            currentCoordinators={editData.phd_coordinators || []}
            onClose={() => {
              setIsOpen(false);
              setEditData(null);
            }}
            onUpdate={handleManagerUpdate}
          />
        ) : (
          <AddDepartmentForm
            onClose={() => {
              setIsOpen(false);
              setEditData(null);
            }}
            onCreated={handleUpdate}
          />
        )}
      </CustomModal>

      <UnifiedBulkImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Bulk Import Departments"
        required={['Department Code']}
        rules={[
          'Departments are never created or deleted. A renamed code renames the department in place.',
          'Officers are matched by their personal email. An office mailbox is reported and skipped.',
          'The HOD and ADORDC office addresses are kept on the department, and a blank cell leaves the stored one alone.',
          'Both coordinator cells blank leaves the current coordinators alone.',
        ]}
        sampleFileName="department_officers_sample.csv"
        sampleCsvContent={officerSampleCsv}
        onImport={handleImport}
        submitting={importing}
      />
    </>
  );
};

export default DepartmentPage;
