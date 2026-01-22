import { Student, User, Faculty } from '../../../../models/index.js';
import { applyDynamicFilters } from './FilterLogicTrait.js';
import { Op } from 'sequelize';

/**
 * GeneralFormList utility functions for listing forms with pagination and filtering
 * Equivalent to Laravel's GeneralFormList trait
 */

/**
 * List forms based on user role
 * @param {Object} user - User object
 * @param {Object} Model - Sequelize model class
 * @param {Object} request - Express request object
 * @param {Object} filters - Optional filters object
 * @param {boolean} override - Override flag
 * @param {Object} fields - Fields configuration
 * @returns {Object} - Response object with paginated form data
 */
export const listForms = async (user, Model, request, filters = null, override = false, fields = []) => {
  const currentRole = await user.getCurrent_role();
  const role = currentRole.role;
  const page = Number.parseInt(request.query.page) || 1;
  const rows = Number.parseInt(request.query.rows) || 50;

  // Parse filters from query string if not provided
  if (!filters) {
    const filtersJson = request.query.filters;
    if (filtersJson) {
      try {
        filters = JSON.parse(decodeURIComponent(filtersJson));
      } catch (e) {
        console.error('Error parsing filters:', e);
        filters = null;
      }
    }
  }

  switch (role) {
    case 'student':
      return await listStudentForms(user, Model, filters, page, rows, fields);
    case 'hod':
    case 'phd_coordinator':
      return await listHodForms(user, Model, filters, false, page, rows, fields);
    case 'dra':
    case 'dordc':
    case 'director':
    case 'admin':
      return await listAdminForms(user, Model, filters, page, rows, fields);
    case 'faculty':
      return await listFacultyForms(user, Model, filters, override, page, rows, fields);
    case 'adordc':
      return await listAdordcForms(user, Model, filters, page, rows, fields);
    case 'doctoral':
    case 'external':
      return await listDoctoralForms(user, Model, filters, override, page, rows, fields);
    default:
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
  }
};

/**
 * Paginate and map forms to response format
 * @param {Object} Model - Sequelize model class
 * @param {number} page - Current page
 * @param {Object} fields - Fields configuration
 * @param {Object} user - User object
 * @param {number} perPage - Items per page
 * @param {Object} queryOptions - Sequelize query options
 * @returns {Object} - Paginated and mapped form data
 */
export const paginateAndMap = async (Model, page, fields, user, perPage = 50, queryOptions = {}) => {
  // Ensure include for student and user
  if (!queryOptions.include) {
    queryOptions.include = [];
  }
  
  // Check if student include already exists
  const hasStudentInclude = queryOptions.include.some(inc => inc.as === 'student');
  if (!hasStudentInclude) {
    queryOptions.include.push({
      model: Student,
      as: 'student',
      include: [{ model: User, as: 'user' }]
    });
  }

  // Apply pagination
  queryOptions.limit = perPage;
  queryOptions.offset = (page - 1) * perPage;

  const { count, rows: forms } = await Model.findAndCountAll(queryOptions);
  const total = count;
  const totalPages = Math.ceil(total / perPage);

  const currentRole = await user.getCurrent_role();

  return {
    data: forms.map(form => mapForm(form, fields.extra_fields || [])),
    page: page,
    total: total,
    totalPages: totalPages,
    fields: fields.fields || [],
    fieldsTitles: fields.titles || [],
    role: currentRole.role
  };
};

/**
 * Map form to response format
 * @param {Object} form - Form instance
 * @param {Array} fields - Extra fields to include
 * @returns {Object} - Mapped form data
 */
export const mapForm = (form, fields = []) => {
  const student = form.student || {};
  const user = student.user || {};
  
  const formData = {
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    stage: form.stage,
    roll_no: student.roll_no,
    status: form.status,
    completion: form.completion,
    created_at: form.created_at,
    updated_at: form.updated_at,
    action_req: form.student_lock,
    id: form.id
  };

  // Add extra fields
  for (const [key, field] of Object.entries(fields)) {
    if (typeof field === 'string' && form[field] !== undefined) {
      formData[field] = form[field];
    } else if (typeof field === 'function') {
      formData[key] = field(form);
    } else if (student[field] !== undefined) {
      formData[field] = student[field];
    }
  }

  return formData;
};

/**
 * List forms for a specific student
 * @param {Object} user - User object
 * @param {Object} Model - Sequelize model class
 * @param {string} student_id - Student roll number
 * @returns {Object} - Response object
 */
