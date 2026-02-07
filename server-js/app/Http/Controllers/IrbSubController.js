/**
 * IrbSubController
 * Ported from PHP: app/Http/Controllers/IrbSubController.php
 * 
 * Handles IRB submission form workflow
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleAdordcForm,
    handleFacultyForm,
    handleDoctoralForm
} from './Traits/GeneralFormHandler.js';
import { submitForm } from './Traits/GeneralFormSubmitter.js';
import { listForms, listFormsStudent, getAvailableFilters } from './Traits/GeneralFormList.js';
import { createForms } from './Traits/GeneralFormCreate.js';
import { saveUploadedFile } from './Traits/SaveFile.js';
import {
    IrbSubForm,
    IrbSubSupervisorApproval,
    IrbSubDoctoralApproval,
    Faculty,
    Forms,
    PHDObjective,
    Approval
} from '../../Models/index.js';
import EmailService from '../../Services/EmailService.js';
import crypto from 'crypto';

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
 * List IRB submission forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, IrbSubForm, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, IrbSubForm, req, null, false, {
            fields: ['name', 'roll_no', 'date_of_irb', 'supervisors'],
            extra_fields: {
                supervisors: (form) => {
                    if (!form.student?.supervisors) return '';
                    return form.student.supervisors.map(s => s.user?.name).join(', ');
                },
                date_of_irb: (form) => {
                    if (!form.student?.date_of_irb) return null;
                    return new Date(form.student.date_of_irb).toISOString().split('T')[0];
                }
            },
            titles: ['Name', 'Roll No', 'Date of IRB', 'Supervisors']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new IRB submission form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = ['student', 'faculty', 'external', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(IrbSubForm, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load IRB submission form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = IrbSubForm;
        const steps = ['student', 'faculty', 'external', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];

        let result;
        switch (role?.role) {
            case 'student':
                result = await handleStudentForm(user, form_id, Model, steps);
                break;
            case 'hod':
                result = await handleHodForm(user, form_id, Model);
                break;
            case 'doctoral':
                result = await handleDoctoralForm(user, form_id, Model);
                break;
            case 'dordc':
                result = await handleAdminForm(user, form_id, Model);
                break;
            case 'adordc':
                result = await handleAdordcForm(user, form_id, Model);
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
 * Submit IRB form - role dispatcher
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
            case 'doctoral':
                result = await doctoralSubmit(user, req, form_id);
                break;
            case 'hod':
                result = await hodSubmit(user, req, form_id);
                break;
            case 'adordc':
                result = await adordcSubmit(user, req, form_id);
                break;
            case 'dordc':
                result = await dordcSubmit(user, req, form_id);
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
        const { form_ids } = req.body;
        const allowedRoles = ['hod', 'dordc', 'adordc'];

        if (!allowedRoles.includes(role?.role)) {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        if (!form_ids || !Array.isArray(form_ids)) {
            return res.status(422).json({ message: 'form_ids array is required' });
        }

        req.body.approval = true;

        for (const id of form_ids) {
            const form = await IrbSubForm.findByPk(id);
            if (!form) {
                return res.status(404).json({ message: 'Form not found' });
            }

            if (role.role === 'hod') {
                await hodSubmit(user, req, id);
            } else if (role.role === 'dordc') {
                await dordcSubmit(user, req, id);
            } else if (role.role === 'adordc') {
                await adordcSubmit(user, req, id);
            }
        }

        return res.status(200).json({ message: 'Forms submitted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Private submission handlers ---

const studentSubmit = async (user, req, form_id) => {
    const { revised_phd_objectives, revised_phd_title, date_of_irb } = req.body;

    // Validation
    if (!revised_phd_objectives || !Array.isArray(revised_phd_objectives)) {
        return { status: 422, data: { message: 'revised_phd_objectives are required' } };
    }
    if (!revised_phd_title) {
        return { status: 422, data: { message: 'revised_phd_title is required' } };
    }
    if (!date_of_irb) {
        return { status: 422, data: { message: 'date_of_irb is required' } };
    }

    return await submitForm(user, req, form_id, IrbSubForm, 'student', 'student', 'faculty', async (formInstance) => {
        // Save PDF
        if (req.file) {
            const link = await saveUploadedFile(req.file, 'irb_sub_rev', user.student.roll_no);
            formInstance.revised_irb_pdf = link;
        }

        formInstance.revised_phd_title = revised_phd_title;
        formInstance.date_of_irb = date_of_irb;
        formInstance.student.date_of_irb = date_of_irb;
        await formInstance.student.save();

        // Save revised objectives
        await PHDObjective.destroy({
            where: { student_id: formInstance.student.roll_no, type: 'revised' }
        });

        for (const objective of revised_phd_objectives) {
            await PHDObjective.create({
                student_id: formInstance.student.roll_no,
                objective: objective,
                type: 'revised'
            });
        }

        await formInstance.save();

        // Clear and recreate supervisor approvals
        await IrbSubSupervisorApproval.destroy({
            where: { irb_sub_form_id: formInstance.id }
        });

        const supervisors = await formInstance.student.getSupervisors();
        for (const supervisor of supervisors) {
            await IrbSubSupervisorApproval.create({
                irb_sub_form_id: formInstance.id,
                supervisor_id: supervisor.faculty_code,
                status: 'awaited'
            });
        }
    });
};

const supervisorSubmit = async (user, req, form_id) => {
    const { approval, supervised_outside, comments } = req.body;

    return await submitForm(user, req, form_id, IrbSubForm, 'faculty', 'student', 'external', async (formInstance) => {
        await handleSupervisorSubmitForm(user, req, formInstance, approval, supervised_outside);
    });
};

const handleSupervisorSubmitForm = async (user, req, formInstance, approval, supervised_outside) => {
    const faculty_code = user.faculty.faculty_code;

    if (approval) {
        // Check if already approved
        const existingApproval = await IrbSubSupervisorApproval.findOne({
            where: { irb_sub_form_id: formInstance.id, supervisor_id: faculty_code }
        });

        if (existingApproval?.status === 'approved') {
            throw new Error('You have already approved the form');
        }

        if (!supervised_outside && supervised_outside !== 0) {
            throw new Error('supervised_outside is required');
        }

        // Update faculty supervised counts
        const faculty = user.faculty;
        faculty.supervised_outside = supervised_outside;
        // Count supervised on campus
        const supervisedCampus = await Faculty.count({
            where: { faculty_code },
            include: [{
                association: 'supervisedStudents',
                required: true,
                include: [{
                    association: 'irbSubForm',
                    where: { status: 'approved', completion: 'complete' }
                }]
            }]
        });
        faculty.supervised_campus = supervisedCampus;
        await faculty.save();

        await IrbSubSupervisorApproval.update(
            { status: 'approved' },
            { where: { irb_sub_form_id: formInstance.id, supervisor_id: faculty_code } }
        );

        if (formInstance.addHistoryEntry) {
            await formInstance.addHistoryEntry('Supervisor Approved The Form', user.name);
        }

        // Check if all supervisors approved
        const approvedCount = await IrbSubSupervisorApproval.count({
            where: { irb_sub_form_id: formInstance.id, status: 'approved' }
        });
        const supervisorCount = await formInstance.student.countSupervisors();

        if (approvedCount !== supervisorCount) {
            const error = new Error('Your preferences saved. Form will be submitted once all supervisors approve');
            error.code = 201;
            throw error;
        }

        // Send email to outside expert
        const outsideExpert = await formInstance.student.getOutsideExpert?.();
        if (outsideExpert) {
            const approvalKey = crypto.randomBytes(32).toString('hex');
            await Approval.create({
                key: approvalKey,
                email: outsideExpert.email,
                action: 'review',
                model_type: 'IrbSubForm',
                model_id: formInstance.id
            });

            // Send approval email
            try {
                await EmailService.sendMail({
                    to: outsideExpert.email,
                    subject: 'IRB Submission Approval Request',
                    template: 'approval',
                    data: {
                        name: `${outsideExpert.first_name} ${outsideExpert.last_name}`,
                        approverName: user.name,
                        formId: formInstance.id,
                        approvalKey
                    }
                });
            } catch (e) {
                console.error('Email send failed:', e.message);
            }
        }
    } else {
        await IrbSubSupervisorApproval.update(
            { status: 'rejected' },
            { where: { irb_sub_form_id: formInstance.id, supervisor_id: faculty_code } }
        );
    }
};

const doctoralSubmit = async (user, req, form_id) => {
    const { approval, comments } = req.body;

    return await submitForm(user, req, form_id, IrbSubForm, 'doctoral', 'faculty', 'hod', async (formInstance) => {
        await handleDoctoralSubmitForm(user, formInstance, approval);
    });
};

const handleDoctoralSubmitForm = async (user, formInstance, approval) => {
    const faculty_code = user.faculty.faculty_code;

    if (approval) {
        const existingApproval = await IrbSubDoctoralApproval.findOne({
            where: { irb_sub_form_id: formInstance.id, doctoral_id: faculty_code }
        });

        if (existingApproval?.status === 'approved') {
            throw new Error('You have already approved the form');
        }

        await IrbSubDoctoralApproval.update(
            { status: 'approved' },
            { where: { irb_sub_form_id: formInstance.id, doctoral_id: faculty_code } }
        );

        if (formInstance.addHistoryEntry) {
            await formInstance.addHistoryEntry('Doctoral Member Approved The Form', user.name);
        }

        // Check if all doctoral committee approved
        const approvedCount = await IrbSubDoctoralApproval.count({
            where: { irb_sub_form_id: formInstance.id, status: 'approved' }
        });
        const doctoralCount = await formInstance.student.countDoctoralCommittee();

        if (approvedCount !== doctoralCount) {
            const error = new Error('Your preferences saved. Form will be submitted once all IRB Committee members approve');
            error.code = 201;
            throw error;
        }
    } else {
        await IrbSubDoctoralApproval.update(
            { status: 'rejected' },
            { where: { irb_sub_form_id: formInstance.id, doctoral_id: faculty_code } }
        );
    }
};

const hodSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, IrbSubForm, 'hod', 'faculty', 'adordc');
};

const adordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, IrbSubForm, 'adordc', 'hod', 'dordc');
};

const dordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, IrbSubForm, 'dordc', 'phd_coordinator', 'complete', async (formInstance) => {
        const student = formInstance.student;
        student.phd_title = formInstance.revised_phd_title;
        await student.save();

        formInstance.completion = 'complete';
        formInstance.status = 'approved';
        await formInstance.save();

        // Create follow-up forms
        const followUpForms = [
            { form_type: 'synopsis-submission', form_name: 'Synopsis Submission', max_count: 1, stage: 'student' },
            { form_type: 'thesis-extension', form_name: 'Thesis Extension', max_count: 10, stage: 'student' },
            { form_type: 'thesis-submission', form_name: 'Thesis Submission', max_count: 1, stage: 'student' }
        ];

        for (const formDef of followUpForms) {
            const existingForm = await Forms.findOne({
                where: { student_id: student.roll_no, form_type: formDef.form_type }
            });

            if (!existingForm) {
                await Forms.create({
                    student_id: student.roll_no,
                    form_type: formDef.form_type,
                    form_name: formDef.form_name,
                    max_count: formDef.max_count,
                    stage: formDef.stage,
                    student_available: true
                });
            }
        }
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
