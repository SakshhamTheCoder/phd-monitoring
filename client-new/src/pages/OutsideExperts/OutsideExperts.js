import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import Layout from '../../components/dashboard/layout';
import { useLoading } from '../../context/LoadingContext';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import PageHeader from '../../components/pageHeader/PageHeader';
import CustomButton from '../../components/forms/fields/CustomButton';
import InputField from '../../components/forms/fields/InputField';
import GridContainer from '../../components/forms/fields/GridContainer';

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
    first_name: '',
    last_name: '',
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
        toast.success(data.message);
        if (data.data.errors.length > 0) {
          console.log('Import errors:', data.data.errors);
          toast.info(`Check console for ${data.data.error_count} errors`);
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
    setFormData({
      first_name: expert.first_name,
      last_name: expert.last_name,
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
      first_name: '',
      last_name: '',
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
          enableApproval={false}
          extraTopbarComponents={
            <div className="top-actions">
              <CustomButton
                text="Bulk Import CSV"
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
              icon: <i className="fa-solid fa-pen-to-square"></i>,
              tooltip: 'Edit',
              onClick: (data) => openEditModal(data),
            },
            {
              icon: <i className="fa-solid fa-trash"></i>,
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
                label="First Name"
                initialValue={formData.first_name}
                onChange={(value) => handleInputChange('first_name', value)}
                placeholder="Enter first name"
                required
              />,
              <InputField
                label="Last Name"
                initialValue={formData.last_name}
                onChange={(value) => handleInputChange('last_name', value)}
                placeholder="Enter last name"
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
            <p>first_name,last_name,email,phone,designation,department,institution,area_of_expertise,website</p>
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
                label="First Name"
                initialValue={formData.first_name}
                onChange={(value) => handleInputChange('first_name', value)}
                required
              />,
              <InputField
                label="Last Name"
                initialValue={formData.last_name}
                onChange={(value) => handleInputChange('last_name', value)}
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

      <style jsx>{`
        .outside-experts-management {
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 1rem;
        }

        .info-box {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .info-box p {
          margin: 0.25rem 0;
          font-size: 0.875rem;
        }

        .info-box .note {
          color: #6b7280;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }

        .file-input {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 1rem;
          cursor: pointer;
        }
      `}</style>
    </div>
    </Layout>
  );
};

export default OutsideExperts;
