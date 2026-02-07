/**
 * ConstituteOfIRBController
 * Ported from PHP: app/Http/Controllers/ConstituteOfIRBController.php
 * 
 * Handles IRB constitution form workflow
 */

import {
    handleStudentForm,
    handleHodForm,
    handleAdminForm,
    handleAdordcForm,
    handleFacultyForm
} from './Traits/GeneralFormHandler.js';
import {
    submitForm
} from './Traits/GeneralFormSubmitter.js';
import {
    listForms,
    listFormsStudent,
    getAvailableFilters
} from './Traits/GeneralFormList.js';
import {
    createForms
} from './Traits/GeneralFormCreate.js';
import {
    saveUploadedFile
} from './Traits/SaveFile.js';
import {
    ConstituteOfIRB,
    Faculty,
    Forms,
    IrbExpertChairman,
    IrbNomineeCognate,
    IrbOutsideExpert,
    OutsideExpert,
    User,
    Role,
    IRBCommittee,
    DoctoralCommittee,
    PHDObjective,
    ConstituteIrbSupervisorApproval
} from '../../Models/index.js';

/**
 * Get available filters for forms
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
 * List all IRB constitution forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, ConstituteOfIRB, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, ConstituteOfIRB, req, null, false, {
            fields: ['name', 'roll_no', 'email', 'supervisors'],
            extra_fields: {
                email: (form) => form.student?.user?.email,
                semester: (form) => form.id,
                supervisors: (form) => {
                    if (!form.student?.supervisors) return '';
                    return form.student.supervisors.map(s => s.user?.name).join(', ');
                },
                broad_area_of_research: (form) => {
                    return form.student?.areaOfSpecialization?.name || null;
                }
            },
            titles: ['Name', 'Roll No', 'Email', 'Supervisors', 'Broad Area of Research']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new IRB constitution form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = [
            'student',
            'faculty',
            'hod',
            'adordc',
            'dordc',
            'complete'
        ];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(ConstituteOfIRB, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load a specific IRB constitution form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = ConstituteOfIRB;
        const steps = ['student', 'faculty', 'hod', 'adordc', 'dordc'];

        let result;
        switch (role?.role) {
            case 'student':
                result = await handleStudentForm(user, form_id, Model, steps);
                break;
            case 'hod':
                result = await handleHodForm(user, form_id, Model);
                break;
            case 'dra':
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
 * Submit IRB constitution form - dispatcher based on role
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
            case 'adordc':
                result = await adordcSubmit(user, req, form_id);
                break;
            case 'dra':
                result = await draSubmit(user, req, form_id);
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
 * Bulk submit forms (DRA only)
 */
