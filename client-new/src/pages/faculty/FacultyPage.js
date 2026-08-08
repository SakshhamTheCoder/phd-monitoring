import React, { useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLoading } from '../../context/LoadingContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import FacultyForm from '../../components/facultyForm/FacultyForm'; // assume it's placed here
import { baseURL } from '../../api/urls';
import CustomButton from '../../components/forms/fields/CustomButton';

const FacultyPage = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const downloadSampleCSV = () => {
    const csvContent = `first_name,last_name,email,phone,designation,type,faculty_code,department_code,institution,website_link
John,Doe,john.doe@example.com,1234567890,Professor,internal,FAC001,CSED,Thapar Institute of Engineering and Technology,https://johndoe.com
Jane,,jane.smith@example.com,9876543210,Associate Professor,external,,CHED,External University Name,https://janesmith.com`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'faculty_bulk_import_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Sample CSV downloaded successfully');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCsvFile(null);
      setCsvPreview(null);
      return;
    }

    setCsvFile(file);

    // Parse CSV for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').filter(row => row.trim());
        
        if (rows.length === 0) {
          toast.error('CSV file is empty');
          setCsvPreview(null);
          return;
        }

        const headers = rows[0].split(',').map(h => h.trim());
        const data = rows.slice(1).map((row, index) => {
          const values = row.split(',').map(v => v.trim());
          const rowData = { _rowNumber: index + 2 }; // +2 because header is row 1
          headers.forEach((header, i) => {
            rowData[header] = values[i] || '';
          });
          return rowData;
        });

        setCsvPreview({ headers, data });
      } catch (error) {
        toast.error('Failed to parse CSV file');
        setCsvPreview(null);
      }
    };
    reader.readAsText(file);
  };

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

  const handleBulkImport = async () => {
    if (!csvFile || !csvPreview) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);
      
      const BATCH_SIZE = 50; // Process 50 rows at a time
      const totalRows = csvPreview.data.length;
      const batches = [];
      
      // Split data into batches
      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        batches.push(csvPreview.data.slice(i, i + BATCH_SIZE));
      }

      let totalSuccess = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let allErrors = [];
      let allCreatedDepartments = new Set();

      // Get fresh token before starting
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please login again.');
        setLoading(false);
        setSubmitting(false);
        return;
      }

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Update progress
        setUploadProgress({
          current: (batchIndex + 1) * BATCH_SIZE > totalRows ? totalRows : (batchIndex + 1) * BATCH_SIZE,
          total: totalRows,
          percentage: Math.round(((batchIndex + 1) / batches.length) * 100)
        });

        // Prepare batch data
        const batchData = batch.map(row => ({
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          email: row.email || '',
          phone: row.phone || '',
          designation: row.designation || '',
          type: row.type || '',
          faculty_code: row.faculty_code || '',
          department_code: row.department_code || '',
          institution: row.institution || '',
          website_link: row.website_link || '',
          row_number: row._rowNumber
        }));

        // Send batch to server with retry logic
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

            // Check for redirect (302) - authentication issue
            if (response.status === 302 || response.redirected) {
              toast.error('Session expired. Please login again.');
              setLoading(false);
              setSubmitting(false);
              return;
            }

            // Try to parse JSON response
            let data;
            try {
              data = await response.json();
            } catch (jsonError) {
              console.error('Failed to parse response:', jsonError);
              throw new Error('Invalid server response');
            }

            // Check HTTP status
            if (!response.ok) {
              if (retryCount < maxRetries) {
                console.log(`Batch ${batchIndex + 1} failed, retrying... (${retryCount + 1}/${maxRetries})`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                continue;
              }
              
              toast.error(`Batch ${batchIndex + 1} failed after ${maxRetries} retries: ${data.message || 'Server error'}`);
              totalErrors += batch.length;
              break;
            }

            if (data.success) {
              totalSuccess += data.data.success_count || 0;
              totalUpdated += data.data.update_count || 0;
              totalErrors += data.data.error_count || 0;
              allErrors = allErrors.concat(data.data.errors || []);
              
              if (data.data.created_departments) {
                data.data.created_departments.forEach(dept => allCreatedDepartments.add(dept));
              }
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
            console.error(`Batch ${batchIndex + 1} error:`, fetchError);
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

      // Show final results
      toast.success(`Import completed: ${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors`);
      
      if (allCreatedDepartments.size > 0) {
        toast.info(`Auto-created departments: ${Array.from(allCreatedDepartments).join(', ')}`);
      }
      
      if (allErrors.length > 0) {
        console.log('Import errors:', allErrors);
        toast.warning(`${totalErrors} rows failed. Check console for details.`);
      }

      setShowBulkImportModal(false);
      setCsvFile(null);
      setCsvPreview(null);
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
              <div style={{ display: 'flex', gap: '10px' }}>
                <CustomButton
                  text="Bulk Import CSV"
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
              {
                icon: <i className="fa fa-user-circle"></i>,
                tooltip: 'Research Profile',
                onClick: (facultyData) => navigate(`/faculty/${facultyData.faculty_code}/profile`),
              },
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
          <CustomModal
            isOpen={showBulkImportModal}
            onClose={() => {
              setShowBulkImportModal(false);
              setCsvFile(null);
              setCsvPreview(null);
            }}
            title="Bulk Import Faculty"
            width="90vw"
          >
            <div className="modal-form">
              <div className="info-box" style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>CSV Format (unified for all faculty):</strong>
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', fontFamily: 'monospace', background: '#e0f2fe', padding: '0.5rem', borderRadius: '0.25rem' }}>
                  first_name,last_name,email,phone,designation,type,faculty_code,department_code,institution,website_link
                </p>
                <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Required for all:</strong> first_name, email, phone, designation, type (internal/external)
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Optional for all:</strong> last_name, website_link
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  <strong>For internal:</strong> faculty_code and department_code are required, institution is optional (defaults to Thapar).<br/>
                  <strong>For external:</strong> institution is required, faculty_code is auto-generated (leave empty), department_code is optional.<br/>
                  If a faculty with the same email exists, their record will be updated.
                </p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <CustomButton
                  text="Download Sample CSV"
                  onClick={downloadSampleCSV}
                  style={{
                    backgroundColor: '#FF9800',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: '500',
                    marginBottom: '1rem'
                  }}
                />
              </div>
              
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
              />

              {csvPreview && (
                <div style={{
                  marginTop: '1rem',
                  marginBottom: '1rem',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{
                    padding: '0.75rem',
                    background: '#f9fafb',
                    borderBottom: '1px solid #d1d5db',
                    fontWeight: '600'
                  }}>
                    Preview: {csvPreview.data.length} row(s) found
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.875rem'
                    }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', textAlign: 'left' }}>Row</th>
                          {csvPreview.headers.map((header, i) => (
                            <th key={i} style={{ padding: '0.5rem', border: '1px solid #d1d5db', textAlign: 'left', whiteSpace: 'nowrap' }}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.data.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                            <td style={{ padding: '0.5rem', border: '1px solid #d1d5db', fontWeight: '500', color: '#6b7280' }}>
                              {row._rowNumber}
                            </td>
                            {csvPreview.headers.map((header, j) => (
                              <td key={j} style={{ padding: '0.5rem', border: '1px solid #d1d5db' }}>
                                {row[header] || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>empty</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {uploadProgress && (
                <div style={{
                  marginTop: '1rem',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#0369a1'
                  }}>
                    <span>Processing...</span>
                    <span>{uploadProgress.current} / {uploadProgress.total} rows ({uploadProgress.percentage}%)</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#e0f2fe',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${uploadProgress.percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}
              
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                marginTop: '1rem'
              }}>
                <button
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setCsvFile(null);
                    setCsvPreview(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={submitting || !csvFile}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: submitting || !csvFile ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: submitting || !csvFile ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </CustomModal>
        </>
      }
    />
  );
};

export default FacultyPage;
