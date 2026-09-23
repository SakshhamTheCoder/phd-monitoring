import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { baseURL } from '../../api/urls';
import Layout from '../../components/dashboard/layout';
import { useLoading } from '../../context/LoadingContext';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import PageHeader from '../../components/pageHeader/PageHeader';
import CustomButton from '../../components/forms/fields/CustomButton';
import InputField from '../../components/forms/fields/InputField';
import GridContainer from '../../components/forms/fields/GridContainer';
import './OutsideExperts.css';

const OutsideExperts = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { setLoading } = useLoading();
  const [submitting, setSubmitting] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    full_name: '',
    designation: '',
    department: '',
    institution: '',
    email: '',
    phone: '',
    area_of_expertise: '',
    website: '',
  });
  
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
    setFormData({
      full_name: '',
      designation: '',
      department: '',
      institution: '',
      email: '',
      phone: '',
      area_of_expertise: '',
      website: '',
    });
    setEditingExpert(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <div className="outside-experts-management">
        <PageHeader
          title="Outside Experts"
          subtitle="External examiners and experts available to committees."
        />
        <PagenationTable
          key={refreshKey}
          endpoint="/outside-experts/list"
          // No detail page for an expert; editing is in the row menu.
          rowClickable={false}
          enableApproval={false}
          extraTopbarComponents={
            <div className="top-actions">
              <CustomButton
                text="Bulk Import"
                variant="secondary"
                onClick={() => setShowBulkImportModal(true)}
              />
              <CustomButton
                text="Add Outside Expert +"
                onClick={() => setShowAddModal(true)}
              />
            </div>
          }
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
        title="Add New Outside Expert"
      >
        <div className="modal-form">
          <GridContainer
            elements={[
              <InputField
                label="Full Name"
                initialValue={formData.full_name}
                onChange={(value) => handleInputChange('full_name', value)}
                placeholder="e.g. Dr. Tarunpreet Bhatia"
                required
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Email"
                type="email"
                initialValue={formData.email}
                onChange={(value) => handleInputChange('email', value)}
                placeholder="expert@example.com"
                required
              />,
              <InputField
                label="Phone"
                initialValue={formData.phone}
                onChange={(value) => handleInputChange('phone', value)}
                placeholder="Enter phone number"
              />,
            ]}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Designation"
                initialValue={formData.designation}
                onChange={(value) => handleInputChange('designation', value)}
                placeholder="e.g., Professor"
                required
              />,
              <InputField
                label="Department"
                initialValue={formData.department}
                onChange={(value) => handleInputChange('department', value)}
                placeholder="e.g., Computer Science"
                required
              />,
            ]}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Institution"
                initialValue={formData.institution}
                onChange={(value) => handleInputChange('institution', value)}
                placeholder="e.g., University Name"
                required
              />,
            ]}
            space={2}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Area of Expertise"
                initialValue={formData.area_of_expertise}
                onChange={(value) => handleInputChange('area_of_expertise', value)}
                placeholder="Research areas"
              />,
            ]}
            space={2}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Website"
                initialValue={formData.website}
                onChange={(value) => handleInputChange('website', value)}
                placeholder="https://example.com"
              />,
            ]}
            space={2}
          />
          
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="custom-button custom-button--secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExpert}
              className="custom-button"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Expert'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Bulk Import Modal */}
      <CustomModal
        isOpen={showBulkImportModal}
        onClose={() => {
          setShowBulkImportModal(false);
          setCsvFile(null);
        }}
        title="Bulk Import Outside Experts"
      >
        <div className="modal-form">
          <div className="info-box">
            <p><strong>CSV Format:</strong></p>
            <p>full_name,email,phone,designation,department,institution,area_of_expertise,website</p>
            <p className="note">Note: Phone, area_of_expertise, and website are optional. If an expert with the same email exists, their record will be updated.</p>
          </div>
          
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files[0])}
            className="file-input"
          />
          
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowBulkImportModal(false);
                setCsvFile(null);
              }}
              className="custom-button custom-button--secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkImport}
              className="custom-button"
              disabled={submitting || !csvFile}
            >
              {submitting ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Edit Expert Modal */}
      <CustomModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Edit Outside Expert"
      >
        <div className="modal-form">
          <GridContainer
            elements={[
              <InputField
                label="Full Name"
                initialValue={formData.full_name}
                onChange={(value) => handleInputChange('full_name', value)}
                required
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Email"
                type="email"
                initialValue={formData.email}
                onChange={(value) => handleInputChange('email', value)}
                required
              />,
              <InputField
                label="Phone"
                initialValue={formData.phone}
                onChange={(value) => handleInputChange('phone', value)}
              />,
            ]}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Designation"
                initialValue={formData.designation}
                onChange={(value) => handleInputChange('designation', value)}
                required
              />,
              <InputField
                label="Department"
                initialValue={formData.department}
                onChange={(value) => handleInputChange('department', value)}
                required
              />,
            ]}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Institution"
                initialValue={formData.institution}
                onChange={(value) => handleInputChange('institution', value)}
                required
              />,
            ]}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Area of Expertise"
                initialValue={formData.area_of_expertise}
                onChange={(value) => handleInputChange('area_of_expertise', value)}
              />,
            ]}
          />
          
          <GridContainer
            elements={[
              <InputField
                label="Website"
                initialValue={formData.website}
                onChange={(value) => handleInputChange('website', value)}
              />,
            ]}
          />
          
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
              className="custom-button custom-button--secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleEditExpert}
              className="custom-button"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Expert'}
            </button>
          </div>
        </div>
      </CustomModal>

    </div>
    </Layout>
  );
};

export default OutsideExperts;
