/**
 * StatusChangeFormController
 * Ported from PHP: app/Http/Controllers/StatusChangeFormController.php
 *
 * Uses traits: GeneralFormHandler, GeneralFormSubmitter, GeneralFormList,
 *              GeneralFormCreate, SaveFile, FilterLogicTrait
 */

import { StudentStatusChangeForms, StudentStatusChange, User, Student } from '../../Models/index.js';
import { getAvailableFilters } from './Traits/FilterLogicTrait.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent } from './Traits/GeneralFormList.js';
import {
  handleStudentForm,
  handleHodForm,
  handleCoordinatorForm,
  handleAdminForm,
  handleFacultyForm,
} from './Traits/GeneralFormHandler.js';

export const listFilters = async (req, res) => {
  try {
    const filters = await getAvailableFilters('status_changes');
    return res.status(200).json(filters);
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      message: 'Failed to fetch filters',
      error: error.message,
    });
  }
};

export const listForm = async (req, res) => {
  try {
    const { student_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student', 'faculty'],
    });

    if (student_id) {
      const result = await listFormsStudent(user, StudentStatusChangeForms, student_id);
      return res.status(200).json(result);
    }

    const result = await listForms(user, StudentStatusChangeForms, req, null, false, [
      'name', 'roll_no', 'type_of_change', 'reason',
    ]);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error listing forms:', error);
    return res.status(500).json({
      message: 'Failed to list forms',
      error: error.message,
    });
  }
};

export const createForm = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student'],
    });

    const role = user.current_role;
    if (role?.role !== 'student') {
      return res.status(403).json({
        message: 'You are not authorized to access this resource',
      });
    }

    const statusChanges = await user.student.getStatusChanges();

    let steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'];
    if (statusChanges && statusChanges.length > 0) {
      steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director', 'complete'];
    }

    const data = {
      roll_no: user.student.roll_no,
      steps: steps,
      role: role.role,
      name: `${user.first_name} ${user.last_name}`,
    };

    // createForms with callback to set type_of_change
    const result = await createForms(StudentStatusChangeForms, data, async (formInstance) => {
      const change = user.student.current_status === 'full-time'
        ? 'full-time to part-time'
        : 'part-time to full-time';
      formInstance.type_of_change = change;
      await formInstance.save();
    });

    return res.status(result.status).json({
      message: result.message,
      form: result.form,
    });
  } catch (error) {
    console.error('Error creating form:', error);
    return res.status(500).json({
      message: 'Failed to create form',
      error: error.message,
    });
  }
};

export const loadForm = async (req, res) => {
  try {
    const { form_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student', 'faculty'],
    });

    const role = user.current_role;
    const Model = StudentStatusChangeForms;
    const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc'];

    let result;
    switch (role?.role) {
      case 'student':
        // PHP uses customLoadStudent which wraps handleStudentForm
        result = await handleStudentForm(user, form_id, Model, steps);
        break;
      case 'hod':
        result = await handleHodForm(user, form_id, Model);
        break;
      case 'phd_coordinator':
        result = await handleCoordinatorForm(user, form_id, Model);
        break;
      case 'dra':
      case 'dordc':
      case 'director':
        result = await handleAdminForm(user, form_id, Model);
        break;
      case 'faculty':
        result = await handleFacultyForm(user, form_id, Model);
        break;
      case 'admin':
        result = await handleAdminForm(user, form_id, Model, true);
        break;
      default:
        return res.status(403).json({ message: 'You are not authorized to access this resource' });
    }

    return res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('Error loading form:', error);
    return res.status(500).json({
      message: 'Failed to load form',
      error: error.message,
    });
  }
};

export const submit = async (req, res) => {
  try {
    const { form_id } = req.params;
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student'],
    });

    const role = user.current_role;

    let result;
    switch (role?.role) {
      case 'student':
        result = await studentSubmit(user, req, form_id);
        break;
      case 'faculty':
        result = await supervisorSubmit(user, req, form_id);
        break;
      case 'phd_coordinator':
        result = await coordinatorSubmit(user, req, form_id);
        break;
      case 'hod':
        result = await hodSubmit(user, req, form_id);
        break;
      case 'dra':
        result = await draSubmit(user, req, form_id);
        break;
      case 'dordc':
        result = await dordcSubmit(user, req, form_id);
        break;
      case 'director':
        result = await directorSubmit(user, req, form_id);
        break;
      default:
        return res.status(403).json({ message: 'You are not authorized to access this resource' });
    }

    return res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('Error submitting form:', error);
    return res.status(500).json({
      message: 'Failed to submit form',
      error: error.message,
    });
  }
};

