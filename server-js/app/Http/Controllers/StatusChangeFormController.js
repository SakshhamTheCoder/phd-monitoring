import { StudentStatusChangeForms, User, Student } from '../../../models/index.js';

// TODO: Implement trait equivalents (same as ResearchExtentionController)
// - GeneralFormHandler
// - GeneralFormSubmitter
// - GeneralFormList
// - SaveFile
// - GeneralFormCreate
// - FilterLogicTrait

export const listFilters = async (req, res) => {
  try {
    // TODO: Implement getAvailableFilters
    return res.status(200).json([]);
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      message: 'Failed to fetch filters',
      error: error.message
    });
  }
};

export const listForm = async (req, res) => {
  try {
    const { student_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student']
    });

    // TODO: Implement listForms and listFormsStudent trait methods

    const forms = await StudentStatusChangeForms.findAll({
      include: [
        {
          model: Student,
          as: 'student',
          include: ['user', 'department']
        }
      ]
    });

    return res.status(200).json({
      forms: forms,
      fields: ['name', 'roll_no', 'type_of_change', 'reason'],
      titles: ['Name', 'Roll No', 'Type of Change', 'Reason']
    });
  } catch (error) {
    console.error('Error listing forms:', error);
    return res.status(500).json({
      message: 'Failed to list forms',
      error: error.message
    });
  }
};

export const createForm = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student']
    });

    if (user.current_role?.role !== 'student') {
      return res.status(403).json({
        message: 'You are not authorized to access this resource'
      });
    }

    const statusChanges = await user.student.getStatusChanges();

    let steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'];

    if (statusChanges.length > 0) {
      steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director', 'complete'];
    }

    const change = user.student.current_status === 'full-time'
      ? 'full-time to part-time'
      : 'part-time to full-time';

    const form = await StudentStatusChangeForms.create({
      student_id: user.student.roll_no,
      type_of_change: change,
      steps: steps,
      stage: 'student',
      current_step: 0,
      maximum_step: 0,
      status: 'pending',
      student_lock: false
    });

    return res.status(201).json({
      message: 'Form created successfully',
      form: form
    });
  } catch (error) {
    console.error('Error creating form:', error);
    return res.status(500).json({
      message: 'Failed to create form',
      error: error.message
    });
  }
};

export const loadForm = async (req, res) => {
  try {
    const { form_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student', 'faculty']
    });

    const form = await StudentStatusChangeForms.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student',
          include: ['user', 'department']
        }
      ]
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // TODO: Implement role-specific form handlers
    return res.status(200).json({ form });
  } catch (error) {
    console.error('Error loading form:', error);
    return res.status(500).json({
      message: 'Failed to load form',
      error: error.message
    });
  }
};

export const submit = async (req, res) => {
  try {
    const { form_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student']
    });

    const form = await StudentStatusChangeForms.findByPk(form_id, {
      include: ['student']
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const role = user.current_role?.role;

    switch (role) {
      case 'student':
        const { reason } = req.body;

        if (!reason) {
          return res.status(400).json({ message: 'reason is required' });
        }

        const prevStatusChanges = await user.student.getStatusChanges();
        if (prevStatusChanges.length > 2) {
          return res.status(400).json({
            message: 'You have already changed your status twice'
          });
        }

        form.reason = reason;
        form.stage = 'faculty';
        form.student_lock = true;
        await form.save();
        break;

      case 'faculty':
        form.stage = 'phd_coordinator';
        form.supervisor_lock = true;
        await form.save();
        break;

      case 'phd_coordinator':
        form.stage = 'hod';
        form.phd_coordinator_lock = true;
        await form.save();
        break;

      case 'hod':
        form.stage = 'dra';
        form.hod_lock = true;
        await form.save();
        break;

      case 'dra':
        form.stage = 'dordc';
        form.dra_lock = true;
        await form.save();
        break;

      case 'dordc':
        const student = await form.getStudent();
        const studentStatusChanges = await student.getStatusChanges();

        if (studentStatusChanges.length > 1) {
          form.stage = 'director';
          form.dordc_lock = true;
          await form.save();
        } else {
          if (req.body.approval) {
            form.status = 'approved';
            form.completion = 'complete';
            form.stage = 'complete';
            form.dordc_lock = true;

            const newStatus = form.type_of_change === 'full-time to part-time' ? 'part-time' : 'full-time';
            student.current_status = newStatus;

            // TODO: Create status change record
            await form.save();
            await student.save();
          }
        }
        break;

      case 'director':
        if (req.body.approval) {
          form.status = 'approved';
          form.completion = 'complete';
          form.stage = 'complete';
          form.director_lock = true;

          const studentForDir = await form.getStudent();
          const newStatusDir = form.type_of_change === 'full-time to part-time' ? 'part-time' : 'full-time';
          studentForDir.current_status = newStatusDir;

          // TODO: Create status change record
          await form.save();
          await studentForDir.save();
        }
        break;

      default:
        return res.status(403).json({
          message: 'You are not authorized to access this resource'
        });
    }

    return res.status(200).json({
      message: 'Form submitted successfully',
      form
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    return res.status(500).json({
      message: 'Failed to submit form',
      error: error.message
    });
  }
};

export const bulkSubmit = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    const allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director'];
    if (!allowedRoles.includes(user.current_role?.role)) {
      return res.status(403).json({
        message: 'You are not authorized to access this resource'
      });
    }

    const { form_ids, approval } = req.body;

    if (!form_ids || !Array.isArray(form_ids)) {
      return res.status(400).json({
        message: 'form_ids array is required'
      });
    }

    for (const formId of form_ids) {
      req.params.form_id = formId;
      req.body.approval = true;
      await submit(req, res);
    }

    return res.status(200).json({
      message: 'Forms submitted successfully'
    });
  } catch (error) {
    console.error('Error bulk submitting forms:', error);
    return res.status(500).json({
      message: 'Failed to bulk submit forms',
      error: error.message
    });
  }
};
