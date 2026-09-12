import React, { useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import PageHeader from '../../components/pageHeader/PageHeader';
import CustomButton from '../../components/forms/fields/CustomButton';
import GridContainer from '../../components/forms/fields/GridContainer';
import InputField from '../../components/forms/fields/InputField';
import DropdownField from '../../components/forms/fields/DropdownField';
import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
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
  const [submitting, setSubmitting] = useState(false);
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
        toast.success(editData ? 'Area updated.' : 'Area added.');
        setIsOpen(false);
        setRefreshKey((prev) => prev + 1);
      } else {
        toast.error(response.message || (editData ? 'Failed to update area.' : 'Failed to add area.'));
      }
    } catch (error) {
      toast.error('Failed to save area of specialization.');
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
        toast.success('Area deleted.');
        setRefreshKey((prev) => prev + 1);
      } else {
        toast.error(response.message || 'Failed to delete area.');
      }
    } catch (error) {
      toast.error('Failed to delete area of specialization.');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (preview, reset) => {
    setSubmitting(true);

    const response = await customFetch(
      `${baseURL}/departments/area-of-specialization/import`,
      'POST',
      { rows: preview.data },
      false
    );

    setSubmitting(false);

    if (!response.success) {
      toast.error(response.response?.message || 'Failed to import areas');
      return;
    }

    const { imported_count: added = 0, removed_count: removed = 0, kept_in_use: kept = [], errors = [] } =
      response.response || {};

    toast.success(`${added} areas added, ${removed} unused areas removed`);
    kept.forEach((area) => toast.info(`${area} is in use, so it was kept`));
    errors.forEach((message) => toast.warn(message));

    reset();
    setIsUploadModalOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  const AREA_HEADERS = 'name,department_code,expert_name,expert_email,expert_phone,expert_college,expert_designation,expert_website';

  const areaSampleCsv = `${AREA_HEADERS}
Machine Learning,CSED,Expert One,expert.one@example.edu,9800000041,IIT Delhi,Professor,https://example.edu/one
Data Science,CSED,Expert Two,expert.two@example.edu,9800000042,IIT Bombay,Associate Professor,`;

  return (
    <Layout>
      <div className="area-specialization-page">
        <PageHeader
          title="Areas of Specialization"
          subtitle="Research areas and the experts associated with each department."
        />

        {/* <FilterBar onSearch={handleFilterChange} /> */}
        
        <PagenationTable
          key={refreshKey}
          endpoint="/departments/area-of-specialization/list"

          enableApproval={false}
          customOpenForm={openForm}
          extraTopbarComponents={
            <div className="top-actions">
              <CustomButton
                text="Bulk Import"
                variant="secondary"
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

        <UnifiedBulkImportModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Bulk Import Research Areas"
          formatString={AREA_HEADERS}
          infoNodes={
            <>
              <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}>
                The institute's matrix also loads as it is: one column per department code,
                one area per cell.
              </p>
              <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                An area already on the list is left alone, so the same file can be loaded twice.
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                An area the sheet drops is removed only when no scholar or faculty member
                points at it. One in use is kept and named back to you.
              </p>
            </>
          }
          sampleFileName="research_areas_sample.csv"
          sampleCsvContent={areaSampleCsv}
          onImport={handleCSVUpload}
          submitting={submitting}
        />
      </div>
    </Layout>
  );
};

export default AreaOfSpecialization;
