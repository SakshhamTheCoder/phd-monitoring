/**
 * ResearchExtentionController
 * Ported from PHP: app/Http/Controllers/ResearchExtentionController.php
 *
 * Uses traits: GeneralFormHandler, GeneralFormSubmitter, GeneralFormList,
 *              GeneralFormCreate, SaveFile, FilterLogicTrait
 */

import { ResearchExtentionsForm, ResearchExtentions, User, Student } from '../../Models/index.js';
import { getAvailableFilters } from './Traits/FilterLogicTrait.js';
import { saveUploadedFile } from './Traits/SaveFile.js';
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
    const filters = await getAvailableFilters('research_extentions');
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
      const result = await listFormsStudent(user, ResearchExtentionsForm, student_id);
      return res.status(200).json(result);
    }

    const result = await listForms(user, ResearchExtentionsForm, req, null, false, [
      'name', 'roll_no', 'date_of_synopsis', 'supervisors',
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

    const changes = await user.student.getResearchExtentions();

    let steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'];
    if (changes && changes.length > 0) {
      steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director', 'complete'];
    }

    const data = {
      roll_no: user.student.roll_no,
      steps: steps,
      role: role.role,
      name: `${user.first_name} ${user.last_name}`,
    };

    const result = await createForms(ResearchExtentionsForm, data);
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
    const Model = ResearchExtentionsForm;
    const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director'];

    let result;
    switch (role?.role) {
      case 'student':
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
  const Model = ResearchExtentionsForm;
  return await submitForm(user, req, form_id, Model, 'student', 'student', 'faculty', async (formInstance) => {
    const { reason, duration } = req.body;
    if (!reason) {
      throw new Error('reason is required');
    }

    formInstance.reason = reason;
    if (duration) {
      formInstance.duration = duration;
    }

    if (req.file) {
      const filePath = saveUploadedFile(req.file, 'research_extentions', user.student.roll_no);
      formInstance.research_pdf = filePath;
    }
  });
};

const supervisorSubmit = async (user, req, form_id) => {
  const Model = ResearchExtentionsForm;
  return await submitForm(user, req, form_id, Model, 'faculty', 'student', 'phd_coordinator');
};

const coordinatorSubmit = async (user, req, form_id) => {
  const Model = ResearchExtentionsForm;
  return await submitForm(user, req, form_id, Model, 'phd_coordinator', 'faculty', 'hod');
};

const hodSubmit = async (user, req, form_id) => {
  const Model = ResearchExtentionsForm;
  return await submitForm(user, req, form_id, Model, 'hod', 'phd_coordinator', 'dra');
};

const draSubmit = async (user, req, form_id) => {
  const Model = ResearchExtentionsForm;
  return await submitForm(user, req, form_id, Model, 'dra', 'hod', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
  const Model = ResearchExtentionsForm;
  const form = await ResearchExtentionsForm.findByPk(form_id, { include: ['student'] });
  const prevExtentions = await form.student.getResearchExtentions();

  if (!prevExtentions || prevExtentions.length === 0) {
    // First extension — approve at dordc level
    return await submitForm(user, req, form_id, Model, 'dordc', 'dra', 'complete', async (formInstance) => {
      formInstance.status = 'approved';
      // Create research extension record
      const student = await formInstance.getStudent();
      await ResearchExtentions.create({
        period_of_extension: formInstance.period_of_extention,
        research_pdf: formInstance.research_pdf,
        reason: formInstance.reason,
        research_extentions_id: formInstance.id,
        student_id: student.roll_no,
      });
      if (formInstance.addHistoryEntry) {
        formInstance.addHistoryEntry('Form Approved by DORDC', `${user.first_name} ${user.last_name}`);
      }
    });
  } else {
    // Subsequent extensions — forward to director
    return await submitForm(user, req, form_id, Model, 'dordc', 'dra', 'director');
  }
};

const directorSubmit = async (user, req, form_id) => {
  const Model = ResearchExtentionsForm;
  return await submitForm(user, req, form_id, Model, 'director', 'dordc', 'complete', async (formInstance) => {
    formInstance.status = 'approved';
    // Create research extension record
    const student = await formInstance.getStudent();
    await ResearchExtentions.create({
      period_of_extension: formInstance.period_of_extention,
      research_pdf: formInstance.research_pdf,
      reason: formInstance.reason,
      research_extentions_id: formInstance.id,
      student_id: student.roll_no,
    });
    if (formInstance.addHistoryEntry) {
      formInstance.addHistoryEntry('Form Approved by Director', `${user.first_name} ${user.last_name}`);
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
