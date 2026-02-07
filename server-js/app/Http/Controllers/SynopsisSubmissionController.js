/**
 * SynopsisSubmissionController
 * Ported from PHP: app/Http/Controllers/SynopsisSubmissionController.php
 * 
 * Handles synopsis submission form workflow
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleAdordcForm,
    handleFacultyForm,
    handleDoctoralForm,
    handleCoordinatorForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent, getAvailableFilters } from './Traits/GeneralFormList.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import { saveUploadedFile } from './Traits/SaveFile.js';
import {
    SynopsisSubmission,
    Publication,
    Patent
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
 * List synopsis submission forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, SynopsisSubmission, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, SynopsisSubmission, req, null, false, {
            fields: ['name', 'roll_no', 'revised_title', 'synopsis_pdf'],
            extra_fields: {
                synopsis_pdf: (form) => form.synopsis_pdf
            },
            titles: ['Name', 'Roll No', 'Revised Title', 'Synopsis PDF']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new synopsis submission form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'director', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(SynopsisSubmission, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load synopsis submission form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const { form_id } = req.params;
        const Model = SynopsisSubmission;
        const steps = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'director', 'complete'];

        const form = await SynopsisSubmission.findByPk(form_id, {
            include: [{ association: 'student' }]
        });

        let role = user.current_role?.role;
        if (form && user.faculty?.faculty_code) {
            const isDoctoral = await form.student?.checkDoctoralCommittee?.(user.faculty.faculty_code);
            if (isDoctoral) role = 'doctoral';
        }

        let result;
        switch (role) {
            case 'student':
                result = await handleStudentForm(user, form_id, Model, steps);
                break;
            case 'hod':
                result = await handleHodForm(user, form_id, Model);
                break;
            case 'doctoral':
                result = await handleDoctoralForm(user, form_id, Model);
                break;
            case 'phd_coordinator':
                result = await handleCoordinatorForm(user, form_id, Model);
                break;
            case 'adordc':
                result = await handleAdordcForm(user, form_id, Model);
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
 * Submit synopsis form - role dispatcher
 */
export const submit = async (req, res) => {
    try {
        const user = req.user;
        const { form_id } = req.params;

        const form = await SynopsisSubmission.findByPk(form_id, {
            include: [{ association: 'student' }]
        });

        let role = user.current_role?.role;
        if (form && user.faculty?.faculty_code) {
            const isDoctoral = await form.student?.checkDoctoralCommittee?.(user.faculty.faculty_code);
            if (isDoctoral) role = 'doctoral';
        }

        let result;
        switch (role) {
            case 'student':
                result = await studentSubmit(user, req, form_id);
                break;
            case 'faculty':
                result = await supervisorSubmit(user, req, form_id);
                break;
            case 'doctoral':
                result = await doctoralSubmit(user, req, form_id);
                break;
            case 'hod':
                result = await hodSubmit(user, req, form_id);
                break;
            case 'dra':
                result = await draSubmit(user, req, form_id);
                break;
            case 'adordc':
                result = await adordcSubmit(user, req, form_id);
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
        const allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director', 'adordc'];

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

/**
 * Link publications to synopsis
 */
export const linkPublication = async (req, res) => {
    try {
        const user = req.user;
        if (user.current_role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_id } = req.params;
        const { publications = [], patents = [] } = req.body;

        const formInstance = await SynopsisSubmission.findByPk(form_id);
        if (!formInstance) {
            return res.status(404).json({ message: 'Form not found' });
        }

        for (const pubId of publications) {
            const publication = await Publication.findByPk(pubId);
            if (!publication || publication.student_id !== user.student?.roll_no) {
                return res.status(400).json({ message: 'Invalid publication selected' });
            }

            const existing = await Publication.findOne({
                where: { title: publication.title, form_id: formInstance.id, form_type: 'synopsis' }
            });
            if (existing) {
                return res.status(400).json({ message: 'Publication already linked' });
            }

            await Publication.create({
                ...publication.toJSON(),
                id: undefined,
                form_id: formInstance.id,
                form_type: 'synopsis'
            });
        }

        for (const patId of patents) {
            const patent = await Patent.findByPk(patId);
            if (!patent || patent.student_id !== user.student?.roll_no) {
                return res.status(400).json({ message: 'Invalid patent selected' });
            }

            await Patent.create({
                ...patent.toJSON(),
                id: undefined,
                form_id: formInstance.id,
                form_type: 'synopsis'
            });
        }

        return res.status(200).json({ message: 'Publications linked to Synopsis' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

/**
 * Unlink publications from synopsis
 */
export const unlinkPublication = async (req, res) => {
    try {
        const user = req.user;
        if (user.current_role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_id } = req.params;
        const { publications = [], patents = [] } = req.body;

        for (const pubId of publications) {
            await Publication.destroy({
                where: { id: pubId, form_id: form_id, form_type: 'synopsis' }
            });
        }

        for (const patId of patents) {
            await Patent.destroy({
                where: { id: patId, form_id: form_id, form_type: 'synopsis' }
            });
        }

        return res.status(200).json({ message: 'Publications unlinked from Synopsis' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Private submission handlers ---

const studentSubmit = async (user, req, form_id) => {
    const { revised_title } = req.body;

    return await submitForm(user, req, form_id, SynopsisSubmission, 'student', 'student', 'faculty', async (formInstance) => {
        formInstance.revised_title = revised_title;

        if (req.file) {
            const link = await saveUploadedFile(req.file, 'synopsis', user.student.roll_no);
            formInstance.synopsis_pdf = link;
        }

        await formInstance.save();
    });
};

const supervisorSubmit = async (user, req, form_id) => {
    const { current_progress } = req.body;

    return await submitForm(user, req, form_id, SynopsisSubmission, 'faculty', 'student', 'doctoral', async (formInstance) => {
        if (current_progress !== undefined) {
            formInstance.current_progress = parseInt(current_progress);
            const oldProgress = formInstance.student?.overall_progress || 0;
            formInstance.total_progress = oldProgress + parseInt(current_progress);
            await formInstance.save();
        }
    });
};

const doctoralSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SynopsisSubmission, 'doctoral', 'faculty', 'phd_coordinator');
};

const coordinatorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SynopsisSubmission, 'phd_coordinator', 'faculty', 'hod');
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SynopsisSubmission, 'hod', 'phd_coordinator', 'dra');
};

const draSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SynopsisSubmission, 'dra', 'hod', 'adordc');
};

const adordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SynopsisSubmission, 'adordc', 'dra', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SynopsisSubmission, 'dordc', 'dra', 'director');
};

const directorSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, SynopsisSubmission, 'director', 'dordc', 'complete', async (formInstance) => {
        if (approval) {
            formInstance.completion = 'complete';
            formInstance.status = 'approved';
            formInstance.student.phd_title = formInstance.revised_title;
            formInstance.student.overall_progress = formInstance.total_progress;
            await formInstance.student.save();

            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Synopsis approved by Director', user.name);
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
    bulkSubmit,
    linkPublication,
    unlinkPublication
};