export const listFormsStudent = async (user, Model, student_id) => {
  const currentRole = await user.getCurrent_role();
  const role = currentRole.role;
  
  const student = await Student.findOne({
    where: { roll_no: student_id }
  });

  if (!student) {
    return {
      status: 404,
      message: 'Student not found'
    };
  }

  // Authorization checks based on role
  switch (role) {
    case 'hod':
    case 'phd_coordinator': {
      const faculty = await user.getFaculty();
      if (student.department_id !== faculty.department_id) {
        return {
          status: 403,
          message: 'You are not authorized to access this resource'
        };
      }
      break;
    }
    case 'faculty':
      // Check if faculty supervises this student
      // Note: Implement supervisedStudents relationship check
      break;
    case 'doctoral':
    case 'external':
      // Check if in doctoral committee
      // Note: Implement checkDoctoralCommittee method
      break;
    case 'adordc':
      // Check if ADoRDC for department
      // Note: Implement adordcDepartments relationship check
      break;
    case 'student':
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
    default:
      break;
  }

  const forms = await Model.findAll({
    where: { student_id: student_id },
    include: [
      {
        model: Student,
        as: 'student'
      }
    ]
  });

  const filteredForms = forms.filter(formItem => {
    const steps = formItem.steps || [];
    const index = steps.indexOf(role);
    return index !== -1 && index <= formItem.maximum_step;
  });

  return {
    status: 200,
    data: filteredForms
  };
};

/**
 * List forms for student role
 */
export const listStudentForms = async (user, Model, filters = null, page = 1, rows = 50, fields = []) => {
  const student = await user.getStudent();
  if (!student) {
    return {
      status: 404,
      message: 'Student not found'
    };
  }

  const queryOptions = {
    where: { student_id: student.roll_no }
  };

  if (filters) {
    applyDynamicFilters(queryOptions, filters);
  }

  return await paginateAndMap(Model, page, fields, user, rows, queryOptions);
};

/**
 * List forms for admin role
 */
export const listAdminForms = async (user, Model, filters = null, page = 1, rows = 50, fields = []) => {
  const queryOptions = {};

  if (filters) {
    applyDynamicFilters(queryOptions, filters);
  }

  return await paginateAndMap(Model, page, fields, user, rows, queryOptions);
};

/**
 * List forms for faculty role
 */
export const listFacultyForms = async (user, Model, filters = null, override = false, page = 1, rows = 50, fields = []) => {
  const faculty = await user.getFaculty();
  
  // Get supervised students
  // Note: This assumes a supervisedStudents relationship exists
  const supervisedStudents = await faculty.getSupervisedStudents();
  const studentIds = supervisedStudents.map(s => s.roll_no);

  const queryOptions = {
    where: {
      student_id: { [Op.in]: studentIds }
    }
  };

  if (filters) {
    applyDynamicFilters(queryOptions, filters);
  }

  return await paginateAndMap(Model, page, fields, user, rows, queryOptions);
};

/**
 * List forms for HOD/Coordinator role
 */
export const listHodForms = async (user, Model, filters = null, override = false, page = 1, rows = 50, fields = []) => {
  const faculty = await user.getFaculty();
  const department = await faculty.getDepartment();
  
  const students = await Student.findAll({
    where: { department_id: department.id },
    attributes: ['roll_no']
  });
  const studentIds = students.map(s => s.roll_no);

  const queryOptions = {
    where: {
      student_id: { [Op.in]: studentIds }
    }
  };

  if (filters) {
    applyDynamicFilters(queryOptions, filters);
  }

  return await paginateAndMap(Model, page, fields, user, rows, queryOptions);
};

/**
 * List forms for ADoRDC role
 */
export const listAdordcForms = async (user, Model, filters = null, page = 1, rows = 50, fields = []) => {
  const faculty = await user.getFaculty();
  
  // Get all departments where user is ADoRDC
  // Note: This assumes an adordcDepartments relationship exists
  const departments = await faculty.getAdordcDepartments();
  const departmentIds = departments.map(d => d.id);

  if (departmentIds.length === 0) {
    const currentRole = await user.getCurrent_role();
    return {
      data: [],
      page: page,
      total: 0,
      totalPages: 0,
      fields: fields.fields || [],
      fieldsTitles: fields.titles || [],
      role: currentRole.role
    };
  }

  const students = await Student.findAll({
    where: { department_id: { [Op.in]: departmentIds } },
    attributes: ['roll_no']
  });
  const studentIds = students.map(s => s.roll_no);

  const queryOptions = {
    where: {
      student_id: { [Op.in]: studentIds }
    }
  };

  if (filters) {
    applyDynamicFilters(queryOptions, filters);
  }

  return await paginateAndMap(Model, page, fields, user, rows, queryOptions);
};

/**
 * List forms for doctoral/external role
 */
export const listDoctoralForms = async (user, Model, filters = null, override = false, page = 1, rows = 50, fields = []) => {
  const faculty = await user.getFaculty();
  
  // Get students in doctoral committee
  // Note: This assumes a doctoredStudents relationship exists
  const doctoralStudents = await faculty.getDoctoredStudents();
  const studentIds = doctoralStudents.map(s => s.roll_no);

  const queryOptions = {
    where: {
      student_id: { [Op.in]: studentIds }
    }
  };

  if (filters) {
    applyDynamicFilters(queryOptions, filters);
  }

  return await paginateAndMap(Model, page, fields, user, rows, queryOptions);
};

/**
 * List student profile data
 */