export const bulkSubmit = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role'],
    });

    const allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director'];
    if (!allowedRoles.includes(user.current_role?.role)) {
      return res.status(403).json({
        message: 'You are not authorized to access this resource',
      });
    }

    const { form_ids } = req.body;
    if (!form_ids || !Array.isArray(form_ids)) {
      return res.status(400).json({ message: 'form_ids array is required' });
    }

    req.body.approval = true;
    for (const formId of form_ids) {
      req.params.form_id = formId;
      await submit(req, res);
    }

    return res.status(200).json({ message: 'Forms submitted successfully' });
  } catch (error) {
    console.error('Error bulk submitting forms:', error);
    return res.status(500).json({
      message: 'Failed to bulk submit forms',
      error: error.message,
    });
  }
};

// ---- Private submit methods (match PHP exactly) ----

const studentSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  return await submitForm(user, req, form_id, Model, 'student', 'student', 'faculty', async (formInstance) => {
    const { reason } = req.body;
    if (!reason) {
      throw new Error('reason is required');
    }
    formInstance.reason = reason;

    const prevStatusChanges = await user.student.getStatusChanges();
    if (prevStatusChanges && prevStatusChanges.length > 2) {
      throw new Error('You have already changed your status twice');
    }
  });
};

const supervisorSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  return await submitForm(user, req, form_id, Model, 'faculty', 'student', 'phd_coordinator');
};

const coordinatorSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  return await submitForm(user, req, form_id, Model, 'phd_coordinator', 'faculty', 'hod');
};

const hodSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  return await submitForm(user, req, form_id, Model, 'hod', 'phd_coordinator', 'dra');
};

const draSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  return await submitForm(user, req, form_id, Model, 'dra', 'hod', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  const formRecord = await StudentStatusChangeForms.findByPk(form_id, { include: ['student'] });
  const student = formRecord.student;
  const prevStatusChanges = await student.getStatusChanges();

  if (prevStatusChanges && prevStatusChanges.length > 1) {
    // Subsequent changes — forward to director
    return await submitForm(user, req, form_id, Model, 'dordc', 'dra', 'director');
  } else {
    // First change — approve at dordc level
    return await submitForm(user, req, form_id, Model, 'dordc', 'dra', 'complete', async (formInstance) => {
      if (req.body.approval) {
        formInstance.status = 'approved';
        formInstance.completion = 'complete';
        if (formInstance.addHistoryEntry) {
          formInstance.addHistoryEntry('Status Change Approved', `${user.first_name} ${user.last_name}`);
        }
        const studentRecord = await formInstance.getStudent();
        studentRecord.current_status = formInstance.type_of_change === 'full-time to part-time' ? 'part-time' : 'full-time';
        await StudentStatusChange.create({
          type_of_change: formInstance.type_of_change,
          reason: formInstance.reason,
          student_id: studentRecord.roll_no,
        });
        await formInstance.save();
        await studentRecord.save();
      }
    });
  }
};

const directorSubmit = async (user, req, form_id) => {
  const Model = StudentStatusChangeForms;
  return await submitForm(user, req, form_id, Model, 'director', 'dordc', 'complete', async (formInstance) => {
    if (req.body.approval) {
      formInstance.status = 'approved';
      formInstance.completion = 'complete';
      if (formInstance.addHistoryEntry) {
        formInstance.addHistoryEntry('Status Change Approved', `${user.first_name} ${user.last_name}`);
      }
      const studentRecord = await formInstance.getStudent();
      studentRecord.current_status = formInstance.type_of_change === 'full-time to part-time' ? 'part-time' : 'full-time';
      await StudentStatusChange.create({
        type_of_change: formInstance.type_of_change,
        reason: formInstance.reason,
        student_id: studentRecord.roll_no,
      });
      await formInstance.save();
      await studentRecord.save();
    }
  });
};

export default {
  listFilters,
  listForm,
  createForm,
  loadForm,
  submit,
  bulkSubmit,
};
