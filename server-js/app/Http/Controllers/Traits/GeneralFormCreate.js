import { Forms } from '../../../../models/index.js';

/**
 * GeneralFormCreate utility functions for creating forms
 * Equivalent to Laravel's GeneralFormCreate trait
 */

/**
 * Get form type from model class
 * @param {Object} Model - Sequelize model class
 * @returns {string} - Form type slug
 */
const getFormType = (Model) => {
  // Map model names to form types
  const modelFormTypeMap = {
    'SupervisorAllocation': 'supervisor-allocation',
    'IrbSubForm': 'irb-submission',
    'ConstituteOfIRB': 'irb-constitution',
    'SynopsisSubmission': 'synopsis-submission',
    'ListOfExaminersForm': 'list-of-examiners',
    'ThesisSubmission': 'thesis-submission',
    'StudentStatusChangeForms': 'status-change',
    'StudentSemesterOffForm': 'semester-off',
    'ResearchExtentionsForm': 'irb-extension',
    'SupervisorChangeForm': 'supervisor-change',
    'ThesisExtentionForm': 'thesis-extension',
    'Presentation': 'presentation'
  };

  const modelName = Model.name;
  return modelFormTypeMap[modelName] || modelName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2');
};

/**
 * Create a new form instance
 * @param {Object} Model - Sequelize model class
 * @param {Object} data - Form creation data
 * @param {Function} callback - Optional callback for additional form setup
 * @param {string} stage - Optional initial stage
 * @returns {Object} - Response object
 */
export const createForms = async (Model, data, callback = null, stage = null) => {
  try {
    // Create form instance
    const formData = {
      student_id: data.roll_no,
      status: 'draft',
      stage: data.role,
      student_lock: false,
      steps: data.steps
    };

    if (stage) {
      formData.supervisor_lock = false;
    }

    // Check if general form exists and is available
    const formType = getFormType(Model);
    const generalForm = await Forms.findOne({
      where: {
        form_type: formType,
        student_id: data.roll_no
      }
    });

    const field = `${data.role}_available`;

    if (!generalForm || generalForm[field] === false) {
      return {
        status: 400,
        message: 'Form is not available for you'
      };
    }

    // Check if maximum count reached
    if (generalForm.count >= generalForm.max_count) {
      return {
        status: 400,
        message: 'You have reached the maximum limit of forms of this type'
      };
    }

    // Check for pending forms
    const oldForms = await Model.findAll({
      where: { student_id: data.roll_no }
    });

    for (const oldForm of oldForms) {
      if (oldForm.completion !== 'complete') {
        return {
          status: 400,
          message: 'You have a pending form'
        };
      }
    }

    // Create the form
    const form = await Model.build(formData);

    // Execute callback if provided
    if (callback) {
      await callback(form);
    }

    // Fill additional data if provided
    if (data.data) {
      Object.assign(form, data.data);
    }

    // Add history entry
    // TODO: Implement addHistoryEntry method on form models
    if (form.addHistoryEntry) {
      form.addHistoryEntry('Form has been initiated', data.name);
    }

    await form.save();

    // Update general form count
    generalForm.count++;
    await generalForm.save();

    return {
      status: 200,
      message: 'Form Created',
      form
    };
  } catch (error) {
    console.error('Error creating form:', error);

    if (error.statusCode === 201) {
      return {
        status: 201,
        message: error.message
      };
    }

    return {
      status: 403,
      message: error.message || 'Failed to create form'
    };
  }
};

export default {
  createForms,
  getFormType
};
