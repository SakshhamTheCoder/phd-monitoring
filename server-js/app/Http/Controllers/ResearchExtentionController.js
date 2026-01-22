import { ResearchExtentionsForm, User, Student, Faculty } from '../../../models/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: Implement trait equivalents:
// - GeneralFormHandler
// - GeneralFormSubmitter
// - GeneralFormList
// - SaveFile
// - GeneralFormCreate
// - FilterLogicTrait

const saveUploadedFile = (file, folder, studentId) => {
  if (!file) return null;

  const uploadDir = path.join(__dirname, '../../../storage/uploads', folder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `${folder}_${studentId}_${timestamp}${path.extname(file.originalname)}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, file.buffer);

  return `uploads/${folder}/${fileName}`;
};

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
      include: ['current_role', 'student', 'faculty']
    });

    // TODO: Implement listForms and listFormsStudent trait methods
    // This should list all research extension forms based on user role

    const forms = await ResearchExtentionsForm.findAll({
      include: [
        {
          model: Student,
          as: 'student',
          include: ['user', 'supervisors', 'department']
        }
      ]
    });

    return res.status(200).json({
      forms: forms,
      fields: ['name', 'roll_no', 'date_of_synopsis', 'supervisors'],
      titles: ['Name', 'Roll No', 'Date of Synopsis', 'Supervisors']
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

    const changes = await user.student.getResearchExtentions();

    let steps = [
      'student',
      'faculty',
      'phd_coordinator',
      'hod',
      'dra',
      'dordc',
      'complete'
    ];

    if (changes.length > 0) {
      steps = [
        'student',
        'faculty',
        'phd_coordinator',
        'hod',
        'dra',
        'dordc',
        'director',
        'complete'
      ];
    }

    // TODO: Implement createForms trait method
    const form = await ResearchExtentionsForm.create({
      student_id: user.student.roll_no,
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

    const form = await ResearchExtentionsForm.findByPk(form_id, {
      include: [
        {
          model: Student,
          as: 'student',
          include: ['user', 'department', 'supervisors']
        }
      ]
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // TODO: Implement role-specific form handlers
    // (handleStudentForm, handleHodForm, handleCoordinatorForm, etc.)

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

    const form = await ResearchExtentionsForm.findByPk(form_id);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const role = user.current_role?.role;

    // Handle role-specific submissions
    switch (role) {
      case 'student':
        const { reason, duration, research_pdf } = req.body;

        if (!reason || !req.file) {
          return res.status(400).json({
            message: 'reason and research_pdf are required'
          });
        }

        const filePath = saveUploadedFile(req.file, 'research_extentions', user.student.roll_no);

        form.reason = reason;
        if (duration) {
          form.duration = duration;
        }
        form.research_pdf = filePath;
        form.stage = 'faculty';
        form.student_lock = true;
        await form.save();

        return res.status(200).json({
          message: 'Form submitted successfully',
          form
        });

      case 'faculty':
        // TODO: Implement supervisor submission logic
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
        const prevExtensions = await form.student.getResearchExtentions();

        if (prevExtensions.length === 0) {
          form.status = 'approved';
          form.stage = 'complete';
          form.dordc_lock = true;
          // TODO: Create research extension record
          await form.save();
        } else {
          form.stage = 'director';
          form.dordc_lock = true;
          await form.save();
        }
        break;

      case 'director':
        form.status = 'approved';
        form.stage = 'complete';
        form.director_lock = true;
        // TODO: Create research extension record
        await form.save();
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

    const { form_ids } = req.body;

    if (!form_ids || !Array.isArray(form_ids)) {
      return res.status(400).json({
        message: 'form_ids array is required'
      });
    }

    // Submit each form
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
