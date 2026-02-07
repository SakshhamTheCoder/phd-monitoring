/**
 * ThesisExtentionController
 * Ported from PHP: app/Http/Controllers/ThesisExtentionController.php
 * 
 * Handles thesis extension form workflow
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
import { ThesisExtentionForm } from '../../Models/index.js';

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
 * List thesis extension forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, ThesisExtentionForm, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, ThesisExtentionForm, req, null, false, {
            fields: ['name', 'roll_no', 'date_of_synopsis', 'supervisors'],
            extra_fields: {
                supervisors: (form) => {
                    if (!form.student?.supervisors) return '';
                    return form.student.supervisors.map(s => s.user?.name).join(', ');
                },
                date_of_synopsis: (form) => {
                    if (!form.student?.date_of_synopsis) return null;
                    return new Date(form.student.date_of_synopsis).toISOString().split('T')[0];
                }
            },
            titles: ['Name', 'Roll No', 'Date of Synopsis', 'Supervisors']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new thesis extension form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(ThesisExtentionForm, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load thesis extension form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = ThesisExtentionForm;
        const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc'];

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
 * Submit thesis extension form - role dispatcher
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

const studentSubmit = async (user, req, form_id) => {
    const { reason, date_of_synopsis } = req.body;

    return await submitForm(user, req, form_id, ThesisExtentionForm, 'student', 'student', 'faculty', async (formInstance) => {
        // Check if synopsis date needs to be set
        if (!formInstance.student?.date_of_synopsis) {
            if (!date_of_synopsis) {
                throw new Error('date_of_synopsis is required');
            }
            formInstance.student.date_of_synopsis = date_of_synopsis;
            await formInstance.student.save();
        }

        // Check if this is a repeat extension
        const thesisExtensions = await formInstance.student?.getThesisExtentions?.() || [];
        if (thesisExtensions.length > 0) {
            if (req.file) {
                const link = await saveUploadedFile(req.file, 'thesis_extention', user.student.roll_no);
                formInstance.previous_extention_pdf = link;
            } else {
                throw new Error('previous_extention_pdf is required for repeat extensions');
            }
        }

        formInstance.reason = reason;
        await formInstance.save();
    });
};

const supervisorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisExtentionForm, 'faculty', 'student', 'phd_coordinator');
};

const coordinatorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisExtentionForm, 'phd_coordinator', 'faculty', 'hod');
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisExtentionForm, 'hod', 'phd_coordinator', 'dra');
};

const draSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisExtentionForm, 'dra', 'hod', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, ThesisExtentionForm, 'dordc', 'dra', 'complete', async (formInstance) => {
        if (approval) {
            formInstance.completion = 'complete';
            formInstance.status = 'approved';
            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Thesis Extension approved by DORDC', user.name);
            }
        }
        await formInstance.save();
    });
};

const directorSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, ThesisExtentionForm, 'director', 'dordc', 'complete', async (formInstance) => {
        if (approval) {
            formInstance.completion = 'complete';
            formInstance.status = 'approved';
            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Thesis Extension approved by Director', user.name);
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
