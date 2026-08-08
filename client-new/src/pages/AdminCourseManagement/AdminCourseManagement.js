import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import Layout from '../../components/dashboard/layout';
import { useLoading } from '../../context/LoadingContext';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import DropdownField from '../../components/forms/fields/DropdownField';
import InputField from '../../components/forms/fields/InputField';
const AdminCourseManagement = () => {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setLoading } = useLoading();
  const [submitting, setSubmitting] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    course_code: '',
    course_name: '',
    credits: '',
    department_id: '',
  });
  
  const [editingCourse, setEditingCourse] = useState(null);
  
  const [tagData, setTagData] = useState({
    student_id: '',
    course_id: '',
    semester: '',
    status: 'enrolled',
    grade: '',
  });

  const [csvFile, setCsvFile] = useState(null);

  useEffect(() => {
    fetchDepartments();
    fetchStudents();
    fetchAllCourses();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await customFetch(`${baseURL}/departments`, 'GET');
      if (response.success) {
        setDepartments(response?.response?.data?.map(dept => ({
          value: dept.id,
          title: dept.name
        })));
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await customFetch(`${baseURL}/students/`, 'GET');
      if (response.success) {
        setStudents(response?.response?.data?.map(student => ({
          value: student.database_id || student.id,
          title: `${student.name} (${student.roll_no})`
        })));
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAllCourses = async () => {
    try {
      const response = await customFetch(`${baseURL}/courses/all`, 'GET');
      if (response.success) {
        setCourses(response.response.data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const validateCourseForm = () => {
    if (
      !`${formData.course_code}`.trim() ||
      !`${formData.course_name}`.trim() ||
      !`${formData.credits}`.trim()
    ) {
      toast.error('Course code, name and credits are required');
      return false;
    }
    if (isNaN(Number(formData.credits))) {
      toast.error('Credits must be a number');
      return false;
    }
    return true;
  };

  const handleAddCourse = async () => {
    if (!validateCourseForm()) {
      return;
    }
    try {
      setSubmitting(true);
      setLoading(true);
      const response = await customFetch(`${baseURL}/courses/add`, 'POST', formData, false);

      if (response.success) {
        toast.success('Course added successfully');
        setShowAddModal(false);
        resetForm();
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(response.response?.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error adding course:', error);
      toast.error('Failed to add course');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleEditCourse = async () => {
    if (!validateCourseForm()) {
      return;
    }
    try {
      setSubmitting(true);
      setLoading(true);
      const response = await customFetch(`${baseURL}/courses/update/${editingCourse.id}`, 'PUT', formData, false);

      if (response.success) {
        toast.success('Course updated successfully');
        setShowEditModal(false);
        resetForm();
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(response.response?.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await customFetch(`${baseURL}/courses/delete/${courseId}`, 'DELETE', {}, false);
      
      if (response.success) {
        toast.success('Course deleted successfully');
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(response.response?.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
    } finally {
      setLoading(false);
    }
  };

  const handleTagStudent = async () => {
    try {
      setSubmitting(true);
      setLoading(true);
      const response = await customFetch(`${baseURL}/courses/student/tag`, 'POST', tagData, false);
      
      if (response.success) {
        toast.success('Student tagged with course successfully');
        setShowTagModal(false);
        resetTagData();
        setRefreshKey(prev => prev + 1);
        fetchAllCourses();
      } else {
        toast.error(response.response?.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error tagging student:', error);
      toast.error('Failed to tag student');
    } finally {
      setLoading(false);
      setSubmitting(false);
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

      const response = await fetch(`${baseURL}/courses/student/bulk-import`, {
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

  const openEditModal = (course) => {
    setEditingCourse(course);
    setFormData({
      course_code: course.course_code,
      course_name: course.course_name,
      credits: course.credits,
      department_id: course.department_id,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      course_code: '',
      course_name: '',
      credits: '',
      department_id: '',
    });
    setEditingCourse(null);
  };

  const resetTagData = () => {
    setTagData({
      student_id: '',
      course_id: '',
      semester: '',
      status: 'enrolled',
      grade: '',
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTagInputChange = (field, value) => {
    setTagData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <div className="admin-course-management">
        <div className="page-header">
          <h1 className="page-title">Course Management</h1>
        </div>

        <PagenationTable
          key={refreshKey}
          endpoint="/courses/list"
          enableApproval={false}
          extraTopbarComponents={
            <div style={{ display: 'flex', gap: '10px' }}>
              <CustomButton
                text="Tag Student"
                variant="secondary"
                onClick={() => setShowTagModal(true)}
              />
              <CustomButton
                text="Bulk Import CSV"
                variant="secondary"
                onClick={() => setShowBulkImportModal(true)}
              />
              <CustomButton
                text="Add Course +"
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
              onClick: (data) => handleDeleteCourse(data.id),
            },
          ]}
        />

      {/* Add Course Modal */}
      <CustomModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add New Course"
        closeOnOutsideClick={false}
      >
        <div className="modal-form">
          <InputField
            label="Course Code"
            initialValue={formData.course_code}
            onChange={(value) => handleInputChange('course_code', value)}
            placeholder="e.g., CS101"
            required
          />
          
          <InputField
            label="Course Name"
            initialValue={formData.course_name}
            onChange={(value) => handleInputChange('course_name', value)}
            placeholder="e.g., Introduction to Computer Science"
            required
          />
          
          <InputField
            label="Credits"
            type="number"
            initialValue={formData.credits}
            onChange={(value) => handleInputChange('credits', value)}
            placeholder="e.g., 3"
            required
          />
          
          <DropdownField
            label="Department"
            options={departments}
            initialValue={formData.department_id}
            onChange={(value) => handleInputChange('department_id', value)}
            required
          />
          
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="secondary-button"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCourse}
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Course'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Edit Course Modal */}
      <CustomModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Edit Course"
        closeOnOutsideClick={false}
      >
        <div className="modal-form">
          <InputField
            label="Course Code"
            initialValue={formData.course_code}
            onChange={(value) => handleInputChange('course_code', value)}
            required
          />
          
          <InputField
            label="Course Name"
            initialValue={formData.course_name}
            onChange={(value) => handleInputChange('course_name', value)}
            required
          />
          
          <InputField
            label="Credits"
            type="number"
            initialValue={formData.credits}
            onChange={(value) => handleInputChange('credits', value)}
            required
          />
          
          <DropdownField
            label="Department"
            options={departments}
            initialValue={
              departments?.find(
                (dept) => String(dept.value) === String(formData.department_id)
              )?.title || ''
            }
            onChange={(value) => handleInputChange('department_id', value)}
            required
          />

          <div className="modal-actions">
            <button
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
              className="secondary-button"
            >
              Cancel
            </button>
            <button
              onClick={handleEditCourse}
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Course'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Tag Student Modal */}
      <CustomModal
        isOpen={showTagModal}
        onClose={() => {
          setShowTagModal(false);
          resetTagData();
        }}
        title="Tag Student with Course"
        closeOnOutsideClick={false}
      >
        <div className="modal-form">
          <DropdownField
            label="Student"
            options={students}
            initialValue={tagData.student_id}
            onChange={(value) => handleTagInputChange('student_id', value)}
            required
          />
          
          <DropdownField
            label="Course"
            options={courses?.map(c => ({ value: c.id, title: `${c.course_code} - ${c.course_name}` }))}
            initialValue={tagData.course_id}
            onChange={(value) => handleTagInputChange('course_id', value)}
            required
          />
          
          <InputField
            label="Semester"
            initialValue={tagData.semester}
            onChange={(value) => handleTagInputChange('semester', value)}
            hint="e.g., Fall 2024"
            required
          />
          
          <DropdownField
            label="Status"
            options={[
              { value: 'enrolled', title: 'Enrolled' },
              { value: 'completed', title: 'Completed' }
            ]}
            initialValue={tagData.status}
            onChange={(value) => handleTagInputChange('status', value)}
            required
          />
          
          {tagData.status === 'completed' && (
            <InputField
              label="Grade"
              initialValue={tagData.grade}
              onChange={(value) => handleTagInputChange('grade', value)}
              placeholder="e.g., A+"
            />
          )}
          
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowTagModal(false);
                resetTagData();
              }}
              className="secondary-button"
            >
              Cancel
            </button>
            <button
              onClick={handleTagStudent}
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? 'Tagging...' : 'Tag Student'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Bulk Import CSV Modal */}
      <CustomModal
        isOpen={showBulkImportModal}
        onClose={() => {
          setShowBulkImportModal(false);
          setCsvFile(null);
        }}
        title="Bulk Import Student-Course Tagging"
      >
        <div className="modal-form">
          <div className="csv-info">
            <p><strong>CSV Format:</strong></p>
            <p>roll_number,course_code,semester,status,grade</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              <strong>Example:</strong><br/>
              PHD001,CS101,Fall 2024,enrolled,<br/>
              PHD002,CS102,Spring 2024,completed,A+
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              • Status must be 'enrolled' or 'completed'<br/>
              • Grade is required only for completed courses<br/>
              • Existing enrollments will be skipped
            </p>
          </div>
          
          <div className="file-upload">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files[0])}
              style={{
                padding: '0.75rem',
                border: '2px dashed #d1d5db',
                borderRadius: '0.5rem',
                width: '100%',
                cursor: 'pointer'
              }}
            />
            {csvFile && (
              <p style={{ marginTop: '0.5rem', color: '#3b82f6' }}>
                Selected: {csvFile.name}
              </p>
            )}
          </div>
          
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowBulkImportModal(false);
                setCsvFile(null);
              }}
              className="secondary-button"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkImport}
              className="primary-button"
              disabled={submitting || !csvFile}
            >
              {submitting ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
        </div>
      </CustomModal>

      <style jsx>{`
        .admin-course-management {
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
        }

        .primary-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
        }

        .primary-button:hover {
          background: #2563eb;
        }

        .primary-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .secondary-button {
          padding: 0.75rem 1.5rem;
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
        }

        .secondary-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .action-button {
          padding: 0.5rem;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 0.875rem;
        }

        .edit-button {
          background: #eff6ff;
          color: #3b82f6;
        }

        .edit-button:hover {
          background: #dbeafe;
        }

        .delete-button {
          background: #fef2f2;
          color: #ef4444;
        }

        .delete-button:hover {
          background: #fee2e2;
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

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .header-actions {
            width: 100%;
            flex-direction: column;
          }

          .primary-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
    </Layout>
  );
};

export default AdminCourseManagement;
