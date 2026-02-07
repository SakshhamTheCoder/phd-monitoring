/**
 * SupervisorChangeFormController
 * Ported from PHP: app/Http/Controllers/SupervisorChangeFormController.php
 * 
 * Handles supervisor change form workflow
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleCoordinatorForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent, getAvailableFilters } from './Traits/GeneralFormList.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import {
    SupervisorChangeForm,
    Faculty,
    Supervisor
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
 * List supervisor change forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, SupervisorChangeForm, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, SupervisorChangeForm, req, null, false, {
            fields: ['name', 'roll_no', 'to_change', 'reason'],
            extra_fields: {
                to_change: (form) => {
                    if (!form.student?.supervisors) return '';
                    return form.student.supervisors.map(s => s.user?.name).join(', ');
                }
            },
            titles: ['Name', 'Roll No', 'To Change', 'Reason']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new supervisor change form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        let steps = ['student', 'phd_coordinator', 'hod', 'dordc', 'dra', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(SupervisorChangeForm, data, async (formInstance) => {
            const supervisors = await formInstance.student?.getSupervisors?.() || [];
            formInstance.current_supervisors = supervisors.map(s => s.faculty_code);
            formInstance.irb_submitted = formInstance.student?.irbSubForm?.completion === 'complete';

            if (!formInstance.irb_submitted) {
                formInstance.steps = JSON.stringify(['student', 'phd_coordinator', 'hod', 'complete']);
            }
        });

        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load supervisor change form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = SupervisorChangeForm;
        const steps = ['student', 'phd_coordinator', 'hod', 'dordc', 'dra'];

        let result;
        switch (role?.role) {
            case 'student':
                result = await handleStudentForm(user, form_id, Model, steps, async (formInstance) => {
                    const supervisors = await formInstance.student?.getSupervisors?.() || [];
                    formInstance.current_supervisors = supervisors.map(s => s.faculty_code);
                    formInstance.irb_submitted = formInstance.student?.irbSubForm?.completion === 'complete';
                });
                break;
            case 'hod':
                result = await handleHodForm(user, form_id, Model);
                break;
            case 'phd_coordinator':
                result = await handleCoordinatorForm(user, form_id, Model);
                break;
            case 'dordc':
            case 'dra':
                result = await handleAdminForm(user, form_id, Model);
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
 * Submit supervisor change form - role dispatcher
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
            case 'hod':
                result = await hodSubmit(user, req, form_id);
                break;
            case 'phd_coordinator':
                result = await coordinatorSubmit(user, req, form_id);
                break;
            case 'dordc':
                result = await dordcSubmit(user, req, form_id);
                break;
            case 'dra':
                result = await draSubmit(user, req, form_id);
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
    const { prefrences, to_change, reason } = req.body;

    // Validation
    if (!prefrences || !Array.isArray(prefrences)) {
        return { status: 422, data: { message: 'prefrences are required' } };
    }
    if (!to_change || !Array.isArray(to_change)) {
        return { status: 422, data: { message: 'to_change is required' } };
    }
    if (!reason) {
        return { status: 422, data: { message: 'reason is required' } };
    }

    return await submitForm(user, req, form_id, SupervisorChangeForm, 'student', 'student', 'phd_coordinator', async (formInstance) => {
        // Validate preferences
        if (prefrences.length !== 3 || new Set(prefrences).size !== 3) {
            throw new Error('Please select 3 unique preferences');
        }

        for (const pref of prefrences) {
            const faculty = await Faculty.findByPk(pref);
            if (!faculty) throw new Error('Invalid preference selected');
        }

        // Validate to_change supervisors
        for (const supId of to_change) {
            const faculty = await Faculty.findByPk(supId);
            if (!faculty) throw new Error('Invalid supervisor selection');

            const supervises = await formInstance.student?.checkSupervises?.(supId);
            if (!supervises) throw new Error('The faculty does not supervise the student');
        }

        formInstance.prefrences = prefrences;
        formInstance.reason = reason;
        formInstance.to_change = to_change;
        await formInstance.save();
    });
};

const coordinatorSubmit = async (user, req, form_id) => {
    const { new_supervisors } = req.body;

    return await submitForm(user, req, form_id, SupervisorChangeForm, 'phd_coordinator', 'student', 'hod', async (formInstance) => {
        if (!new_supervisors || !Array.isArray(new_supervisors)) {
            throw new Error('new_supervisors are required');
        }

        const to_change = formInstance.to_change || [];
        if (new_supervisors.length !== to_change.length) {
            throw new Error('Number of supervisors to change and new supervisors should be same');
        }

        for (const supId of new_supervisors) {
            const faculty = await Faculty.findByPk(supId);
            if (!faculty) throw new Error('Invalid supervisor selected');

            const supervises = await formInstance.student?.checkSupervises?.(supId);
            if (supervises) throw new Error('The faculty already supervises the student');
        }

        formInstance.new_supervisors = new_supervisors;
        await formInstance.save();
    });
};

const hodSubmit = async (user, req, form_id) => {
    const form = await SupervisorChangeForm.findByPk(form_id);

    if (!form.irb_submitted) {
        return await submitForm(user, req, form_id, SupervisorChangeForm, 'hod', 'phd_coordinator', 'complete', async (formInstance) => {
            const { approval } = req.body;
            if (approval) {
                await changeSupervisors(formInstance);
                formInstance.completion = 'complete';
                if (formInstance.addHistoryEntry) {
                    await formInstance.addHistoryEntry('Supervisors change request approved by HOD', user.name);
                }
                await formInstance.save();
            }
        });
    }

    return await submitForm(user, req, form_id, SupervisorChangeForm, 'hod', 'phd_coordinator', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, SupervisorChangeForm, 'dordc', 'hod', 'dra');
};

const draSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, SupervisorChangeForm, 'dra', 'dordc', 'complete', async (formInstance) => {
        if (approval) {
            await changeSupervisors(formInstance);
            formInstance.completion = 'complete';
            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Supervisors change request approved by DRA', user.name);
            }
            await formInstance.save();
        }
    });
};

/**
 * Helper to change supervisors
 */
const changeSupervisors = async (formInstance) => {
    const to_change = formInstance.to_change || [];
    const new_supervisors = formInstance.new_supervisors || [];

    for (let i = 0; i < to_change.length; i++) {
        const supervisor = await Supervisor.findOne({
            where: { student_id: formInstance.student.roll_no, faculty_id: to_change[i] }
        });

        if (!supervisor) throw new Error('The faculty does not supervise the student');
        supervisor.faculty_id = new_supervisors[i];
        await supervisor.save();
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
