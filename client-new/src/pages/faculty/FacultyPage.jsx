import React, { useState } from 'react';
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLoading } from '../../context/LoadingContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import FacultyForm from '../../components/facultyForm/FacultyForm'; // assume it's placed here
import { baseURL } from '../../api/urls';
import CustomButton from '../../components/forms/fields/CustomButton';
import useCapabilities from '../../context/CapabilitiesContext';

import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
import { column } from '../../components/bulkImport/columns';

const FacultyPage = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();
  const can = useCapabilities();

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const FACULTY_HEADERS = 'Emp id,Full Name,Email,Phone,Designation,Department Code,Broad Area of Expertise,Specific Areas under Broad Area of Expertise (comma separated),Students Supervising in TIET,Students Supervising Outside TIET';

  const facultySampleCsv = `${FACULTY_HEADERS}
10001,Dr. Tarunpreet Bhatia,tarunpreet.bhatia@demo.invalid,9800000001,Professor,CSED,Artificial Intelligence,"Machine Learning, Cyber Security",3,1
10002,Khalid Bashir,khalid.bashir@demo.invalid,9800000002,Assistant Professor,ECED,Signal Processing,"Speech Processing",0,0`;


  const openForm = async (data) => {
    if (data) {
      setLoading(true);
      // const res = await customFetch(baseURL + `/faculty/${id}`, 'GET');
     
        setEditData(data);
        setIsOpen(true);
    
      setLoading(false);
    } else {
      setEditData(null);
      setIsOpen(true);
    }
  };

  const handleBulkImport = async (csvPreview, resetState) => {
    try {
      setSubmitting(true);

      // One id for the run, repeated on every batch below, so Send sign-in
      // links on Manage Users can mail exactly the people this import brought
      // in, however many requests it took and however many imports follow.
      const importBatch = crypto.randomUUID();
      setLoading(true);
      
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

      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please login again.');
        setLoading(false);
        setSubmitting(false);
        return;
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        setUploadProgress({
          current: (batchIndex + 1) * BATCH_SIZE > totalRows ? totalRows : (batchIndex + 1) * BATCH_SIZE,
          total: totalRows,
          percentage: Math.round(((batchIndex + 1) / batches.length) * 100)
        });

        // The institute's supervisor sheet and the portal's own template use
        // different header wording for the same columns, and saved copies of
        // both are in circulation, so each column is read by either name.
        const batchData = batch.map(row => ({
          full_name: column(row, 'Full Name', 'full_name')
            || [column(row, 'first_name'), column(row, 'last_name')].filter(Boolean).join(' '),
          email: column(row, 'Email', 'email'),
          phone: column(row, 'Phone', 'phone'),
          designation: column(row, 'Designation', 'designation'),
          faculty_code: column(row, 'Emp id', 'E Code', 'faculty_code'),
          department_code: column(row, 'Department Code', 'department_code'),
          institution: column(row, 'institution'),
          website_link: column(row, 'website_link'),
          broad_area: column(row, 'Broad Area of Expertise', 'broad_area'),
          expertise: column(
            row,
            'Specific Areas under Broad Area of Expertise (comma separated)',
            'Specific Areas under Broad Area of Expertise',
            'Specific Areas under Broad Area of Expertise (comma seperated)',
            'Area of Expertise',
            'expertise'
          ),
          supervised_campus: column(row, 'Students Supervising in TIET', 'supervised_campus'),
          supervised_outside: column(row, 'Students Supervising Outside TIET', 'Students Outside TIET', 'supervised_outside'),
          row_number: row._rowNumber
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          // Quiet, so a failed batch is reported once below rather than once
          // per attempt. A 401 still sends customFetch to the sign-in page,
          // after it clears the session, and there is no point going on.
          const res = await customFetch(`${baseURL}/faculty/bulk-import`, 'POST', { batch_data: batchData, import_batch: importBatch }, false);
          if (!res.success && !localStorage.getItem('token')) return;

          const data = res.response || {};
          if (res.success && data.success) {
            totalSuccess += data.data?.success_count || 0;
            totalUpdated += data.data?.update_count || 0;
            totalErrors += data.data?.error_count || 0;
            allErrors = allErrors.concat(data.data?.errors || []);
            batchSuccess = true;
          } else if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            toast.error(res.networkError
              ? NETWORK_ERROR_MESSAGE
              : `Batch ${batchIndex + 1} failed: ${data.message || 'Server error'}`);
            totalErrors += batch.length;
            break;
          }
        }
      }

      const summary = `${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors`;
      if (totalSuccess + totalUpdated > 0) toast.success(`Import completed: ${summary}`);
      else toast.error(`Nothing was imported: ${summary}`);

      // Also carries notes on rows that did import, such as a kept employee code.
      if (allErrors.length > 0) {
        const more = allErrors.length > 3 ? `; and ${allErrors.length - 3} more` : '';
        toast.warning(`Check these rows: ${allErrors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
      }

      setShowBulkImportModal(false);
      resetState?.();
      setUploadProgress(null);
      setRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import CSV');
    } finally {
      setLoading(false);
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <>
      <PageHeader title="Faculty" subtitle="Directory of internal faculty." />
      <FilterBar onSearch={handleFilterChange} />
      <PagenationTable
        key={refreshKey}
        endpoint={location.pathname}
        filters={filter}
        enableApproval={false}
        // A row leads to the profile, never to the edit form. Editing lives
        // in the actions menu, where the role check is.
        rowClickable={true}
        customOpenForm={(facultyData) =>
          navigate(`/faculty/${facultyData.faculty_code}/profile`)
        }
        extraTopbarComponents={
          // A viewer with only directory access is browsing, not managing.
          can('can_manage_faculties') ? (
            <div className="top-actions">
              <CustomButton
                text="Bulk Import"
                variant="secondary"
                onClick={() => setShowBulkImportModal(true)}
              />
              <CustomButton text="Add Faculty +" onClick={() => openForm()} />
            </div>
          ) : null
        }
            
        actions={[
          ...(can('can_manage_faculties') ? [{
            icon: <i className="fa fa-pencil-square-o"></i>,
            tooltip: 'Edit',
            onClick: (facultyData) => openForm(facultyData),
          }] : []),
          {
            icon: <i className="fa fa-user-circle"></i>,
            tooltip: 'View profile',
            onClick: (facultyData) => navigate(`/faculty/${facultyData.faculty_code}/profile`),
          },
        ]}
      />
      <CustomModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        closeOnOutsideClick={false}
        width="800px"
      >
        <FacultyForm
          edit={!!editData}
          facultyData={editData}
          onClose={() => setIsOpen(false)}
          onSuccess={() => setRefreshKey((prev) => prev + 1)}
        />
      </CustomModal>

      {/* Bulk Import Modal */}
      <UnifiedBulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        title="Bulk Import Faculty"
        required={['Emp id', 'Full Name', 'Email', 'Designation', 'Department Code']}
        rules={[
          'Matched by email. An existing faculty member is updated from the cells the row fills in.',
          "Broad Area of Expertise must already be on that department's research area list.",
          'Students Supervising in TIET is compared against the portal\'s own count, not stored.',
          'New faculty are added as internal faculty.',
        ]}
        sampleFileName="faculty_bulk_import_sample.csv"
        sampleCsvContent={facultySampleCsv}
        onImport={handleBulkImport}
        submitting={submitting}
        uploadProgress={uploadProgress}
      />
    </>
  );
};

export default FacultyPage;
