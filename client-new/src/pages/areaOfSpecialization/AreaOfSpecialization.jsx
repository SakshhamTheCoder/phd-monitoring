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
      });
    } else {
      setEditData(null);
      setFormData({
        name: '',
        department_id: '',

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

    const {
      imported_count: added = 0,
      removed_count: removed = 0,
      kept_in_use: kept = [],
      ignored_columns: ignored = [],
      errors = [],
    } = response.response || {};

    toast.success(`${added} areas added, ${removed} unused areas removed`);
    if (ignored.length) {
      toast.warn(`No department matches these columns, so they were skipped: ${ignored.join(', ')}`);
    }
    kept.forEach((area) => toast.info(`${area} is in use, so it was kept`));
    errors.forEach((message) => toast.warn(message));

    reset();
    setIsUploadModalOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  const AREA_HEADERS = 'name,department_code';

  const areaSampleCsv = `${AREA_HEADERS}
Machine Learning,CSED
Data Science,CSED`;

  return (
    <Layout>
      <div className="area-specialization-page">
        <PageHeader
          title="Areas of Specialization"
          subtitle="The research areas each department offers."
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
          required={['name', 'department_code']}
          rules={[
              "The institute's matrix also loads as it is: one column per department code, one area per cell.",
              'An area already on the list is left alone, so the same file can be loaded twice.',
              'An area the sheet drops is removed only when no scholar or faculty member points at it.',
            ]}
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
