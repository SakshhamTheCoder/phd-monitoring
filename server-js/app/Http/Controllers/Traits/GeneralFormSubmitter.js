import { Forms, Presentation, Student, User, Faculty, Department } from '../../../../models/index.js';
import { formNotification } from './NotificationManager.js';

/**
 * GeneralFormSubmitter utility functions for submitting forms
 * Equivalent to Laravel's GeneralFormSubmitter trait
 */

/**
 * Get form type from model class name
 * @param {Object} Model - Sequelize model class
 * @returns {string} - Form type slug
 */
const getFormType = (Model) => {
  const modelName = Model.name;
  
  const formTypeMap = {
    'SupervisorAllocation': 'supervisor-allocation',
    'SupervisorChangeForm': 'supervisor-change',
    'StudentSemesterOffForm': 'semester-off',
    'StudentStatusChangeForms': 'status-change',
    'ConstituteOfIRB': 'irb-constitution',
    'IrbSubForm': 'irb-submission',
    'ResearchExtentionsForm': 'irb-extension',
    'ThesisSubmission': 'thesis-submission',
    'ThesisExtentionForm': 'thesis-extension',
    'ListOfExaminersForm': 'list-of-examiners',
    'SynopsisSubmission': 'synopsis-submission',
    'Presentation': 'presentation'
  };

  return formTypeMap[modelName] || modelName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2');
};

/**
 * Get unlock field name for a stage
 * @param {string} stage - Stage name
 * @returns {string|null} - Unlock field name
 */
const getUnlockField = (stage) => {
  const unlockFields = {
    'student': 'student_lock',
    'supervisor': 'supervisor_lock',
    'phd_coordinator': 'phd_coordinator_lock',
    'hod': 'hod_lock',
    'dordc': 'dordc_lock',
    'adordc': 'adordc_lock',
    'dra': 'dra_lock',
    'external': 'external_lock',
    'director': 'director_lock',
    'doctoral': 'doctoral_lock'
  };

  return unlockFields[stage] || null;
};

/**
 * Get submission message for a role
 * @param {Object} role - Role object
 * @param {string} name - User name
 * @returns {string} - Submission message
 */
const getSubmissionMessage = (role, name) => {
  const roleName = role.role || role;
  
  const messages = {
    'student': `${name} (Student) submitted the form`,
    'faculty': `${name} (Supervisor) submitted the form`,
    'phd_coordinator': `${name} (PhD Coordinator) submitted the form`,
    'hod': `${name} (HOD) submitted the form`,
    'dordc': `${name} (DORDC) submitted the form`,
    'dra': `${name} (DRA) submitted the form`,
    'adordc': `${name} (ADORDC) submitted the form`,
    'director': `${name} (Director) submitted the form`,
    'external': `${name} (External) submitted the form`,
    'doctoral': `${name} (Doctoral Committee) submitted the form`
  };

  return messages[roleName] || `${name} submitted the form`;
};

/**
 * Get rejection message for a role
 * @param {Object} role - Role object
 * @param {string} name - User name
 * @returns {string} - Rejection message
 */
const getRejectionMessage = (role, name) => {
  const roleName = role.role || role;
  
  const messages = {
    'student': `${name} (Student) Rejected the form`,
    'faculty': `${name} (Supervisor) Rejected the form`,
    'phd_coordinator': `${name} (PhD Coordinator) Rejected the form`,
    'external': `${name} (External) Rejected the form`,
    'hod': `${name} (HOD) Rejected the form`,
    'dordc': `${name} (DORDC) Rejected the form`,
    'dra': `${name} (DRA) Rejected the form`,
    'director': `${name} (Director) Rejected the form`,
    'doctoral': `${name} (Doctoral Committee) Rejected the form`
  };

  return messages[roleName] || `${name} Rejected the form`;
};

/**
 * Handle role-specific authorization logic
 * @param {Object} user - User object
 * @param {Object} formInstance - Form instance
 * @param {string} role - User role
 * @throws {Error} - If user is not authorized
 */
