/**
 * StudentSemesterOffFormController
 * Ported from PHP: app/Http/Controllers/StudentSemesterOffFormController.php
 * 
 * Handles student semester off form workflow
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleFacultyForm,
    handleCoordinatorForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent, getAvailableFilters } from './Traits/GeneralFormList.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import { saveUploadedFile } from './Traits/SaveFile.js';
import { validateSemesterCode } from './Traits/HasSemesterCodeValidation.js';
import {
    StudentSemesterOffForm,
    StudentSemesterOff,
    Semester
} from '../../Models/index.js';

/**
 * Get available filters
 */
export const listFilters = async (req, res) => {
    try {
        const filters = await getAvailableFilters('forms');
        return res.status(200).json(filters);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * List semester off forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, StudentSemesterOffForm, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, StudentSemesterOffForm, req, null, false, {
            fields: ['name', 'roll_no', 'reason', 'semester_off_required'],
            extra_fields: {
                semester_off_required: (form) => form.semester_off_required
            },
            titles: ['Name', 'Roll No', 'Reason', 'Semester Off Required']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new semester off form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(StudentSemesterOffForm, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load semester off form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = StudentSemesterOffForm;
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

        return res.status(result.status).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Submit semester off form - role dispatcher
 */
export const submit = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;

        let result;
        switch (role?.role) {
            case 'student':
                result = await studentSubmit(user, req, form_id);
                break;
            case 'faculty':
                result = await supervisorSubmit(user, req, form_id);
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
            case 'phd_coordinator':
                result = await coordinatorSubmit(user, req, form_id);
                break;
            case 'director':
                result = await directorSubmit(user, req, form_id);
                break;
            default:
                return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Bulk submit forms
 */
export const bulkSubmit = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director'];

        if (!allowedRoles.includes(role?.role)) {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_ids } = req.body;
        if (!form_ids || !Array.isArray(form_ids)) {
            return res.status(400).json({ message: 'No form IDs provided' });
        }

        req.body.approval = true;
        for (const formId of form_ids) {
            req.params.form_id = formId;
            await submit(req, { status: () => ({ json: () => {} }) });
        }

        return res.status(200).json({ message: 'Forms submitted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Private submission handlers ---

const studentSubmit = async (user, req, form_id) => {
    const { reason, semester_off_required, semester_code } = req.body;

    // Validation
    if (!reason) {
        return { status: 422, data: { message: 'reason is required' } };
    }
    if (!semester_off_required) {
        return { status: 422, data: { message: 'semester_off_required is required' } };
    }

    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'student', 'student', 'faculty', async (formInstance) => {
        // Check for previous semester off
        const prevSemesterOff = await StudentSemesterOff.count({
            where: { student_id: user.student?.roll_no }
        });

        if (prevSemesterOff > 0) {
            if (req.files?.previous_approval_pdf) {
                const link = await saveUploadedFile(req.files.previous_approval_pdf[0], 'semester_off', user.student.roll_no);
                formInstance.previous_approval_pdf = link;
            } else {
                throw new Error('previous_approval_pdf is required for repeat semester off');
            }
        }

        // Validate semester code
        const validator = validateSemesterCode(semester_code || semester_off_required);
        if (!validator.valid) {
            throw new Error('Invalid semester code');
        }

        if (validator.in_db) {
            formInstance.semester_id = validator.semester_id;
        } else {
            // Create or update semester
            const semester = await Semester.findOrCreate({
                where: { semester_code: semester_off_required },
                defaults: { semester: semester_off_required }
            });
            formInstance.semester_id = semester[0].id;
        }

        formInstance.reason = reason;
        formInstance.semester_off_required = semester_off_required;

        // Save proof PDF if provided
        if (req.files?.proof_pdf) {
            const link = await saveUploadedFile(req.files.proof_pdf[0], 'semester_off', user.student.roll_no);
            formInstance.proof_pdf = link;
        }

        await formInstance.save();
    });
};

const supervisorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'faculty', 'student', 'phd_coordinator');
};

const coordinatorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'phd_coordinator', 'faculty', 'hod');
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'hod', 'phd_coordinator', 'dra');
};

const draSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'dra', 'hod', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'dordc', 'dra', 'director');
};

const directorSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, StudentSemesterOffForm, 'director', 'dordc', 'complete', async (formInstance) => {
        if (approval) {
            formInstance.completion = 'complete';
            formInstance.status = 'approved';

            // Create semester off record
            await StudentSemesterOff.create({
                student_id: formInstance.student_id,
                semester_id: formInstance.semester_id,
                reason: formInstance.reason,
                semester_off_required: formInstance.semester_off_required,
                proof_pdf: formInstance.proof_pdf
            });

            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Semester Off approved by Director', user.name);
            }
        }
        await formInstance.save();
    });
};

export default {
    listFilters,
    listForm,
    createForm,
    loadForm,
    submit,
    bulkSubmit
};
