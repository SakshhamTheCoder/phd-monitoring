import React, { useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import UserForm from '../../components/userForm/UserForm';
import NewUserKindPicker from '../../components/userForm/NewUserKindPicker';
import StudentForm from '../../components/studentForm/StudentForm';
import FacultyForm from '../../components/facultyForm/FacultyForm';
import { baseURL } from '../../api/urls';
import CustomButton from '../../components/forms/fields/CustomButton';
import { customFetch } from '../../api/base';

const UsersPage = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Which creation flow the admin picked: null (picker showing), 'student',
  // 'faculty' or 'other'. Only used when creating, editing goes straight to
  // UserForm as before.
  const [createKind, setCreateKind] = useState(null);
  const { setLoading } = useLoading();
  const location = useLocation();

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const downloadSampleCSV = () => {
    const csvContent = `first_name,last_name,email,phone,gender,role,available_roles,status
John,Doe,john.doe@example.com,1234567890,male,student,,active
Jane,Smith,jane.smith@example.com,9876543210,female,faculty,"faculty,doctoral",active`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'users_bulk_import_sample.csv';
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
          const rowData = { _rowNumber: index + 2 };
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
      try {
        const res = await customFetch(baseURL + `/users/${data.id}`, 'GET');
        setEditData(res.response
        );
        setIsOpen(true);
      } catch (error) {
        toast.error('Failed to load user data');
      }
      setLoading(false);
    } else {
      // Creating: start at the kind picker rather than the bare user form, so
      // the student/faculty record gets created alongside the login.
      setEditData(null);
      setCreateKind(null);
      setIsOpen(true);
    }
  };

  // `saved` distinguishes a successful save from a dismissal. Re-keying the
  // table refetches it, so doing that on every close made cancelling or hitting
  // the X reload the whole list for nothing.
  const closeUserModal = (saved = false) => {
    setIsOpen(false);
    setEditData(null);
    setCreateKind(null);
    if (saved) {
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleDeleteUser = async (userData) => {
    if (!window.confirm(`Are you sure you want to delete ${userData.name || 'this user'}? This action cannot be undone.`)) {
      return;
    }

    const result = await customFetch(baseURL + `/users/${userData.id}`, 'DELETE', {}, true);
    if (result.success) {
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleResetPassword = async (userData) => {
    const newPassword = window.prompt(`Enter a new password for ${userData.name || 'this user'} (min 8 characters):`);
    if (newPassword === null) {
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    await customFetch(
      baseURL + `/users/${userData.id}/reset-password`,
      'POST',
      { password: newPassword },
      true
    );
  };

  const handleBulkImport = async () => {
    if (!csvFile || !csvPreview) {
      toast.error('Please select a CSV file');
      return;
    }

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
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          email: row.email || '',
          phone: row.phone || '',
          gender: row.gender || '',
          role: row.role || '',
          available_roles: row.available_roles || '',
          status: row.status || 'active',
          row_number: row._rowNumber
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          try {
            const response = await fetch(`${baseURL}/users/bulk-import`, {
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
          <PageHeader title="Manage Users" subtitle="Create accounts and assign roles." />
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
                <CustomButton text="Add User +" onClick={() => openForm()} />
              </div>
            }
            actions={[
              {
                icon: <i className="fa-solid fa-pen-to-square"></i>,
                tooltip: 'Edit',
                onClick: (userData) => openForm(userData),
              },
              {
                icon: <i className="fa-solid fa-key"></i>,
                tooltip: 'Reset Password',
                onClick: (userData) => handleResetPassword(userData),
              },
              {
                icon: <i className="fa-solid fa-trash"></i>,
                tooltip: 'Delete',
                onClick: (userData) => handleDeleteUser(userData),
              },
            ]}
          />
          <CustomModal
            isOpen={isOpen}
            onClose={() => closeUserModal(false)}
            width={createKind === null && !editData ? '520px' : '80vw'}
          >
            {/* These forms only invoke onSuccess/onClose after a save completes,
                so those close with saved=true. The modal's own X and the picker's
                Cancel are dismissals and close without refetching. */}
            {editData ? (
              // Editing an existing user is unchanged, since the record already
              // exists there is nothing to pick.
              <UserForm edit={true} userData={editData} onClose={() => closeUserModal(true)} />
            ) : createKind === null ? (
              <NewUserKindPicker onSelect={setCreateKind} onCancel={() => closeUserModal(false)} />
            ) : createKind === 'student' ? (
              // Creates the User and Student record in one call.
              <StudentForm onSuccess={() => closeUserModal(true)} onClose={() => closeUserModal(true)} />
            ) : createKind === 'faculty' ? (
              // Creates the User and Faculty record in one call.
              <FacultyForm onSuccess={() => closeUserModal(true)} onClose={() => closeUserModal(true)} />
            ) : (
              <UserForm edit={false} userData={null} onClose={() => closeUserModal(true)} />
            )}
          </CustomModal>

          {/* Bulk Import Modal */}
          <CustomModal
            isOpen={showBulkImportModal}
            onClose={() => {
              setShowBulkImportModal(false);
              setCsvFile(null);
              setCsvPreview(null);
            }}
            title="Bulk Import Users"
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
                  <strong>CSV Format:</strong>
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', fontFamily: 'monospace', background: '#e0f2fe', padding: '0.5rem', borderRadius: '0.25rem' }}>
                  first_name,last_name,email,phone,gender,role,available_roles,status
                </p>
                <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Required:</strong> first_name, email, phone, role
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  <strong>Optional:</strong> last_name, gender (male/female/other), available_roles (comma-separated), status (active/inactive/suspended)
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
                    background: submitting || !csvFile ? '#9ca3af' : 'var(--primary-color)',
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

export default UsersPage;
