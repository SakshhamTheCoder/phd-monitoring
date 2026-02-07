/**
 * ListOfExaminersController
 * Ported from PHP: app/Http/Controllers/ListOfExaminersController.php
 * 
 * Handles list of examiners form workflow for thesis evaluation
 */

import {
    handleHodForm,
    handleAdminForm,
    handleFacultyForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent, getAvailableFilters } from './Traits/GeneralFormList.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import {
    ListOfExaminersForm,
    ExaminersRecommendation,
    Faculty
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
 * List examiners forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, ListOfExaminersForm, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, ListOfExaminersForm, req, null, false, {
            fields: ['name', 'roll_no', 'supervisors'],
            extra_fields: {
                supervisors: (form) => {
                    if (!form.student?.supervisors) return '';
                    return form.student.supervisors.map(s => s.user?.name).join(', ');
                }
            },
            titles: ['Name', 'Roll No', 'Supervisors']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new examiners form - Faculty only
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { roll_no } = req.body;

        if (!roll_no) {
            return res.status(422).json({ message: 'roll_no is required' });
        }

        const steps = ['faculty', 'hod', 'dordc', 'director', 'complete'];

        if (role?.role !== 'faculty') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: roll_no,
            steps: steps,
            role: 'supervisor',
            supervisor_lock: 0,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(ListOfExaminersForm, data, null, true);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load examiners form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = ListOfExaminersForm;
        const steps = ['faculty', 'hod', 'dordc', 'director'];

        let result;
        switch (role?.role) {
            case 'hod':
                result = await handleHodForm(user, form_id, Model);
                break;
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
 * Submit examiners form - role dispatcher
 */
export const submit = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;

        let result;
        switch (role?.role) {
            case 'faculty':
                result = await supervisorSubmit(user, req, form_id);
                break;
            case 'hod':
                result = await hodSubmit(user, req, form_id);
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
        const allowedRoles = ['director'];

        if (!allowedRoles.includes(role?.role)) {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_ids } = req.body;
        if (!form_ids || !Array.isArray(form_ids)) {
            return res.status(422).json({ message: 'form_ids array is required' });
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

const supervisorSubmit = async (user, req, form_id) => {
    const { national, international } = req.body;

    req.body.approval = true;

    return await submitForm(user, req, form_id, ListOfExaminersForm, 'faculty', 'faculty', 'hod', async (formInstance) => {
        if (!national || !Array.isArray(national)) {
            throw new Error('national examiners are required');
        }
        if (!international || !Array.isArray(international)) {
            throw new Error('international examiners are required');
        }

        await processExaminers(national, 'national', formInstance, user, 4);
        await processExaminers(international, 'international', formInstance, user, 4);
    });
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ListOfExaminersForm, 'hod', 'faculty', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    const { approvals = [], rejections = [], approval } = req.body;

    return await submitForm(user, req, form_id, ListOfExaminersForm, 'dordc', 'hod', 'director', async (formInstance) => {
        // Process approvals
        for (const email of approvals) {
            const examiner = await ExaminersRecommendation.findOne({
                where: { form_id: formInstance.id, email }
            });
            if (examiner && examiner.recommendation !== 'approved') {
                examiner.recommendation = 'approved';
                await examiner.save();
                if (formInstance.addHistoryEntry) {
                    await formInstance.addHistoryEntry(`DORDC approved examiner ${examiner.name}`, user.name);
                }
            }
        }

        // Process rejections
        for (const email of rejections) {
            const examiner = await ExaminersRecommendation.findOne({
                where: { form_id: formInstance.id, email }
            });
            if (examiner && examiner.recommendation !== 'rejected') {
                examiner.recommendation = 'rejected';
                await examiner.save();
                if (formInstance.addHistoryEntry) {
                    await formInstance.addHistoryEntry(`DORDC rejected examiner ${examiner.name}`, user.name);
                }
            }
        }

        // Check pending
        const pendingCount = await ExaminersRecommendation.count({
            where: { form_id: formInstance.id, recommendation: 'pending' }
        });
        if (pendingCount > 0) {
            throw new Error('All examiners must be either approved or rejected before the form can be submitted');
        }

        // Check minimum counts
        if (approval) {
            const nationalCount = await ExaminersRecommendation.count({
                where: { form_id: formInstance.id, recommendation: 'approved', type: 'national' }
            });
            const internationalCount = await ExaminersRecommendation.count({
                where: { form_id: formInstance.id, recommendation: 'approved', type: 'international' }
            });

            if (nationalCount < 4 || internationalCount < 4) {
                // Move back to supervisor
                const stepsArray = JSON.parse(formInstance.steps || '[]');
                const index = stepsArray.indexOf('faculty');

                formInstance.stage = 'supervisor';
                formInstance.supervisor_approval = false;
                formInstance.supervisor_comments = null;
                formInstance.status = 'pending';
                formInstance.current_step = index;
                formInstance.supervisor_lock = false;
                await formInstance.save();

                throw new Error('Form moved to Supervisor to add more examiners. At least 4 approved examiners are required in both National and International categories.');
            }
        }
    });
};

const directorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ListOfExaminersForm, 'director', 'dordc', 'complete', async (formInstance) => {
        // Move examiners to final list
        formInstance.completion = 'complete';
        formInstance.status = 'approved';
        await formInstance.save();
    });
};

/**
 * Process examiners submission
 */
const processExaminers = async (examiners, type, formInstance, user, requiredCount = 4) => {
    if (!examiners || examiners.length === 0) {
        throw new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} examiners are required`);
    }

    // Check for duplicates
    const emails = examiners.map(e => e.email);
    if (emails.length !== new Set(emails).size) {
        throw new Error(`Duplicate examiners found in the ${type} list`);
    }

    let count = 0;
    for (const examiner of examiners) {
        const exists = await ExaminersRecommendation.findOne({
            where: { form_id: formInstance.id, email: examiner.email, type }
        });

        if (!exists) {
            await ExaminersRecommendation.create({
                form_id: formInstance.id,
                name: examiner.name,
                email: examiner.email,
                institution: examiner.institution,
                designation: examiner.designation,
                department: examiner.department,
                phone: examiner.phone,
                faculty_id: user.faculty?.faculty_code,
                type: type
            });

            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry(`Supervisor added examiner to ${type} list`, user.name);
            }
            count++;
        } else if (exists.recommendation !== 'rejected') {
            count++;
        }
    }

    if (count < requiredCount) {
        throw new Error(`Exactly ${requiredCount} ${type} examiners are required`);
    }
};

export default {
    listFilters,
    listForm,
    createForm,
    loadForm,
    submit,
    bulkSubmit
};
