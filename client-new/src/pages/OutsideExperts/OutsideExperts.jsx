import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { baseURL } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import FilterBar from '../../components/filterBar/FilterBar';
import CustomModal from '../../components/forms/modal/CustomModal';
import Page from '../../components/page/Page';
import CustomButton from '../../components/forms/fields/CustomButton';
import OutsideExpertFields, { EMPTY_EXPERT } from '../../components/outsideExperts/OutsideExpertFields';

// The header row the import expects, in order.
const EXPERT_CSV_COLUMNS = ['full_name', 'email', 'phone', 'designation', 'department', 'institution', 'area_of_expertise', 'website'];

const OutsideExperts = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState([]);
  const { setLoading } = useLoading();
  const [submitting, setSubmitting] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState(EMPTY_EXPERT);
  
  const [editingExpert, setEditingExpert] = useState(null);
  const [csvFile, setCsvFile] = useState(null);

  // A refused save answers 422 with a bare "Validation failed"; the field
  // errors beside it are what say which field to fix.
  const failureMessage = (result, fallback) => {
    if (result.networkError) return NETWORK_ERROR_MESSAGE;
    const { errors, message } = result.response || {};
    return errors ? Object.values(errors).flat().join(' ') : message || fallback;
  };

  const handleAddExpert = async () => {
    try {
      setSubmitting(true);
      setLoading(true);
      const response = await customFetch(`${baseURL}/outside-experts/add`, 'POST', formData, false);
      
      if (response.success) {
        toast.success('Outside expert added successfully');
        setShowAddModal(false);
        resetForm();
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(failureMessage(response, 'Failed to add outside expert'));
      }
    } catch (error) {
      console.error('Error adding outside expert:', error);
      toast.error('Failed to add outside expert');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleEditExpert = async () => {
    try {
      setSubmitting(true);
      setLoading(true);
      const response = await customFetch(`${baseURL}/outside-experts/update/${editingExpert.id}`, 'PUT', formData, false);
      
      if (response.success) {
        toast.success('Outside expert updated successfully');
        setShowEditModal(false);
        resetForm();
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(failureMessage(response, 'Failed to update outside expert'));
      }
    } catch (error) {
      console.error('Error updating outside expert:', error);
      toast.error('Failed to update outside expert');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleDeleteExpert = async (expertId) => {
    if (!window.confirm('Are you sure you want to delete this outside expert?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await customFetch(`${baseURL}/outside-experts/delete/${expertId}`, 'DELETE', {}, false);
      
      if (response.success) {
        toast.success('Outside expert deleted successfully');
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(failureMessage(response, 'Failed to delete outside expert'));
      }
    } catch (error) {
      console.error('Error deleting outside expert:', error);
      toast.error('Failed to delete outside expert');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);
      
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(`${baseURL}/outside-experts/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const { success_count = 0, update_count = 0, errors = [] } = data.data || {};
        if (success_count + update_count > 0) toast.success(data.message);
        else toast.error(data.message);
        if (errors.length > 0) {
          const more = errors.length > 3 ? `; and ${errors.length - 3} more` : '';
          toast.warning(`Check these rows: ${errors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
        }
        setShowBulkImportModal(false);
        setCsvFile(null);
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(data.message || 'Failed to import');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import CSV');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const openEditModal = (expert) => {
    setEditingExpert(expert);
    const fullName = [expert.first_name, expert.last_name]
      .map((p) => (p || '').trim())
      .filter(Boolean)
      .join(' ');
    setFormData({
      full_name: expert.name || fullName,
      designation: expert.designation,
      department: expert.department,
      institution: expert.institution,
      email: expert.email,
      phone: expert.phone || '',
      area_of_expertise: expert.area_of_expertise || '',
      website: expert.website || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData(EMPTY_EXPERT);
    setEditingExpert(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Page
      title="Outside experts"
      description="External examiners and experts available to committees."
      actions={
        <>
          <CustomButton
            text="Import from CSV"
            variant="secondary"
            onClick={() => setShowBulkImportModal(true)}
          />
          <CustomButton
            text="Add outside expert"
            onClick={() => setShowAddModal(true)}
          />
        </>
      }
    >
      <PagenationTable
        key={refreshKey}
        endpoint="/outside-experts/list"
        filters={filters}
        search={<FilterBar path="/outside-experts" onSearch={setFilters} />}
        // No detail page for an expert; editing is in the row menu.
        rowClickable={false}
        enableApproval={false}
        actions={[
          {
            icon: <i className="fa fa-pencil-square-o"></i>,
            tooltip: 'Edit',
            onClick: (data) => openEditModal(data),
          },
          {
            icon: <i className="fa fa-trash"></i>,
            tooltip: 'Delete',
            onClick: (data) => handleDeleteExpert(data.id),
          },
        ]}
      />

    {/* Add Expert Modal */}
    <CustomModal
      isOpen={showAddModal}
      onClose={() => {
        setShowAddModal(false);
        resetForm();
      }}
      title="Add new outside expert"
      closeOnOutsideClick={false}
    >
      <>
        <OutsideExpertFields values={formData} onChange={handleInputChange} />

        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="quiet"
            onClick={() => {
              setShowAddModal(false);
              resetForm();
            }}
          />
          <CustomButton
            text="Add expert"
            onClick={handleAddExpert}
            busy={submitting}
          />
        </div>
      </>
    </CustomModal>

    {/* Bulk Import Modal */}
    <CustomModal
      isOpen={showBulkImportModal}
      onClose={() => {
        setShowBulkImportModal(false);
        setCsvFile(null);
      }}
      title="Import outside experts from CSV"
    >
      <>
        <section className="csv-import-section">
          <h4 className="csv-import-heading">CSV format</h4>
          <ul className="csv-import-columns">
            {EXPERT_CSV_COLUMNS.map((column) => <li key={column}>{column}</li>)}
          </ul>
          <p className="csv-import-note">Note: Phone, area_of_expertise, and website are optional. If an expert with the same email exists, their record will be updated.</p>
        </section>

        <div className="csv-import-file">
          <input
            type="file"
            accept=".csv"
            aria-label="Choose a CSV file to import"
            onChange={(e) => setCsvFile(e.target.files[0])}
            className="csv-import-input"
          />
        </div>
          
        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="quiet"
            onClick={() => {
              setShowBulkImportModal(false);
              setCsvFile(null);
            }}
          />
          <CustomButton
            text="Import"
            onClick={handleBulkImport}
            busy={submitting}
            disabled={!csvFile}
          />
        </div>
      </>
    </CustomModal>

    {/* Edit Expert Modal */}
    <CustomModal
      isOpen={showEditModal}
      onClose={() => {
        setShowEditModal(false);
        resetForm();
      }}
      title="Edit outside expert"
      closeOnOutsideClick={false}
    >
      <>
        <OutsideExpertFields values={formData} onChange={handleInputChange} />

        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="quiet"
            onClick={() => {
              setShowEditModal(false);
              resetForm();
            }}
          />
          <CustomButton
            text="Update expert"
            onClick={handleEditExpert}
            busy={submitting}
          />
        </div>
      </>
    </CustomModal>
    </Page>
  );
};

export default OutsideExperts;
