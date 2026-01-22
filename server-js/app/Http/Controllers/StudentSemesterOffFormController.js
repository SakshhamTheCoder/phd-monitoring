import { StudentSemesterOffForm, User, Student } from '../../../models/index.js';

// TODO: This controller uses GeneralFormHandler, GeneralFormSubmitter, GeneralFormList, SaveFile, GeneralFormCreate, FilterLogicTrait traits
// Implement the trait methods or refactor to standalone functions

export const listFilters = async (req, res) => {
  try {
    return res.status(200).json([]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listForm = async (req, res) => {
  try {
    const forms = await StudentSemesterOffForm.findAll({
      include: [{ model: Student, as: 'student', include: ['user', 'department'] }]
    });
    return res.status(200).json({ forms });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createForm = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: ['current_role', 'student'] });
    if (user.current_role?.role !== 'student') {
      return res.status(403).json({ message: 'You are not authorized' });
    }

    const form = await StudentSemesterOffForm.create({
      student_id: user.student.roll_no,
      steps: ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director', 'complete'],
      stage: 'student',
      status: 'pending'
    });

    return res.status(201).json({ message: 'Form created successfully', form });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const loadForm = async (req, res) => {
  try {
    const { form_id } = req.params;
    const form = await StudentSemesterOffForm.findByPk(form_id, {
      include: [{ model: Student, as: 'student', include: ['user', 'department'] }]
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    return res.status(200).json({ form });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const submit = async (req, res) => {
  try {
    const { form_id } = req.params;
    const user = await User.findByPk(req.user.id, { include: ['current_role'] });
    const form = await StudentSemesterOffForm.findByPk(form_id);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // TODO: Implement role-specific submission logic
    const role = user.current_role?.role;
    const stageMap = {
      'student': 'faculty',
      'faculty': 'phd_coordinator',
      'phd_coordinator': 'hod',
      'hod': 'dra',
      'dra': 'dordc',
      'dordc': 'director',
      'director': 'complete'
    };

    if (stageMap[role]) {
      form.stage = stageMap[role];
      form[`${role}_lock`] = true;
      await form.save();
      return res.status(200).json({ message: 'Form submitted successfully', form });
    }

    return res.status(403).json({ message: 'You are not authorized' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const bulkSubmit = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: ['current_role'] });
    const { form_ids } = req.body;

    if (!['hod', 'phd_coordinator', 'dra', 'dordc', 'director'].includes(user.current_role?.role)) {
      return res.status(403).json({ message: 'You are not authorized' });
    }

    for (const formId of form_ids) {
      req.params.form_id = formId;
      await submit(req, res);
    }

    return res.status(200).json({ message: 'Forms submitted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
