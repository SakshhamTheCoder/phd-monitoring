import {
  Forms,
  Student,
  User,
  Department,
  ConstituteOfIRB,
  IrbSubForm,
  ResearchExtentionsForm,
  ListOfExaminersForm,
  Presentation,
  StudentSemesterOffForm,
  SupervisorChangeForm,
  SupervisorAllocation,
  StudentStatusChangeForms,
  SynopsisSubmission,
  ThesisExtentionForm,
  ThesisSubmission
} from '../../../models/index.js';
import { sequelize } from '../../../models/index.js';

const formModels = {
  'irb-constitution': ConstituteOfIRB,
  'irb-submission': IrbSubForm,
  'irb-extension': ResearchExtentionsForm,
  'list-of-examiners': ListOfExaminersForm,
  'presentation': Presentation,
  'semester-off': StudentSemesterOffForm,
  'status-change': StudentStatusChangeForms,
  'supervisor-allocation': SupervisorAllocation,
  'supervisor-change': SupervisorChangeForm,
  'synopsis-submission': SynopsisSubmission,
  'thesis-extension': ThesisExtentionForm,
  'thesis-submission': ThesisSubmission
};

const formMetadata = {
  'supervisor-allocation': {
    form_name: 'Supervisor Allocation Form',
    max_count: 1,
    steps: ['student', 'phd_coordinator', 'hod']
  },
  'irb-constitution': {
    form_name: 'IRB Constitution',
    max_count: 1,
    steps: ['student', 'faculty', 'hod', 'adordc', 'dordc', 'complete']
  },
  'irb-submission': {
    form_name: 'Revised IRB',
    max_count: 1,
    steps: ['student', 'faculty', 'external', 'doctoral', 'hod', 'adordc', 'dordc', 'complete']
  },
  'irb-extension': {
    form_name: 'IRB Extension',
    max_count: 10,
    steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete']
  },
  'supervisor-change': {
    form_name: 'Supervisor Change',
    max_count: 10,
    steps: ['student', 'phd_coordinator', 'hod', 'dordc', 'dra', 'complete']
  },
  'status-change': {
    form_name: 'Change of Status',
    max_count: 2,
    steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete']
  },
  'semester-off': {
    form_name: 'Semester Off',
    max_count: 10,
    steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director', 'complete']
  },
  'list-of-examiners': {
    form_name: 'List of Examiners',
    max_count: 1,
    steps: ['faculty', 'hod', 'dordc', 'director', 'complete']
  },
  'synopsis-submission': {
    form_name: 'Synopsis Submission',
    max_count: 1,
    steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'director', 'complete']
  },
  'thesis-submission': {
    form_name: 'Thesis Submission',
    max_count: 1,
    steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'complete']
  },
  'thesis-extension': {
    form_name: 'Thesis Extension',
    max_count: 10,
    steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete']
  }
};

const lockFields = {
  'student': 'student_lock',
  'faculty': 'supervisor_lock',
  'phd_coordinator': 'phd_coordinator_lock',
  'hod': 'hod_lock',
  'dordc': 'dordc_lock',
  'dra': 'dra_lock',
  'director': 'director_lock',
  'doctoral': 'doctoral_lock',
  'external': 'external_lock'
};

