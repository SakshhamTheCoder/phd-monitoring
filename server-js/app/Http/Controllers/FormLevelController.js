import {
  User,
  Forms,
  ConstituteOfIRB,
  IrbSubForm,
  ListOfExaminersForm,
  Presentation,
  ResearchExtentionsForm,
  StudentSemesterOffForm,
  StudentStatusChangeForms,
  SupervisorAllocation,
  SupervisorChangeForm,
  SynopsisSubmission,
  ThesisExtentionForm,
  ThesisSubmission
} from '../../../models/index.js';

// Helper function to get the model based on form type
const getModel = (formType) => {
  const modelMap = {
    'supervisor-allocation': SupervisorAllocation,
    'irb-submission': IrbSubForm,
    'irb-constitution': ConstituteOfIRB,
    'synopsis-submission': SynopsisSubmission,
    'list-of-examiners': ListOfExaminersForm,
    'thesis-submission': ThesisSubmission,
    'status-change': StudentStatusChangeForms,
    'semester-off': StudentSemesterOffForm,
    'irb-extension': ResearchExtentionsForm,
    'supervisor-change': SupervisorChangeForm,
    'thesis-extension': ThesisExtentionForm,
    'presentation': Presentation
  };

  if (!modelMap[formType]) {
    throw new Error('Invalid form type');
  }

  return modelMap[formType];
};

// Helper function to set availability flags based on role
const setAvailable = async (formType, role) => {
  formType.stage = role;

  const availabilityMap = {
    'student': 'student_available',
    'phd_coordinator': 'phd_coordinator_available',
    'external': 'external_available',
    'dra': 'dra_available',
    'dordc': 'dordc_available',
    'director': 'director_available',
    'hod': 'hod_available',
    'supervisor': 'supervisor_available',
    'doctoral': 'doctoral_available'
  };

  if (availabilityMap[role]) {
    formType[availabilityMap[role]] = false;
  }

  await formType.save();
};

// Helper function to set role-specific locks and stage
const setRole = async (formType, role) => {
  const steps = formType.steps;

  if (steps) {
    const index = steps.indexOf(role);
    formType.current_step = index;
    formType.maximum_step = index > formType.maximum_step ? index : formType.maximum_step;
    formType.stage = role;
  }

  const lockMap = {
    'student': 'student_lock',
    'phd_coordinator': 'phd_coordinator_lock',
    'external': 'external_lock',
    'dra': 'dra_lock',
    'dordc': 'dordc_lock',
    'director': 'director_lock',
    'hod': 'hod_lock',
    'supervisor': 'supervisor_lock',
    'doctoral': 'doctoral_lock'
  };

  if (lockMap[role]) {
    formType[lockMap[role]] = false;
  }

  await formType.save();
};

export const updateFormLevel = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({
        message: 'You do not have permission to update form level'
      });
    }

    const { form_type, form_id, roll_no, role } = req.body;

    if (!form_type || !form_id || !roll_no || !role) {
      return res.status(400).json({
        message: 'form_type, form_id, roll_no, and role are required'
      });
    }

    const Model = getModel(form_type);

    if (form_type === 'presentation') {
      const form = await Presentation.findByPk(form_id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }
      await setRole(form, role);
    } else {
      const form = await Model.findByPk(form_id);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }
      await setRole(form, role);

      const formBase = await Forms.findOne({
        where: {
          form_type: form_type,
          student_id: roll_no
        }
      });

      if (formBase) {
        await setAvailable(formBase, role);
      }
    }

    return res.status(200).json({
      message: 'Form level updated successfully'
    });
  } catch (error) {
    console.error('Error updating form level:', error);
    return res.status(500).json({
      message: 'Failed to update form level',
      error: error.message
    });
  }
};

export const listForms = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({
        message: 'You do not have permission to list forms'
      });
    }

    const { roll_no } = req.body;

    if (!roll_no) {
      return res.status(400).json({
        message: 'roll_no is required'
      });
    }

    const forms = await Forms.findAll({
      where: { student_id: roll_no }
    });

    const ret = [];

    for (const form of forms) {
      try {
        const Model = getModel(form.form_type);
        const formData = await Model.findAll({
          where: { student_id: roll_no }
        });

        if (formData && formData.length > 0) {
          for (const formItem of formData) {
            ret.push({
              form_type: form.form_type,
              form_name: form.form_name,
              form_id: formItem.id,
              roll_no: formItem.student_id,
              status: formItem.status,
              current_step: formItem.current_step,
              maximum_step: formItem.maximum_step,
              stage: formItem.stage,
              created_at: formItem.created_at,
              count: form.count,
              maximum_count: form.max_count,
              steps: form.steps
            });
          }
        }
      } catch (modelError) {
        console.error(`Error processing form type ${form.form_type}:`, modelError);
      }
    }

    return res.status(200).json({
      forms: ret
    });
  } catch (error) {
    console.error('Error listing forms:', error);
    return res.status(500).json({
      message: 'Failed to list forms',
      error: error.message
    });
  }
};
