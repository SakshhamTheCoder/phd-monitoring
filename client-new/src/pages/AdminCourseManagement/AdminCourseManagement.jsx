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
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import InputField from '../../components/forms/fields/InputField';
import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
import useCapabilities from '../../hooks/useCapabilities';
const AdminCourseManagement = () => {
  const can = useCapabilities();
  // Catalog actions (add/edit/delete/import a course) are gated separately
  // from student-tagging actions because the backend enforces two different
  // capabilities: can_manage_courses vs can_manage_students.
  const mayManageCourses = can('can_manage_courses');
  const mayManageStudents = can('can_manage_students');

  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
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
    student_name: '',
    course_id: '',
    semester: '',
    status: 'enrolled',
    grade: '',
  });


  useEffect(() => {
    fetchDepartments();
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
        toast.success('Course added.');
        setShowAddModal(false);
        resetForm();
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(response.response?.message || 'Failed to add course.');
      }
    } catch (error) {
      console.error('Error adding course:', error);
      toast.error('Failed to add course.');
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
        toast.success('Course updated.');
        setShowEditModal(false);
        resetForm();
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(response.response?.message || 'Failed to update course.');
      }
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course.');
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
        toast.success('Course deleted.');
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error(response.response?.message || 'Failed to delete course.');
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course.');
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
        toast.success('Student tagged with course.');
        setShowTagModal(false);
        resetTagData();
        setRefreshKey(prev => prev + 1);
        fetchAllCourses();
      } else {
        toast.error(response.response?.message || 'Failed to tag student.');
      }
    } catch (error) {
      console.error('Error tagging student:', error);
      toast.error('Failed to tag student.');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const COURSE_HEADERS = 'Registration Number,Full Name,Email,Academic Year,Subject Code,Subject,Credits,Grade';

  const courseSampleCsv = `${COURSE_HEADERS}
900011,Scholar One,scholar.one@thapar.edu,2425ODD,PCS101,Research Methodology,4,A
900011,Scholar One,scholar.one@thapar.edu,2425EVEN,PCS102,Advanced Algorithms,3,`;

  const handleBulkImport = async (preview, reset) => {
    setSubmitting(true);

    const response = await customFetch(
      `${baseURL}/courses/student/bulk-import`,
      'POST',
      { rows: preview.data.map((row) => ({ ...row, row_number: row._rowNumber })) },
      false
    );

    setSubmitting(false);

    if (!response.success) {
      toast.error(response.response?.message || 'Failed to import');
      return;
    }

    const { success_count: imported = 0, errors = [] } = response.response.data || {};
    toast.success(`${imported} enrolments imported`);
    errors.forEach((message) => toast.warn(message));

    reset();
    setShowBulkImportModal(false);
    setRefreshKey((prev) => prev + 1);
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
      student_name: '',
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
              {mayManageStudents && (
                <CustomButton
                  text="Tag Student"
                  variant="secondary"
                  onClick={() => setShowTagModal(true)}
                />
              )}
              {mayManageStudents && (
                <CustomButton
                  text="Bulk Import"
                  variant="secondary"
                  onClick={() => setShowBulkImportModal(true)}
                />
              )}
              {mayManageCourses && (
                <CustomButton
                  text="Add Course +"
                  onClick={() => setShowAddModal(true)}
                />
              )}
            </div>
          }
          actions={mayManageCourses ? [
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
          ] : []}
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
              className="custom-button custom-button--secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCourse}
              className="custom-button"
              disabled={submitting}
            >
              {submitting ? 'Adding…' : 'Add Course'}
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
              className="custom-button custom-button--secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleEditCourse}
              className="custom-button"
              disabled={submitting}
            >
              {submitting ? 'Updating…' : 'Update Course'}
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
          <InputSuggestions
            label="Student"
            apiUrl={`${baseURL}/suggestions/student`}
            initialValue={tagData.student_name}
            fields={["name", "roll_no"]}
            hint="Type a name or registration number"
            onSelect={(student) => {
              handleTagInputChange('student_id', student.roll_no);
              handleTagInputChange('student_name', student.name);
            }}
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
              className="custom-button custom-button--secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleTagStudent}
              className="custom-button"
              disabled={submitting}
            >
              {submitting ? 'Tagging…' : 'Tag Student'}
            </button>
          </div>
        </div>
      </CustomModal>

      <UnifiedBulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        title="Bulk Import Coursework"
        required={['Registration Number', 'Academic Year', 'Subject Code']}
        rules={[
              'A subject code the portal does not have yet is created from the row.',
              'A grade means the course is finished. Leave it blank while it is still being taken.',
              'Academic Year is the semester code, for example 2425ODD.',
              'Importing the same file again updates the enrolments rather than duplicating them.',
            ]}
        sampleFileName="coursework_sample.csv"
        sampleCsvContent={courseSampleCsv}
        onImport={handleBulkImport}
        submitting={submitting}
      />

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

        .action-button {
          padding: 0.5rem;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 0.875rem;
        }

        .edit-button {
          background: var(--primary-wash);
          color: var(--primary-color);
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
        }
      `}</style>
    </div>
    </Layout>
  );
};

export default AdminCourseManagement;
