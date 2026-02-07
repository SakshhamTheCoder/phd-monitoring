/**
 * ThesisSubmissionController
 * Ported from PHP: app/Http/Controllers/ThesisSubmissionController.php
 * 
 * Handles thesis submission form workflow
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleAdordcForm,
    handleFacultyForm,
    handleCoordinatorForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent, getAvailableFilters } from './Traits/GeneralFormList.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import { saveUploadedFile } from './Traits/SaveFile.js';
import {
    ThesisSubmission,
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
 * List thesis submission forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, ThesisSubmission, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, ThesisSubmission, req, null, false, {
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
 * Create new thesis submission form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(ThesisSubmission, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load thesis submission form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = ThesisSubmission;
        const steps = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'complete'];

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
 * Submit thesis form - role dispatcher
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
            case 'adordc':
                result = await adordcSubmit(user, req, form_id);
                break;
            case 'dordc':
                result = await dordcSubmit(user, req, form_id);
                break;
            case 'phd_coordinator':
                result = await coordinatorSubmit(user, req, form_id);
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
 * Link publications to thesis
 */
export const linkPublication = async (req, res) => {
    try {
        const user = req.user;
        if (user.current_role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_id } = req.params;
        const { publications = [], patents = [] } = req.body;

        const formInstance = await ThesisSubmission.findByPk(form_id);
        if (!formInstance) {
            return res.status(404).json({ message: 'Form not found' });
        }

        for (const pubId of publications) {
            const publication = await Publication.findByPk(pubId);
            if (!publication || publication.student_id !== user.student?.roll_no) {
                return res.status(400).json({ message: 'Invalid publication selected' });
            }

            const existing = await Publication.findOne({
                where: { title: publication.title, form_id: formInstance.id, form_type: 'thesis' }
            });
            if (existing) {
                return res.status(400).json({ message: 'Publication already linked' });
            }

            await Publication.create({
                ...publication.toJSON(),
                id: undefined,
                form_id: formInstance.id,
                form_type: 'thesis'
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
                form_type: 'thesis'
            });
        }

        return res.status(200).json({ message: 'Publications linked to Thesis' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

/**
 * Unlink publications from thesis
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
                where: { id: pubId, form_id: form_id, form_type: 'thesis' }
            });
        }

        for (const patId of patents) {
            await Patent.destroy({
                where: { id: patId, form_id: form_id, form_type: 'thesis' }
            });
        }

        return res.status(200).json({ message: 'Publications unlinked from Thesis' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Private submission handlers ---

const studentSubmit = async (user, req, form_id) => {
    const { date_of_synopsis, reciept_no, date_of_fee_submission } = req.body;

    // Validation
    if (!date_of_synopsis) {
        return { status: 422, data: { message: 'date_of_synopsis is required' } };
    }
    if (!reciept_no) {
        return { status: 422, data: { message: 'reciept_no is required' } };
    }
    if (!date_of_fee_submission) {
        return { status: 422, data: { message: 'date_of_fee_submission is required' } };
    }

    return await submitForm(user, req, form_id, ThesisSubmission, 'student', 'student', 'faculty', async (formInstance) => {
        formInstance.date_of_synopsis = date_of_synopsis;
        formInstance.reciept_no = reciept_no;
        formInstance.date_of_fee_submission = date_of_fee_submission;

        if (req.files?.thesis_pdf) {
            const thesisPdfLink = await saveUploadedFile(req.files.thesis_pdf[0], 'thesis', user.student.roll_no);
            formInstance.thesis_pdf = thesisPdfLink;
        }

        if (req.files?.fee_receipt) {
            const feeReceiptLink = await saveUploadedFile(req.files.fee_receipt[0], 'fee_receipt', user.student.roll_no);
            formInstance.fee_receipt = feeReceiptLink;
        }

        await formInstance.save();
    });
};

const supervisorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisSubmission, 'faculty', 'student', 'phd_coordinator');
};

const coordinatorSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisSubmission, 'phd_coordinator', 'faculty', 'hod');
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisSubmission, 'hod', 'phd_coordinator', 'dra');
};

const draSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisSubmission, 'dra', 'hod', 'adordc');
};

const adordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ThesisSubmission, 'adordc', 'dra', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, ThesisSubmission, 'dordc', 'dra', 'complete', async (formInstance) => {
        if (approval) {
            formInstance.completion = 'complete';
            formInstance.status = 'approved';

            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Thesis approved by DORDC', user.name);
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
