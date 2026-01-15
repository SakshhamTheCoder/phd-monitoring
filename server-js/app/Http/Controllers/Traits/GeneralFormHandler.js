import { Student, User, Faculty, Department } from '../../../../models/index.js';

/**
 * GeneralFormHandler utility functions for handling form access based on user roles
 * Equivalent to Laravel's GeneralFormHandler trait
 */

/**
 * Handle form access for student role
 * @param {Object} user - User object with student relationship
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @param {Array} steps - Form steps array
 * @param {Function} callback - Optional callback
 * @returns {Object} - Response object with status and data/message
 */
export const handleStudentForm = async (user, form_id, ModelClass, steps, callback = null) => {
  try {
    const student = await user.getStudent();
    if (!student) {
      return {
        status: 404,
        message: 'Student not found'
      };
    }

    const formInstance = await ModelClass.findOne({
      where: {
        id: form_id,
        student_id: student.roll_no
      },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    if (formInstance) {
      if (formInstance.student.id === student.id) {
        // Call fullForm method if it exists
        if (typeof formInstance.fullForm === 'function') {
          const formData = await formInstance.fullForm(user);
          return {
            status: 200,
            data: formData
          };
        }
        return {
          status: 200,
          data: formInstance
        };
      } else {
        return {
          status: 403,
          message: 'You are not authorized to access this resource'
        };
      }
    } else {
      return {
        status: 404,
        message: 'No form found'
      };
    }
  } catch (error) {
    console.error('Error in handleStudentForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

/**
 * Handle form access for coordinator role
 * @param {Object} user - User object with faculty relationship
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @returns {Object} - Response object
 */
export const handleCoordinatorForm = async (user, form_id, ModelClass) => {
  try {
    const formInstance = await ModelClass.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            {
              model: Department,
              as: 'department'
            }
          ]
        }
      ]
    });

    if (!formInstance) {
      return {
        status: 404,
        message: 'No form found'
      };
    }

    const student = formInstance.student;
    const faculty = await user.getFaculty();
    
    // Check if user coordinates the department
    // Note: This assumes a checkCoordinates method exists on Department model
    // You may need to implement this based on your actual schema
    const department = await student.getDepartment();
    const coordinates = department.checkCoordinates 
      ? await department.checkCoordinates(faculty.faculty_code)
      : false;

    if (coordinates) {
      const steps = formInstance.steps || [];
      const index = steps.indexOf('phd_coordinator');
      
      if (index !== -1 && index <= formInstance.maximum_step) {
        if (typeof formInstance.fullForm === 'function') {
          const formData = await formInstance.fullForm(user);
          return {
            status: 200,
            data: formData
          };
        }
        return {
          status: 200,
          data: formInstance
        };
      } else {
        return {
          status: 404,
          message: 'The form is not yet assigned to you for review or action.'
        };
      }
    } else {
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
    }
  } catch (error) {
    console.error('Error in handleCoordinatorForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

/**
 * Handle form access for HOD role
 * @param {Object} user - User object with faculty relationship
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @returns {Object} - Response object
 */
export const handleHodForm = async (user, form_id, ModelClass) => {
  try {
    const formInstance = await ModelClass.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            {
              model: Department,
              as: 'department',
              include: [
                {
                  model: Faculty,
                  as: 'hod'
                }
              ]
            }
          ]
        }
      ]
    });

    if (!formInstance) {
      return {
        status: 404,
        message: 'No form found'
      };
    }

    const student = formInstance.student;
    const faculty = await user.getFaculty();
    const hod = await student.department.getHod();

    if (hod && hod.faculty_code === faculty.faculty_code) {
      const steps = formInstance.steps || [];
      const index = steps.indexOf('hod');
      
      if (index !== -1 && index <= formInstance.maximum_step) {
        if (typeof formInstance.fullForm === 'function') {
          const formData = await formInstance.fullForm(user);
          return {
            status: 200,
            data: formData
          };
        }
        return {
          status: 200,
          data: formInstance
        };
      } else {
        return {
          status: 404,
          message: 'The form is not yet assigned to you for review or action.'
        };
      }
    } else {
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
    }
  } catch (error) {
    console.error('Error in handleHodForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

/**
 * Handle form access for admin role
 * @param {Object} user - User object
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @param {boolean} isAdmin - Whether user is admin
 * @returns {Object} - Response object
 */
export const handleAdminForm = async (user, form_id, ModelClass, isAdmin = false) => {
  try {
    const formInstance = await ModelClass.findByPk(form_id);

    if (!formInstance) {
      return {
        status: 404,
        message: 'No form found'
      };
    }

    if (isAdmin) {
      if (typeof formInstance.fullForm === 'function') {
        const formData = await formInstance.fullForm(user);
        return {
          status: 200,
          data: formData
        };
      }
      return {
        status: 200,
        data: formInstance
      };
    }

    const currentRole = await user.getCurrent_role();
    const steps = formInstance.steps || [];
    const index = steps.indexOf(currentRole.role);

    if (index !== -1 && index <= formInstance.maximum_step) {
      if (typeof formInstance.fullForm === 'function') {
        const formData = await formInstance.fullForm(user);
        return {
          status: 200,
          data: formData
        };
      }
      return {
        status: 200,
        data: formInstance
      };
    } else {
      return {
        status: 404,
        message: 'The form is not yet assigned to you for review or action.'
      };
    }
  } catch (error) {
    console.error('Error in handleAdminForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

/**
 * Handle form access for faculty/supervisor role
 * @param {Object} user - User object with faculty relationship
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @returns {Object} - Response object
 */
export const handleFacultyForm = async (user, form_id, ModelClass) => {
  try {
    const formInstance = await ModelClass.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student'
        }
      ]
    });

    if (!formInstance) {
      return {
        status: 404,
        message: 'No form found'
      };
    }

    const student = formInstance.student;
    const faculty = await user.getFaculty();
    
    // Check if faculty supervises the student
    // Note: This assumes a checkSupervises method exists on Student model
    const supervises = student.checkSupervises 
      ? await student.checkSupervises(faculty.faculty_code)
      : false;

    if (supervises) {
      const steps = formInstance.steps || [];
      const index = steps.indexOf('faculty');
      
      if (index !== -1 && index <= formInstance.maximum_step) {
        if (typeof formInstance.fullForm === 'function') {
          const formData = await formInstance.fullForm(user);
          return {
            status: 200,
            data: formData
          };
        }
        return {
          status: 200,
          data: formInstance
        };
      } else {
        return {
          status: 404,
          message: 'The form is not yet assigned to you for review or action.'
        };
      }
    } else {
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
    }
  } catch (error) {
    console.error('Error in handleFacultyForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

/**
 * Handle form access for doctoral committee role
 * @param {Object} user - User object with faculty relationship
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @returns {Object} - Response object
 */
export const handleDoctoralForm = async (user, form_id, ModelClass) => {
  try {
    const formInstance = await ModelClass.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student'
        }
      ]
    });

    if (!formInstance) {
      return {
        status: 404,
        message: 'No form found'
      };
    }

    const student = formInstance.student;
    const faculty = await user.getFaculty();
    
    // Check if faculty is in doctoral committee
    // Note: This assumes a checkDoctoralCommittee method exists on Student model
    const inCommittee = student.checkDoctoralCommittee 
      ? await student.checkDoctoralCommittee(faculty.faculty_code)
      : false;

    if (inCommittee) {
      const steps = formInstance.steps || [];
      let index = steps.indexOf('doctoral');
      if (index === -1) {
        index = steps.indexOf('external');
      }
      
      if (index !== -1 && index <= formInstance.maximum_step) {
        if (typeof formInstance.fullForm === 'function') {
          const formData = await formInstance.fullForm(user);
          return {
            status: 200,
            data: formData
          };
        }
        return {
          status: 200,
          data: formInstance
        };
      } else {
        return {
          status: 404,
          message: 'The form is not yet assigned to you for review or action.'
        };
      }
    } else {
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
    }
  } catch (error) {
    console.error('Error in handleDoctoralForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

/**
 * Handle form access for ADoRDC role
 * @param {Object} user - User object with faculty relationship
 * @param {number} form_id - Form ID
 * @param {Object} ModelClass - Sequelize model class
 * @returns {Object} - Response object
 */
export const handleAdordcForm = async (user, form_id, ModelClass) => {
  try {
    const formInstance = await ModelClass.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            {
              model: Department,
              as: 'department'
            }
          ]
        }
      ]
    });

    if (!formInstance) {
      return {
        status: 404,
        message: 'No form found'
      };
    }

    const student = formInstance.student;
    const faculty = await user.getFaculty();
    const department = student.department;

    // Check if logged-in faculty is ADoRDC for student's department
    // Note: This assumes adordc relationship exists on Department model
    const adordc = await department.getAdordc();
    
    if (adordc && adordc.faculty_code === faculty.faculty_code) {
      const steps = formInstance.steps || [];
      const index = steps.indexOf('adordc');

      if (index !== -1 && index <= formInstance.maximum_step) {
        if (typeof formInstance.fullForm === 'function') {
          const formData = await formInstance.fullForm(user);
          return {
            status: 200,
            data: formData
          };
        }
        return {
          status: 200,
          data: formInstance
        };
      }

      return {
        status: 404,
        message: 'The form is not yet assigned to you for review or action.'
      };
    }

    return {
      status: 403,
      message: 'You are not authorized to access this resource'
    };
  } catch (error) {
    console.error('Error in handleAdordcForm:', error);
    return {
      status: 422,
      errors: error.errors || { general: [error.message] }
    };
  }
};

export default {
  handleStudentForm,
  handleCoordinatorForm,
  handleHodForm,
  handleAdminForm,
  handleFacultyForm,
  handleDoctoralForm,
  handleAdordcForm
};