const handleRoleSpecificLogic = async (user, formInstance, role) => {
  const student = await formInstance.getStudent();
  const currentRole = await user.getCurrent_role();

  switch (role) {
    case 'student':
      const userStudent = await user.getStudent();
      if (formInstance.student_id !== userStudent.roll_no) {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'faculty':
      const faculty = await user.getFaculty();
      // Check if faculty supervises the student
      // Note: This assumes a checkSupervises method exists on Student model
      if (student.checkSupervises && !(await student.checkSupervises(faculty.faculty_code))) {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'phd_coordinator':
      const coordinatorFaculty = await user.getFaculty();
      const department = await student.getDepartment();
      // Check if faculty coordinates the department
      // Note: This assumes a checkCoordinates method exists on Department model
      if (department.checkCoordinates && !(await department.checkCoordinates(coordinatorFaculty.faculty_code))) {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'hod':
      const hodFaculty = await user.getFaculty();
      const hodDepartment = await student.getDepartment();
      const hod = await hodDepartment.getHod();
      if (!hod || hod.faculty_code !== hodFaculty.faculty_code) {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'external':
      // External validation logic
      break;

    case 'doctoral':
      const doctoralFaculty = await user.getFaculty();
      // Check if faculty is in doctoral committee
      // Note: This assumes a checkDoctoralCommittee method exists on Student model
      if (student.checkDoctoralCommittee && !(await student.checkDoctoralCommittee(doctoralFaculty.faculty_code))) {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'adordc':
      const adordcFaculty = await user.getFaculty();
      const adordcDepartment = await student.getDepartment();
      const adordcDepartments = await adordcFaculty.getAdordcDepartments();
      const departmentIds = adordcDepartments.map(d => d.id);
      if (!departmentIds.includes(adordcDepartment.id)) {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'dordc':
      if (currentRole.role !== 'dordc') {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'dra':
      if (currentRole.role !== 'dra') {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    case 'director':
      if (currentRole.role !== 'director') {
        throw new Error('You are not authorized to access this resource');
      }
      break;

    default:
      throw new Error('Invalid role for submission');
  }
};

/**
 * Update approval and comments based on role
 * @param {Object} formInstance - Form instance
 * @param {Object} request - Express request object
 * @param {string} role - User role
 */
const updateApprovalAndComments = (formInstance, request, role) => {
  const approval = request.body.approval;
  const comments = request.body.comments || null;

  // Update approval fields based on role
  if (approval) {
    switch (role) {
      case 'faculty':
        formInstance.supervisor_approval = true;
        break;
      case 'phd_coordinator':
        formInstance.phd_coordinator_approval = true;
        break;
      case 'hod':
        formInstance.hod_approval = true;
        break;
      case 'dordc':
        formInstance.dordc_approval = true;
        break;
      case 'adordc':
        formInstance.adordc_approval = true;
        break;
      case 'dra':
        formInstance.dra_approval = true;
        break;
      case 'external':
        formInstance.external_approval = true;
        break;
      case 'doctoral':
        formInstance.doctoral_approval = true;
        break;
      case 'director':
        formInstance.director_approval = true;
        break;
    }
  }

  // Update comments and locks based on role
  switch (role) {
    case 'faculty':
      formInstance.supervisor_comments = comments;
      formInstance.supervisor_lock = true;
      break;
    case 'phd_coordinator':
      formInstance.phd_coordinator_comments = comments;
      formInstance.phd_coordinator_lock = true;
      break;
    case 'hod':
      formInstance.hod_comments = comments;
      formInstance.hod_lock = true;
      break;
    case 'adordc':
      formInstance.adordc_comments = comments;
      formInstance.adordc_lock = true;
      break;
    case 'dordc':
      formInstance.dordc_comments = comments;
      formInstance.dordc_lock = true;
      break;
    case 'dra':
      formInstance.dra_comments = comments;
      formInstance.dra_lock = true;
      break;
    case 'external':
      formInstance.external_comments = comments;
      formInstance.external_lock = true;
      break;
    case 'director':
      formInstance.director_comments = comments;
      formInstance.director_lock = true;
      break;
    case 'doctoral':
      formInstance.doctoral_comments = comments;
      formInstance.doctoral_lock = true;
      break;
  }
};

/**
 * Handle fallback to previous level when form is rejected
 * @param {Object} user - User object
 * @param {Object} formInstance - Form instance
 * @param {string} previousLevel - Previous level name
 * @param {string} comments - Rejection comments
 * @param {Object} Model - Sequelize model class
 * @returns {Object} - Response object
 */
const handleFallbackToPreviousLevel = async (user, formInstance, previousLevel, comments, Model) => {
  const student = await formInstance.getStudent();
  const studentUser = await student.getUser();
  
  const formType = getFormType(Model);
  let link = `/forms/${formType}/${formInstance.id}`;
  
  if (formType === 'presentation') {
    link = `/presentation/semester/${formInstance.period_of_report}/${formInstance.id}`;
  }

  const studentName = `${studentUser.first_name || ''} ${studentUser.last_name || ''}`.trim();
  await formNotification(
    student,
    `${formType} form for ${studentName} has been rejected`,
    'Form has been rejected',
    link,
    previousLevel,
    true
  );

  if (previousLevel === 'faculty') {
    previousLevel = 'supervisor';
  }

  const steps = formInstance.steps || [];
  const index = steps.indexOf(previousLevel);
  
  const unlockField = getUnlockField(previousLevel);
  const updateData = {
    stage: previousLevel,
    current_step: index,
    maximum_step: index > formInstance.maximum_step ? index : formInstance.maximum_step
  };

  if (unlockField) {
    updateData[unlockField] = false;
  }

  await formInstance.update(updateData);

  // Add history entry
  const currentRole = await user.getCurrent_role();
  const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (formInstance.addHistoryEntry) {
    formInstance.addHistoryEntry(
      getRejectionMessage(currentRole, userName),
      userName,
      comments
    );
  }

  return {
    status: 200,
    message: 'Form Rejected successfully'
  };
};

/**
 * Handle moving form to next level
 * @param {Object} formInstance - Form instance
 * @param {string} nextLevel - Next level name
 * @param {Object} Model - Sequelize model class
 */
const handleMoveToNextLevel = async (formInstance, nextLevel, Model) => {
  const student = await formInstance.getStudent();
  const studentUser = await student.getUser();
  const student_id = student.roll_no;
  
  const steps = formInstance.steps || [];
  const index = steps.indexOf(nextLevel);

  console.log('Next Level Post Approval:', nextLevel);

  if (nextLevel === 'complete') {
    await formInstance.update({
      completion: 'complete',
      stage: 'complete',
      current_step: index,
      maximum_step: index > formInstance.maximum_step ? index : formInstance.maximum_step
    });
  } else {
    const formType = getFormType(Model);
    let link = `/forms/${formType}/${formInstance.id}`;
    
    if (formType === 'presentation') {
      link = `/presentation/semester/${formInstance.period_of_report}/${formInstance.id}`;
    }

    const studentName = `${studentUser.first_name || ''} ${studentUser.last_name || ''}`.trim();
    await formNotification(
      student,
      `${formType} form for ${studentName} has pending action`,
      'Form has pending action',
      link,
      nextLevel,
      true
    );

    let levelToUpdate = nextLevel;
    if (nextLevel === 'faculty') {
      levelToUpdate = 'supervisor';
    }

    const unlockField = getUnlockField(levelToUpdate);
    const updateData = {
      stage: levelToUpdate,
      [`${levelToUpdate}_approval`]: false,
      [`${levelToUpdate}_comments`]: null,
      status: 'pending',
      current_step: index,
      maximum_step: index > formInstance.maximum_step ? index : formInstance.maximum_step
    };

    if (unlockField) {
      updateData[unlockField] = false;
    }

    await formInstance.update(updateData);
  }

  await updateForm(Model, student_id, nextLevel);
};

/**
 * Update form availability in Forms table
 * @param {Object} Model - Sequelize model class
 * @param {string} student_id - Student roll number
 * @param {string} next - Next level
 */
const updateForm = async (Model, student_id, next) => {
  if (Model === Presentation) {
    return;
  }

  const formType = getFormType(Model);
  const form = await Forms.findOne({
    where: {
      form_type: formType,
      student_id: student_id
    }
  });

  if (!form) {
    return;
  }

  let levelToUpdate = next;
  if (next === 'external') {
    levelToUpdate = 'doctoral';
  }

  if (levelToUpdate !== 'complete') {
    const field = `${levelToUpdate}_available`;
    form[field] = true;
  }

  form.stage = levelToUpdate;
  await form.save();
};

/**
 * Submit a form
 * @param {Object} user - User object
 * @param {Object} request - Express request object
 * @param {number} form_id - Form ID
 * @param {Object} Model - Sequelize model class
 * @param {string} role - User role
 * @param {string} previousLevel - Previous level name
 * @param {string} nextLevel - Next level name
 * @param {Function} extraSteps - Optional callback for extra steps
 * @returns {Object} - Response object
 */
export const submitForm = async (user, request, form_id, Model, role, previousLevel, nextLevel, extraSteps = null) => {
  console.log('Submitting form with ID:', form_id);
  console.log('Model:', Model.name);
  console.log('Role:', role);
  console.log('Previous Level:', previousLevel);
  console.log('Next Level:', nextLevel);

  // Validate request for non-student roles
  if (role !== 'student') {
    const { approval, comments } = request.body;
    
    if (approval === undefined || typeof approval !== 'boolean') {
      return {
        status: 422,
        errors: { approval: ['The approval field is required and must be a boolean'] }
      };
    }

    // Check if comments are required when approval is false
    if (!approval && (!comments || comments.trim() === '')) {
      return {
        status: 403,
        message: 'Comments are required when approval is false'
      };
    }
  }

  try {
    const formInstance = await Model.findByPk(form_id, {
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

    if (formInstance.completion === 'complete') {
      return {
        status: 403,
        message: 'Form already completed'
      };
    }

    // Check locks
    const lockField = role === 'faculty' ? 'supervisor_lock' : `${role}_lock`;
    if (formInstance[lockField]) {
      return {
        status: 403,
        message: 'You are not authorized to access this resource'
      };
    }

    console.log('Form instance found:', formInstance.id);

    // Handle role-specific logic
    await handleRoleSpecificLogic(user, formInstance, role);

    // Handle rejection
    if (role !== 'student' && !request.body.approval) {
      console.log('Form rejected by:', user.first_name, user.last_name);
      updateApprovalAndComments(formInstance, request, role);
      await formInstance.save();
      return await handleFallbackToPreviousLevel(user, formInstance, previousLevel, request.body.comments, Model);
    }

    // Execute extra steps if provided
    if (extraSteps) {
      await extraSteps(formInstance, user);
    }

    // Update approval and comments
    if (role !== 'student') {
      console.log('Form approved by:', user.first_name, user.last_name);
      updateApprovalAndComments(formInstance, request, role);
    } else {
      formInstance.student_lock = true;
    }

    // Move to next level
    await handleMoveToNextLevel(formInstance, nextLevel, Model);

    // Add history entry
    const currentRole = await user.getCurrent_role();
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    if (formInstance.addHistoryEntry) {
      formInstance.addHistoryEntry(
        getSubmissionMessage(currentRole, userName),
        userName
      );
    }

    await formInstance.save();

    return {
      status: 200,
      message: 'Form submitted successfully'
    };
  } catch (error) {
    console.error('Error in form submission:', error);

    if (error.statusCode === 201) {
      return {
        status: 201,
        message: error.message
      };
    }

    if (error.errors) {
      return {
        status: 422,
        errors: error.errors
      };
    }

    return {
      status: 403,
      message: error.message || 'Failed to submit form'
    };
  }
};

export default {
  submitForm,
  getFormType,
  getUnlockField,
  getSubmissionMessage,
  getRejectionMessage,
  handleRoleSpecificLogic,
  updateApprovalAndComments,
  handleFallbackToPreviousLevel,
  handleMoveToNextLevel,
  updateForm
};

