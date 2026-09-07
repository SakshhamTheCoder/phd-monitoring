import React, { useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLoading } from '../../context/LoadingContext';
import { useFeatures } from '../../context/FeaturesContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import FacultyForm from '../../components/facultyForm/FacultyForm'; // assume it's placed here
import { baseURL } from '../../api/urls';
import CustomButton from '../../components/forms/fields/CustomButton';

import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';

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
  const features = useFeatures();

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const facultySampleCsv = `full_name,email,phone,designation,faculty_code,department_code,expertise
Dr. Tarunpreet Bhatia,tarunpreet.bhatia@demo.invalid,9800000001,Professor,10001,CSED,"Machine Learning, Cyber Security"
Khalid Bashir,khalid.bashir@demo.invalid,9800000002,Assistant Professor,10002,ECED,"Signal Processing"`;


  const openForm = async (data) => {
    if (data) {
      setLoading(true);
      // const res = await customFetch(baseURL + `/faculty/${id}`, 'GET');
     
        setEditData(data);
        console.log(data);
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

        const batchData = batch.map(row => ({
          full_name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || '',
          email: row.email || '',
          phone: row.phone || '',
          designation: row.designation || '',
          faculty_code: row.faculty_code || '',
          department_code: row.department_code || '',
          institution: row.institution || '',
          website_link: row.website_link || '',
          expertise: row.expertise || '',
          row_number: row._rowNumber
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          try {
            const response = await fetch(`${baseURL}/faculty/bulk-import`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({ batch_data: batchData }),
            });

            if (response.status === 302 || response.redirected) {
              toast.error('Session expired. Please login again.');
              setLoading(false);
              setSubmitting(false);
              return;
            }

            let data;
            try {
              data = await response.json();
            } catch (jsonError) {
              throw new Error('Invalid server response');
            }

            if (!response.ok) {
              if (retryCount < maxRetries) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
              toast.error(`Batch ${batchIndex + 1} failed: ${data.message || 'Server error'}`);
              totalErrors += batch.length;
              break;
            }

            if (data.success) {
              totalSuccess += data.data.success_count || 0;
              totalUpdated += data.data.update_count || 0;
              totalErrors += data.data.error_count || 0;
              allErrors = allErrors.concat(data.data.errors || []);
              batchSuccess = true;
            } else {
              if (retryCount < maxRetries) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
              toast.error(`Batch ${batchIndex + 1} failed: ${data.message}`);
              totalErrors += batch.length;
            }
          } catch (fetchError) {
            if (retryCount < maxRetries) {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            toast.error(`Batch ${batchIndex + 1} network error: ${fetchError.message}`);
            totalErrors += batch.length;
          }
        }
      }

      toast.success(`Import completed: ${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors`);
      
      if (allErrors.length > 0) {
        console.log('Import errors:', allErrors);
        toast.warning(`${totalErrors} rows failed. Check console for details.`);
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
    <Layout
      children={
        <>
          <PageHeader title="Faculty" subtitle="Directory of internal and external faculty." />
          <FilterBar onSearch={handleFilterChange} />
          <PagenationTable
            key={refreshKey}
            endpoint={location.pathname}
            filters={filter}
            enableApproval={false}
            customOpenForm={openForm}
            extraTopbarComponents={
              <div className="top-actions">
                <CustomButton
                  text="Bulk Import"
                  variant="secondary"
                  onClick={() => setShowBulkImportModal(true)}
                />
                <CustomButton text="Add Faculty +" onClick={() => openForm()} />
              </div>
            }
            
            actions={[
              {
                icon: <i className="fa-solid fa-pen-to-square"></i>,
                tooltip: 'Edit',
                onClick: (facultyData) => openForm(facultyData),
              },
              ...(features.research_profile ? [{
                icon: <i className="fa fa-user-circle"></i>,
                tooltip: 'Research Profile',
                onClick: (facultyData) => navigate(`/faculty/${facultyData.faculty_code}/profile`),
              }] : []),
            ]}
          />
          <CustomModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
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
            formatString="full_name,email,phone,designation,faculty_code,department_code,expertise"
            infoNodes={
              <>
                <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Required for new faculty:</strong> full_name, email, designation, faculty_code, department_code
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  Imported faculty are added as internal faculty.
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Existing faculty matched by email will be updated with provided non-empty fields (including area of expertise).
                </p>
              </>
            }
            sampleFileName="faculty_bulk_import_sample.csv"
            sampleCsvContent={facultySampleCsv}
            onImport={handleBulkImport}
            submitting={submitting}
            uploadProgress={uploadProgress}
          />
        </>
      }
    />
  );
};

export default FacultyPage;