export const getStudentForms = async (req, res) => {
  try {
    const { student_id } = req.params;

    const student = await Student.findByPk(student_id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'department_name']
        }
      ]
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get existing general forms
    const existingForms = await Forms.findAll({
      where: { student_id: student_id }
    });

    const existingFormsMap = {};
    existingForms.forEach(form => {
      existingFormsMap[form.form_type] = form;
    });

    const formsData = [];

    // Iterate through all available form types
    for (const [formType, modelClass] of Object.entries(formModels)) {
      const generalForm = existingFormsMap[formType];
      const metadata = formMetadata[formType] || {};

      if (generalForm) {
        // Form exists in forms table
        const formInstances = await modelClass.findAll({
          where: { student_id: student_id }
        });

        formsData.push({
          form_type: formType,
          form_name: generalForm.form_name,
          exists_in_forms_table: true,
          general_form: {
            id: generalForm.id,
            stage: generalForm.stage,
            count: generalForm.count,
            max_count: generalForm.max_count,
            student_available: generalForm.student_available,
            supervisor_available: generalForm.supervisor_available,
            hod_available: generalForm.hod_available,
            phd_coordinator_available: generalForm.phd_coordinator_available,
            dordc_available: generalForm.dordc_available,
            dra_available: generalForm.dra_available,
            director_available: generalForm.director_available,
            doctoral_available: generalForm.doctoral_available
          },
          instances: formInstances.map(instance => ({
            id: instance.id,
            status: instance.status,
            stage: instance.stage,
            completion: instance.completion,
            current_step: instance.current_step,
            maximum_step: instance.maximum_step,
            steps: instance.steps,
            locks: {
              student: instance.student_lock,
              supervisor: instance.supervisor_lock,
              phd_coordinator: instance.phd_coordinator_lock,
              hod: instance.hod_lock,
              dordc: instance.dordc_lock,
              dra: instance.dra_lock,
              director: instance.director_lock,
              doctoral: instance.doctoral_lock,
              external: instance.external_lock
            },
            approvals: {
              supervisor: instance.supervisor_approval,
              phd_coordinator: instance.phd_coordinator_approval,
              hod: instance.hod_approval,
              dordc: instance.dordc_approval,
              dra: instance.dra_approval,
              director: instance.director_approval,
              doctoral: instance.doctoral_approval,
              external: instance.external_approval
            },
            created_at: instance.created_at,
            updated_at: instance.updated_at
          }))
        });
      } else {
        // Form does not exist in forms table yet
        formsData.push({
          form_type: formType,
          form_name: metadata.form_name || formType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          exists_in_forms_table: false,
          general_form: {
            id: null,
            stage: 'student',
            count: 0,
            max_count: metadata.max_count || 1,
            student_available: false,
            supervisor_available: false,
            hod_available: false,
            phd_coordinator_available: false,
            dordc_available: false,
            dra_available: false,
            director_available: false,
            doctoral_available: false
          },
          instances: []
        });
      }
    }

    return res.status(200).json({
      success: true,
      student: {
        roll_no: student.roll_no,
        name: `${student.user.first_name} ${student.user.last_name}`.trim(),
        department: student.department.department_name
      },
      forms: formsData
    });
  } catch (error) {
    console.error('Error fetching student forms:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const createFormInstance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { student_id, form_type, stage, enable_form } = req.body;

    if (!student_id || !form_type) {
      return res.status(400).json({
        message: 'student_id and form_type are required'
      });
    }

    const student = await Student.findByPk(student_id);
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Student not found' });
    }

    const modelClass = formModels[form_type];
    if (!modelClass) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid form type' });
    }

    // Check or create general form entry
    let generalForm = await Forms.findOne({
      where: {
        form_type: form_type,
        student_id: student_id
      }
    });

    if (!generalForm) {
      // Create new forms table entry
      const metadata = formMetadata[form_type] || {};
      const availableRoles = metadata.steps || ['student'];

      generalForm = await Forms.create({
        student_id: student_id,
        form_type: form_type,
        form_name: metadata.form_name || form_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        department_id: student.department_id,
        stage: metadata.steps ? metadata.steps[0] : 'student',
        count: 0,
        max_count: metadata.max_count || 1,
        student_available: availableRoles.includes('student'),
        supervisor_available: availableRoles.includes('supervisor') || availableRoles.includes('faculty'),
        hod_available: availableRoles.includes('hod'),
        phd_coordinator_available: availableRoles.includes('phd_coordinator'),
        dordc_available: availableRoles.includes('dordc'),
        dra_available: availableRoles.includes('dra'),
        director_available: availableRoles.includes('director'),
        doctoral_available: availableRoles.includes('doctoral'),
        external_available: availableRoles.includes('external')
      }, { transaction });
    }

    // Check if max count reached
    if (generalForm.count >= generalForm.max_count) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Maximum form count reached' });
    }

    // Create form instance only if enable_form is not just enabling the form
    if (!enable_form) {
      const formInstance = await modelClass.create({
        student_id: student_id,
        status: 'pending',
        stage: stage || 'student',
        completion: 'incomplete',
        current_step: 0,
        maximum_step: 0,
        steps: formMetadata[form_type]?.steps || ['student'],
        student_lock: false
      }, { transaction });

      // Update general form count
      generalForm.count++;
      await generalForm.save({ transaction });

      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: 'Form instance created successfully',
        form_id: formInstance.id
      });
    } else {
      // Just enabling the form in forms table
      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: 'Form enabled successfully',
        form_id: generalForm.id
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating form instance:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateFormControl = async (req, res) => {
  try {
    const { student_id, form_type, form_id, stage, current_step, maximum_step, locks } = req.body;

    if (!student_id || !form_type || !form_id) {
      return res.status(400).json({
        message: 'student_id, form_type, and form_id are required'
      });
    }

    const modelClass = formModels[form_type];
    if (!modelClass) {
      return res.status(400).json({ message: 'Invalid form type' });
    }

    const formInstance = await modelClass.findOne({
      where: {
        id: form_id,
        student_id: student_id
      }
    });

    if (!formInstance) {
      return res.status(404).json({ message: 'Form instance not found' });
    }

    // Update stage
    if (stage !== undefined) {
      if (stage === 'faculty') {
        formInstance.stage = 'supervisor';
      } else {
        formInstance.stage = stage;
      }
    }

    // Update steps
    if (current_step !== undefined) {
      formInstance.current_step = current_step;
    }

    if (maximum_step !== undefined) {
      formInstance.maximum_step = maximum_step;
    }

    // Update locks
    if (locks) {
      for (const [role, lockValue] of Object.entries(locks)) {
        const lockField = lockFields[role];
        if (lockField) {
          formInstance[lockField] = lockValue;
        }
      }
    }

    // TODO: Implement addHistoryEntry method on form models
    // formInstance.addHistoryEntry('Form control updated by admin', 'Admin');
    await formInstance.save();

    return res.status(200).json({
      success: true,
      message: 'Form control updated successfully'
    });
  } catch (error) {
    console.error('Error updating form control:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const toggleFormAvailability = async (req, res) => {
  try {
    const { student_id, form_type, role, available } = req.body;

    if (!student_id || !form_type || !role || available === undefined) {
      return res.status(400).json({
        message: 'student_id, form_type, role, and available are required'
      });
    }

    const generalForm = await Forms.findOne({
      where: {
        form_type: form_type,
        student_id: student_id
      }
    });

    if (!generalForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const field = `${role}_available`;
    if (generalForm[field] !== undefined) {
      generalForm[field] = available;
      await generalForm.save();

      return res.status(200).json({
        success: true,
        message: 'Form availability updated'
      });
    }

    return res.status(400).json({ message: 'Invalid role' });
  } catch (error) {
    console.error('Error toggling form availability:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateGeneralFormStage = async (req, res) => {
  try {
    const { student_id, form_type, stage } = req.body;

    if (!student_id || !form_type || !stage) {
      return res.status(400).json({
        message: 'student_id, form_type, and stage are required'
      });
    }

    const generalForm = await Forms.findOne({
      where: {
        form_type: form_type,
        student_id: student_id
      }
    });

    if (!generalForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    generalForm.stage = stage;
    await generalForm.save();

    return res.status(200).json({
      success: true,
      message: 'General form stage updated'
    });
  } catch (error) {
    console.error('Error updating general form stage:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteFormInstance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { student_id, form_type, form_id } = req.body;

    if (!student_id || !form_type || !form_id) {
      return res.status(400).json({
        message: 'student_id, form_type, and form_id are required'
      });
    }

    const modelClass = formModels[form_type];
    if (!modelClass) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid form type' });
    }

    const formInstance = await modelClass.findOne({
      where: {
        id: form_id,
        student_id: student_id
      }
    });

    if (!formInstance) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Form instance not found' });
    }

    // Update general form count
    const generalForm = await Forms.findOne({
      where: {
        form_type: form_type,
        student_id: student_id
      }
    });

    if (generalForm && generalForm.count > 0) {
      generalForm.count--;
      await generalForm.save({ transaction });
    }

    await formInstance.destroy({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Form instance deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting form instance:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const disableForm = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { student_id, form_type } = req.body;

    if (!student_id || !form_type) {
      return res.status(400).json({
        message: 'student_id and form_type are required'
      });
    }

    const generalForm = await Forms.findOne({
      where: {
        form_type: form_type,
        student_id: student_id
      }
    });

    if (!generalForm) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Form not found' });
    }

    // Check if there are instances
    const modelClass = formModels[form_type];
    if (modelClass) {
      const instanceCount = await modelClass.count({
        where: { student_id: student_id }
      });

      if (instanceCount > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Cannot disable form with existing instances. Please delete all instances first.'
        });
      }
    }

    // Delete the general form entry
    await generalForm.destroy({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Form disabled successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error disabling form:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const getFormCreationData = (formType, studentId, departmentId) => {
  const metadata = formMetadata;
  const formMeta = metadata[formType];

  if (!formMeta) {
    return null;
  }

  const availableRoles = formMeta.steps || ['student'];

  return {
    student_id: studentId,
    department_id: departmentId,
    form_type: formType,
    form_name: formMeta.form_name,
    max_count: formMeta.max_count,
    stage: 'student',
    count: 0,
    student_available: availableRoles.includes('student'),
    supervisor_available: availableRoles.includes('faculty'),
    hod_available: availableRoles.includes('hod'),
    phd_coordinator_available: availableRoles.includes('phd_coordinator'),
    dordc_available: availableRoles.includes('dordc'),
    dra_available: availableRoles.includes('dra'),
    director_available: availableRoles.includes('director'),
    doctoral_available: availableRoles.includes('doctoral'),
    external_available: availableRoles.includes('external')
  };
};