export const bulkSubmit = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        if (role?.role !== 'dra') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { form_ids } = req.body;
        if (!form_ids || !Array.isArray(form_ids)) {
            return res.status(422).json({ message: 'form_ids array is required' });
        }

        // Set approval to true for bulk submit
        req.body.approval = true;

        for (const formId of form_ids) {
            const form = await ConstituteOfIRB.findByPk(formId);
            if (!form) {
                return res.status(404).json({ message: 'Form not found' });
            }
            await draSubmit(user, req, formId);
        }

        return res.status(200).json({ message: 'Forms submitted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Student submission logic
 */
const studentSubmit = async (user, req, form_id) => {
    const { semester, gender, cgpa, objectives, title, address, broad_area_of_research } = req.body;

    // Validation
    if (!objectives || !Array.isArray(objectives)) {
        return { status: 422, data: { message: 'Objectives are required' } };
    }
    if (!title) {
        return { status: 422, data: { message: 'Title is required' } };
    }
    if (!address) {
        return { status: 422, data: { message: 'Address is required' } };
    }

    return await submitForm(user, req, form_id, ConstituteOfIRB, 'student', 'student', 'faculty', async (formInstance) => {
        // Update semester
        if (semester) {
            await formInstance.update({ semester });
        }

        // Update gender if provided
        if (gender) {
            await formInstance.student.user.update({ gender });
        }

        // Update CGPA if provided
        if (cgpa) {
            await formInstance.student.update({ cgpa: parseFloat(cgpa) });
        }

        // Update address
        await formInstance.student.update({ address });

        // Save objectives
        await PHDObjective.destroy({
            where: { student_id: formInstance.student.roll_no, type: 'draft' }
        });

        for (const objective of objectives) {
            await PHDObjective.create({
                student_id: formInstance.student.roll_no,
                objective: objective,
                type: 'draft'
            });
        }

        // Save PDF file if uploaded
        if (req.file) {
            const link = await saveUploadedFile(req.file, 'irb_const', user.student.roll_no);
            formInstance.irb_pdf = link;
        }

        // Save broad area of research
        if (broad_area_of_research) {
            formInstance.broad_area_of_research = broad_area_of_research;
            formInstance.student.area_of_specialization_id = broad_area_of_research;
            await formInstance.student.save();
        }

        formInstance.phd_title = title;
        await formInstance.save();

        // Clear existing supervisor approvals
        await ConstituteIrbSupervisorApproval.destroy({
            where: { irb_cons_form_id: formInstance.id }
        });

        // Create new supervisor approvals
        const supervisors = await formInstance.student.getSupervisors();
        for (const supervisor of supervisors) {
            await ConstituteIrbSupervisorApproval.create({
                irb_cons_form_id: formInstance.id,
                supervisor_id: supervisor.faculty_code,
                status: 'awaited'
            });
        }
    });
};

/**
 * Supervisor submission logic
 */
const supervisorSubmit = async (user, req, form_id) => {
    const { nominee_cognates, approval, comments } = req.body;

    return await submitForm(user, req, form_id, ConstituteOfIRB, 'faculty', 'student', 'hod', async (formInstance) => {
        // Validate nominee cognates
        if (!nominee_cognates || !Array.isArray(nominee_cognates) || nominee_cognates.length !== 3) {
            throw new Error('Exactly 3 nominee cognates are required');
        }

        // Check uniqueness
        const uniqueNominees = [...new Set(nominee_cognates)];
        if (uniqueNominees.length !== 3) {
            throw new Error('Nominee cognates must be unique');
        }

        // Validate each nominee
        for (const nomineeId of nominee_cognates) {
            const faculty = await Faculty.findByPk(nomineeId);
            if (!faculty) {
                throw new Error('Invalid faculty code');
            }
            
            // Check if nominee is not a supervisor
            const isSupervisor = await formInstance.student.checkSupervises?.(nomineeId);
            if (isSupervisor) {
                throw new Error('Supervisor cannot be a nominee cognate');
            }
        }

        // Delete old nominees and create new ones
        await IrbNomineeCognate.destroy({ where: { irb_form_id: formInstance.id } });

        for (const nomineeId of nominee_cognates) {
            await IrbNomineeCognate.create({
                irb_form_id: formInstance.id,
                nominee_id: nomineeId,
                supervisor_id: user.faculty.faculty_code
            });
        }

        // Handle supervisor approval
        const faculty_code = user.faculty.faculty_code;

        if (approval) {
            const existingApproval = await ConstituteIrbSupervisorApproval.findOne({
                where: { irb_cons_form_id: formInstance.id, supervisor_id: faculty_code }
            });

            if (existingApproval?.status === 'approved') {
                throw new Error('You have already approved the form');
            }

            await ConstituteIrbSupervisorApproval.update(
                { status: 'approved' },
                { where: { irb_cons_form_id: formInstance.id, supervisor_id: faculty_code } }
            );

            // Check if all supervisors have approved
            const approvedCount = await ConstituteIrbSupervisorApproval.count({
                where: { irb_cons_form_id: formInstance.id, status: 'approved' }
            });
            const supervisorCount = await formInstance.student.countSupervisors();

            if (approvedCount !== supervisorCount) {
                const error = new Error('Your preferences saved. Form will be submitted once all supervisors approve');
                error.code = 201;
                throw error;
            }
        } else {
            await ConstituteIrbSupervisorApproval.update(
                { status: 'rejected' },
                { where: { irb_cons_form_id: formInstance.id, supervisor_id: faculty_code } }
            );
        }
    });
};

/**
 * HOD submission logic
 */
const hodSubmit = async (user, req, form_id) => {
    const { chairman_experts, outside_experts, approval } = req.body;

    return await submitForm(user, req, form_id, ConstituteOfIRB, 'hod', 'faculty', 'adordc', async (formInstance) => {
        // Validate chairman experts
        if (!chairman_experts || !Array.isArray(chairman_experts)) {
            throw new Error('Chairman experts are required');
        }

        // Delete old chairman experts
        await IrbExpertChairman.destroy({ where: { irb_form_id: formInstance.id } });

        // Create new chairman experts
        for (const expertId of chairman_experts) {
            const faculty = await Faculty.findOne({ where: { faculty_code: expertId } });
            if (!faculty) {
                throw new Error('Invalid faculty code');
            }

            const isSupervisor = await formInstance.student.checkSupervises?.(faculty.faculty_code);
            if (isSupervisor) {
                throw new Error('Supervisor cannot be a cognate expert');
            }

            if (formInstance.student.department_id !== faculty.department_id) {
                throw new Error('Cognate experts must be from the same department');
            }

            await IrbExpertChairman.create({
                irb_form_id: formInstance.id,
                expert_id: expertId
            });
        }

        // Validate outside experts
        if (!outside_experts || !Array.isArray(outside_experts)) {
            throw new Error('Outside experts are required');
        }

        const uniqueOutside = [...new Set(outside_experts)];
        if (uniqueOutside.length !== 3) {
            throw new Error('Outside experts must be unique and exactly 3');
        }

        // Delete old outside experts
        await IrbOutsideExpert.destroy({ where: { irb_form_id: formInstance.id } });

        // Create new outside experts
        for (const expertId of outside_experts) {
            const expert = await OutsideExpert.findByPk(expertId);
            if (!expert) {
                throw new Error('Invalid outside expert');
            }

            await IrbOutsideExpert.create({
                irb_form_id: formInstance.id,
                expert_id: expertId,
                hod_id: user.id
            });
        }
    });
};

/**
 * DRA submission logic
 */
const draSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ConstituteOfIRB, 'dra', 'hod', 'adordc', async () => {
        // DRA submission has no extra logic
    });
};

