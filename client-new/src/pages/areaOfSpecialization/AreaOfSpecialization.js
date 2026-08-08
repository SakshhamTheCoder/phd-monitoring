import React, { useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import GridContainer from '../../components/forms/fields/GridContainer';
import InputField from '../../components/forms/fields/InputField';
import DropdownField from '../../components/forms/fields/DropdownField';
import FileUploadField from '../../components/forms/fields/FileUploadField';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import './AreaOfSpecialization.css';

const AreaOfSpecialization = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    department_id: '',
    expert_name: '',
    expert_email: '',
    expert_phone: '',
    expert_college: '',
    expert_designation: '',
    expert_website: '',
  });
  const [csvFile, setCsvFile] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setLoading } = useLoading();
  const location = useLocation();

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await customFetch(baseURL + '/departments', 'GET', {}, false);
      if (response.success || response.data) {
        const deptData = response.data || response.response?.data || [];
        setDepartments(
          deptData.map((dept) => ({
            title: dept.name,
            value: dept.id,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const openForm = (data = null) => {
    if (data) {
      setEditData(data);
      setFormData({
        name: data.name || '',
        department_id: data.department_id || '',
        expert_name: data.expert_name || '',
        expert_email: data.expert_email || '',
        expert_phone: data.expert_phone || '',
        expert_college: data.expert_college || '',
        expert_designation: data.expert_designation || '',
        expert_website: data.expert_website || '',
      });
    } else {
      setEditData(null);
      setFormData({
        name: '',
        department_id: '',
        expert_name: '',
        expert_email: '',
        expert_phone: '',
        expert_college: '',
        expert_designation: '',
        expert_website: '',

      });
    }
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.department_id) {
      toast.error('Name and Department are required');
      return;
    }

    setLoading(true);
    try {
      const endpoint = editData
        ? `${baseURL}/departments/area-of-specialization/update/${editData.id}`
        : `${baseURL}/departments/area-of-specialization/add`;
      
      const method = editData ? 'PUT' : 'POST';

      const response = await customFetch(endpoint, method, formData, false);
      
      if (response.success) {
        toast.success(editData ? 'Area updated successfully' : 'Area added successfully');
        setIsOpen(false);
        setRefreshKey((prev) => prev + 1);
      } else {
        toast.error(response.message || 'Operation failed');
      }
    } catch (error) {
      toast.error('Failed to save area of specialization');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this area of specialization?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await customFetch(
        `${baseURL}/departments/area-of-specialization/delete/${id}`,
        'DELETE',
        {},
        false
      );
      
      if (response.success) {
        toast.success('Area deleted successfully');
        setRefreshKey((prev) => prev + 1);
      } else {
        toast.error(response.message || 'Delete failed');
      }
    } catch (error) {
      toast.error('Failed to delete area of specialization');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setLoading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('csv_file', csvFile);

      const response = await fetch(`${baseURL}/departments/area-of-specialization/import`, {
        method: 'POST',
        body: formDataUpload,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully imported ${result.imported_count || 0} areas`);
        setIsUploadModalOpen(false);
        setCsvFile(null);
        setRefreshKey((prev) => prev + 1);
      } else {
        toast.error(result.message || 'Import failed');
      }
    } catch (error) {
      toast.error('Failed to upload CSV file');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent = 'name,department_id,expert_name,expert_email,expert_phone,expert_college,expert_designation,expert_website\n' +
      'Machine Learning,1,Dr. John Doe,john@example.com,1234567890,MIT,Professor,http://johndoe.com\n' +
      'Data Science,1,Dr. Jane Smith,jane@example.com,0987654321,Stanford,Associate Professor,http://janesmith.com';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'area_of_specialization_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="area-specialization-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Area of Specialization Management</h1>
            <p className="page-subtitle">Manage research areas and associated experts for each department</p>
          </div>
        </div>

        {/* <FilterBar onSearch={handleFilterChange} /> */}
        
        <PagenationTable
          key={refreshKey}
          endpoint="/departments/area-of-specialization/list"

          enableApproval={false}
          customOpenForm={openForm}
          extraTopbarComponents={
            <div className="top-actions">
              <CustomButton 
                text="Upload CSV" 
                onClick={() => setIsUploadModalOpen(true)} 
              />
              <CustomButton 
                text="Add Area +" 
                onClick={() => openForm()} 
              />
            </div>
          }
          actions={[
            {
              icon: <i className="fa-solid fa-pen-to-square"></i>,
              tooltip: 'Edit',
              onClick: (data) => openForm(data),
            },
            {
              icon: <i className="fa-solid fa-trash"></i>,
              tooltip: 'Delete',
              onClick: (data) => handleDelete(data.id),
            },
          ]}
        />

        {/* Add/Edit Modal */}
        <CustomModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={editData ? 'Edit Area of Specialization' : 'Add Area of Specialization'}
          minWidth="600px"
          maxWidth="800px"
        >
          <div className="form-container">
            <GridContainer
              elements={[
                <InputField
                  label="Area Name"
                  initialValue={formData.name}
                  onChange={(value) => setFormData({ ...formData, name: value })}
                  hint="e.g., Machine Learning, Data Science"
                />,
                <DropdownField
                  label="Department"
                  initialValue={formData.department_id}
                  options={departments}
                  onChange={(value) => setFormData({ ...formData, department_id: value })}
                />,
              ]}
            />

            <div className="section-divider">
              <h3>Expert Information (Optional)</h3>
            </div>

            <GridContainer
              elements={[
                <InputField
                  label="Expert Name"
                  initialValue={formData.expert_name}
                  onChange={(value) => setFormData({ ...formData, expert_name: value })}
                  hint="Name of the subject matter expert"
                />,
                <InputField
                  label="Expert Email"
                  initialValue={formData.expert_email}
                  onChange={(value) => setFormData({ ...formData, expert_email: value })}
                  hint="Email address"
                />,
              ]}
            />

            <GridContainer
              elements={[
                <InputField
                  label="Expert Phone"
                  initialValue={formData.expert_phone}
                  onChange={(value) => setFormData({ ...formData, expert_phone: value })}
                  hint="Contact number"
                />,
                <InputField
                  label="Expert College/Institution"
                  initialValue={formData.expert_college}
                  onChange={(value) => setFormData({ ...formData, expert_college: value })}
                  hint="Institution name"
                />,
              ]}
            />
            

            <GridContainer
              elements={[
                <InputField
                  label="Expert Designation"
                  initialValue={formData.expert_designation}
                  onChange={(value) => setFormData({ ...formData, expert_designation: value })}
                  hint="Designation of the expert"
                />,
                <InputField
                  label="Expert Website"
                  initialValue={formData.expert_website}
                  onChange={(value) => setFormData({ ...formData, expert_website: value })}
                  hint="Website URL"
                />,
              ]}
            />

            <GridContainer
              elements={[
                <CustomButton text="Cancel" onClick={() => setIsOpen(false)} />,
                <CustomButton text={editData ? 'Update' : 'Add'} onClick={handleSubmit} />,
              ]}
            />
          </div>
        </CustomModal>

        {/* CSV Upload Modal */}
        <CustomModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setCsvFile(null);
          }}
          title="Import Areas from CSV"
          minWidth="500px"
          maxWidth="600px"
        >
          <div className="upload-container">
            <div className="upload-info">
              <p>Upload a CSV file to import multiple areas of specialization at once.</p>
              <p className="note">
                <strong>Note:</strong> CSV should have columns: name, department_id, expert_name, 
                expert_email, expert_phone, expert_college
              </p>
              <CustomButton 
                text="Download CSV Template" 
                onClick={downloadCSVTemplate} 
              />
            </div>

            <GridContainer
              elements={[
                <FileUploadField
                  label="Select CSV File"
                  showLabel={true}
                  onChange={(file) => setCsvFile(file)}
                  accept=".csv"
                />,
              ]}
              space={2}
            />

            <GridContainer
              elements={[
                <CustomButton 
                  text="Cancel" 
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setCsvFile(null);
                  }} 
                />,
                <CustomButton text="Upload" onClick={handleCSVUpload} />,
              ]}
            />
          </div>
        </CustomModal>
      </div>
    </Layout>
  );
};

export default AreaOfSpecialization;