export const listStudentProfile = async (student) => {
  const user = await student.getUser();
  const department = await student.getDepartment();
  const supervisors = await student.getSupervisors();
  const doctoralCommittee = await student.getDoctoralCommittee();

  return {
    id: student.roll_no,
    database_id: student.id,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    phd_title: student.phd_title,
    department_id: student.department_id,
    overall_progress: student.overall_progress,
    roll_no: student.roll_no,
    department: department.name,
    supervisors: await Promise.all(supervisors.map(async (s) => {
      const supervisorFaculty = await Faculty.findOne({ where: { faculty_code: s.faculty_code } });
      const supervisorUser = await supervisorFaculty.getUser();
      return {
        faculty_code: s.faculty_code,
        name: `${supervisorUser.first_name || ''} ${supervisorUser.last_name || ''}`.trim(),
        email: supervisorUser.email,
        phone: supervisorUser.phone,
        designation: supervisorFaculty.designation
      };
    })),
    cgpa: student.cgpa,
    email: user.email,
    phone: user.phone,
    current_status: student.current_status,
    fathers_name: student.fathers_name,
    address: student.address,
    date_of_registration: student.date_of_registration,
    date_of_irb: student.date_of_irb,
    date_of_synopsis: student.date_of_synopsis,
    doctoral: await Promise.all(doctoralCommittee.map(async (faculty) => {
      const facultyUser = await faculty.getUser();
      return {
        faculty_code: faculty.faculty_code,
        designation: faculty.designation,
        name: `${facultyUser.first_name || ''} ${facultyUser.last_name || ''}`.trim(),
        email: facultyUser.email,
        phone: facultyUser.phone
      };
    }))
  };
};

/**
 * List semester data for a department
 */
export const listSemesterDepartment = async (semester, dep_id) => {
  // Note: These methods need to be implemented on the Semester model
  // These are placeholder calls - actual implementation depends on model methods
  const semesterOff = semester.getStudentsOnSemesterOff ? await semester.getStudentsOnSemesterOff({
    where: { '$student.department_id$': dep_id }
  }) : [];
  
  const presentationsLeave = semester.getPresentationsLeave ? await semester.getPresentationsLeave({
    include: [{
      model: Student,
      as: 'student',
      where: { department_id: dep_id }
    }]
  }) : [];

  const presentationsMissed = semester.getPresentationsMissed ? await semester.getPresentationsMissed({
    include: [{
      model: Student,
      as: 'student',
      where: { department_id: dep_id }
    }]
  }) : [];

  const scheduledPresentations = semester.getScheduledPresentations ? await semester.getScheduledPresentations({
    include: [{
      model: Student,
      as: 'student',
      where: { department_id: dep_id }
    }]
  }) : [];

  const unscheduledStudents = semester.getUnscheduledStudents ? await semester.getUnscheduledStudents({
    where: { department_id: dep_id }
  }) : [];

  return {
    semester_name: semester.semester_name,
    start_date: semester.start_date,
    end_date: semester.end_date,
    year: semester.year,
    semester_off: Array.isArray(semesterOff) ? semesterOff.length : 0,
    leave: Array.isArray(presentationsLeave) ? presentationsLeave.length : 0,
    missed: Array.isArray(presentationsMissed) ? presentationsMissed.length : 0,
    scheduled: Array.isArray(scheduledPresentations) ? scheduledPresentations.length : 0,
    unscheduled: Array.isArray(unscheduledStudents) ? unscheduledStudents.length : 0
  };
};

/**
 * List semester data
 */
export const listSemester = async (semester) => {
  // Note: These methods need to be implemented on the Semester model
  const semesterOff = semester.getStudentsOnSemesterOff ? await semester.getStudentsOnSemesterOff() : [];
  const presentationsLeave = semester.getPresentationsLeave ? await semester.getPresentationsLeave() : [];
  const presentationsMissed = semester.getPresentationsMissed ? await semester.getPresentationsMissed() : [];
  const scheduledPresentations = semester.getScheduledPresentations ? await semester.getScheduledPresentations() : [];
  const unscheduledStudents = semester.getUnscheduledStudents ? await semester.getUnscheduledStudents() : [];

  return {
    semester_name: semester.semester_name,
    start_date: semester.start_date,
    end_date: semester.end_date,
    year: semester.year,
    semester_off: Array.isArray(semesterOff) ? semesterOff.length : 0,
    leave: Array.isArray(presentationsLeave) ? presentationsLeave.length : 0,
    missed: Array.isArray(presentationsMissed) ? presentationsMissed.length : 0,
    scheduled: Array.isArray(scheduledPresentations) ? scheduledPresentations.length : 0,
    unscheduled: Array.isArray(unscheduledStudents) ? unscheduledStudents.length : 0
  };
};

export default {
  listForms,
  paginateAndMap,
  mapForm,
  listFormsStudent,
  listStudentForms,
  listAdminForms,
  listFacultyForms,
  listHodForms,
  listAdordcForms,
  listDoctoralForms,
  listStudentProfile,
  listSemesterDepartment,
  listSemester
};