/**
 * ADORDC submission logic
 */
const adordcSubmit = async (user, req, form_id) => {
    return await submitForm(user, req, form_id, ConstituteOfIRB, 'adordc', 'dra', 'dordc', async () => {
        // ADORDC submission has no extra logic
    });
};

/**
 * DORDC submission logic (final approval)
 */
const dordcSubmit = async (user, req, form_id) => {
    const { outside_expert, cognate_expert } = req.body;

    return await submitForm(user, req, form_id, ConstituteOfIRB, 'dordc', 'hod', 'complete', async (formInstance) => {
        // Validate expert selections
        if (!outside_expert) {
            throw new Error('Outside expert selection is required');
        }
        if (!cognate_expert) {
            throw new Error('Cognate expert selection is required');
        }

        // Verify selections are valid
        const outsideExpertEntry = await IrbOutsideExpert.findOne({
            where: { irb_form_id: formInstance.id, expert_id: outside_expert }
        });
        const cognateExpertEntry = await IrbNomineeCognate.findOne({
            where: { irb_form_id: formInstance.id, nominee_id: cognate_expert }
        });

        if (!outsideExpertEntry || !cognateExpertEntry) {
            throw new Error('Invalid expert selection');
        }

        const outsideExpertRecord = await OutsideExpert.findByPk(outside_expert);

        // Create IRB committee entry for outside expert
        await IRBCommittee.create({
            student_id: formInstance.student.roll_no,
            type: 'outside',
            member_type: 'OutsideExpert',
            member_id: outsideExpertRecord.id
        });

        // Create or update user for outside expert
        let expertUser = await User.findOne({ where: { email: outsideExpertRecord.email } });
        const externalRole = await Role.findOne({ where: { role: 'external' } });

        if (expertUser) {
            expertUser.role_id = externalRole.id;
            await expertUser.save();
        } else {
            expertUser = await User.create({
                email: outsideExpertRecord.email,
                role_id: externalRole.id,
                first_name: outsideExpertRecord.first_name,
                last_name: outsideExpertRecord.last_name,
                password: '$2b$10$placeholder' // Will be reset by user
            });
        }

        // Create doctoral committee entry for cognate expert
        await DoctoralCommittee.create({
            student_id: formInstance.student.roll_no,
            faculty_id: cognate_expert,
            type: 'internal'
        });

        // Create IRB committee entry for cognate expert
        await IRBCommittee.create({
            student_id: formInstance.student.roll_no,
            type: 'inside',
            member_type: 'Faculty',
            member_id: cognate_expert
        });

        // Add chairman experts to doctoral and IRB committees
        const irbChairmanExperts = await IrbExpertChairman.findAll({
            where: { irb_form_id: formInstance.id }
        });

        for (const chairman of irbChairmanExperts) {
            await DoctoralCommittee.create({
                student_id: formInstance.student.roll_no,
                faculty_id: chairman.expert_id,
                type: 'internal'
            });

            await IRBCommittee.create({
                student_id: formInstance.student.roll_no,
                type: 'inside',
                member_type: 'Faculty',
                member_id: chairman.expert_id
            });
        }

        // Add area expert to doctoral committee
        const area = await formInstance.student.getAreaOfSpecialization();
        if (area?.getExpertFaculty) {
            const areaExpert = await area.getExpertFaculty();
            if (areaExpert) {
                await DoctoralCommittee.create({
                    student_id: formInstance.student.roll_no,
                    faculty_id: areaExpert.faculty_code,
                    type: 'external'
                });
            }
        }

        // Update form with final selections
        await formInstance.update({
            outside_expert: outside_expert,
            cognate_expert: cognate_expert,
            completion: 'complete'
        });

        // Update student's PhD title
        const student = formInstance.student;
        student.phd_title = formInstance.phd_title;
        await student.save();

        // Create follow-up forms
        const followUpForms = [
            {
                form_type: 'irb-submission',
                form_name: 'Revised IRB',
                max_count: 1,
                stage: 'student'
            },
            {
                form_type: 'irb-extension',
                form_name: 'IRB Extension',
                max_count: 10,
                stage: 'student'
            }
        ];

        for (const formDef of followUpForms) {
            const existingForm = await Forms.findOne({
                where: { student_id: student.roll_no, form_type: formDef.form_type }
            });

            if (!existingForm) {
                // Note: getFormCreationData would need to be imported from AdminFormController
                // For now, create the form directly
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
