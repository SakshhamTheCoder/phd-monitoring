/**
 * SupervisorAllocationController
 * Ported from PHP: app/Http/Controllers/SupervisorAllocationController.php
 * 
 * Handles supervisor allocation form workflow
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
    SupervisorAllocation,
    Faculty,
    User,
    Supervisor,
    Forms,
    BroadAreaSpecialization,
    StudentBroadAreaSpecialization
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
 * List supervisor allocation forms
 */
export const listForm = async (req, res) => {
    try {
        const user = req.user;
        const { student_id } = req.params;

        if (student_id) {
            const result = await listFormsStudent(user, SupervisorAllocation, student_id);
            return res.status(result.status || 200).json(result.data || result);
        }

        const result = await listForms(user, SupervisorAllocation, req, null, false, {
            fields: ['name', 'roll_no', 'progress', 'email', 'semester'],
            extra_fields: {
                progress: (form) => form.student?.overall_progress,
                email: (form) => form.student?.user?.email,
                semester: (form) => form.id
            },
            titles: ['Name', 'Roll No', 'Progress', 'Email', 'Semester']
        });
        return res.status(result.status || 200).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Create new supervisor allocation form
 */
export const createForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        const steps = ['student', 'phd_coordinator', 'hod', 'complete'];

        if (role?.role !== 'student') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const data = {
            roll_no: user.student?.roll_no,
            steps: steps,
            role: role.role,
            name: `${user.first_name} ${user.last_name}`
        };

        const result = await createForms(SupervisorAllocation, data);
        return res.status(result.status || 201).json(result.data || result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Load supervisor allocation form
 */
export const loadForm = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;
        const { form_id } = req.params;
        const Model = SupervisorAllocation;
        const steps = ['student', 'phd_coordinator', 'hod'];

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
 * Submit supervisor allocation form - role dispatcher
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

        if (role?.role !== 'hod') {
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
 * Allocate supervisors for many students at once from an uploaded sheet.
 *
 * Each row is funnelled through the ordinary coordinator submission so the
 * existing validation, authorization, locking, history and stage handling
 * all still apply - the forms land on the HOD exactly as they would have if
 * the coordinator had filled them in one at a time.
 */
export const bulkAllocate = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role;

        if (role?.role !== 'phd_coordinator') {
            return res.status(403).json({ message: 'You are not authorized to access this resource' });
        }

        const { batch_data } = req.body;
        if (!batch_data || !Array.isArray(batch_data)) {
            return res.status(422).json({ message: 'batch_data array is required' });
        }

        for (const row of batch_data) {
            if (row?.row_number === undefined || row === null || !Number.isInteger(row.row_number)) {
                return res.status(422).json({ message: 'batch_data.row_number is required and must be an integer' });
            }
            if (row.roll_no === undefined || row.roll_no === null || row.roll_no === '') {
                return res.status(422).json({ message: 'batch_data.roll_no is required' });
            }
            if (!Array.isArray(row.supervisors) || row.supervisors.length < 1) {
                return res.status(422).json({ message: 'batch_data.supervisors is required and must have at least 1 entry' });
            }
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const row of batch_data) {
            const rowNumber = row.row_number;

            try {
                const identifiers = row.supervisors
                    .map((code) => String(code).trim())
                    .filter((code) => code !== '');

                if (identifiers.length === 0) {
                    throw new Error('No supervisors provided');
                }

                // A coordinator filling in a sheet is far more likely to know a
                // supervisor's email than their numeric faculty code, so accept
                // either and normalise to the faculty code the form expects.
                const supervisors = [];
                for (const identifier of identifiers) {
                    if (!identifier.includes('@')) {
                        supervisors.push(identifier);
                        continue;
                    }
                    const faculty = await Faculty.findOne({
                        include: [{ model: User, as: 'user', where: { email: identifier }, required: true }]
                    });
                    if (!faculty) {
                        throw new Error(`No faculty found with email ${identifier}`);
                    }
                    supervisors.push(faculty.faculty_code);
                }

                const formInstance = await SupervisorAllocation.findOne({
                    where: { student_id: row.roll_no, completion: 'incomplete' }
                });

                if (!formInstance) {
                    throw new Error(`No open supervisor allocation form found for roll number ${row.roll_no}`);
                }

                if (formInstance.stage !== 'phd_coordinator') {
                    throw new Error(`Form for roll number ${row.roll_no} is awaiting the '${formInstance.stage}' stage, not the PhD coordinator`);
                }

                const rowReq = { ...req, body: { supervisors, approval: true } };
                const result = await coordinatorSubmit(user, rowReq, formInstance.id);

                if ((result?.status || 200) >= 400) {
                    throw new Error(result?.data?.message || result?.message || 'Allocation failed');
                }

                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(`Row ${rowNumber}: ${error.message}`);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Allocation completed: ${successCount} allocated, ${errorCount} errors`,
            data: {
                success_count: successCount,
                error_count: errorCount,
                errors: errors
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Private submission handlers ---

const studentSubmit = async (user, req, form_id) => {
    const { prefrences, broad_area_of_research } = req.body;

    // Validation
    if (!prefrences || !Array.isArray(prefrences)) {
        return { status: 422, data: { message: 'prefrences are required' } };
    }
    if (!broad_area_of_research || !Array.isArray(broad_area_of_research)) {
        return { status: 422, data: { message: 'broad_area_of_research is required' } };
    }

    return await submitForm(user, req, form_id, SupervisorAllocation, 'student', 'student', 'phd_coordinator', async (formInstance) => {
        // Validate preferences
        if (prefrences.length !== 6 || new Set(prefrences).size !== 6) {
            throw new Error('Please select 6 unique preferences');
        }

        for (const pref of prefrences) {
            const faculty = await Faculty.findByPk(pref);
            if (!faculty) throw new Error('Invalid preference selected');
        }

        formInstance.prefrences = prefrences;

        // Handle broad area specialization
        await StudentBroadAreaSpecialization.destroy({
            where: { student_id: formInstance.student_id }
        });

        for (const area of broad_area_of_research) {
            if (isNaN(area)) {
                // Create new specialization
                const newArea = await BroadAreaSpecialization.create({
                    broad_area: area,
                    department_id: formInstance.student.department_id
                });
                await StudentBroadAreaSpecialization.create({
                    specialization_id: newArea.id,
                    student_id: formInstance.student_id
                });
            } else {
                const existing = await BroadAreaSpecialization.findByPk(area);
                if (!existing) throw new Error('Invalid broad area selected');
                await StudentBroadAreaSpecialization.create({
                    specialization_id: area,
                    student_id: formInstance.student_id
                });
            }
        }

        await formInstance.save();
    });
};

const coordinatorSubmit = async (user, req, form_id) => {
    const { supervisors } = req.body;

    return await submitForm(user, req, form_id, SupervisorAllocation, 'phd_coordinator', 'student', 'hod', async (formInstance) => {
        if (!supervisors || !Array.isArray(supervisors)) {
            throw new Error('supervisors are required');
        }

        if (supervisors.length !== new Set(supervisors).size) {
            throw new Error('Please select unique supervisors');
        }

        for (const supId of supervisors) {
            const faculty = await Faculty.findByPk(supId);
            if (!faculty) throw new Error('Invalid supervisor selected');
        }

        formInstance.supervisors = supervisors;
        await formInstance.save();
    });
};

const hodSubmit = async (user, req, form_id) => {
    const { approval } = req.body;

    return await submitForm(user, req, form_id, SupervisorAllocation, 'hod', 'phd_coordinator', 'complete', async (formInstance) => {
        if (approval) {
            formInstance.status = 'approved';

            // Create supervisor records
            const supervisors = formInstance.supervisors || [];
            for (const supId of supervisors) {
                await Supervisor.create({
                    student_id: formInstance.student_id,
                    faculty_id: supId
                });
            }

            // Create follow-up forms
            const followUpForms = [
                { form_type: 'supervisor-change', form_name: 'Supervisor Change', max_count: 10, stage: 'student' },
                { form_type: 'irb-constitution', form_name: 'IRB Constitution', max_count: 1, stage: 'student' },
                { form_type: 'status-change', form_name: 'Change of Status', max_count: 2, stage: 'student' },
                { form_type: 'list-of-examiners', form_name: 'List of Examiners', max_count: 1, stage: 'supervisor', student_available: false, supervisor_available: true },
                { form_type: 'semester-off', form_name: 'Semester Off', max_count: 10, stage: 'student' }
            ];

            for (const formDef of followUpForms) {
                const existingForm = await Forms.findOne({
                    where: { student_id: formInstance.student.roll_no, form_type: formDef.form_type }
                });

                if (!existingForm) {
                    await Forms.create({
                        student_id: formInstance.student.roll_no,
                        form_type: formDef.form_type,
                        form_name: formDef.form_name,
                        max_count: formDef.max_count,
                        stage: formDef.stage,
                        student_available: formDef.student_available !== false,
                        supervisor_available: formDef.supervisor_available === true
                    });
                }
            }

            if (formInstance.addHistoryEntry) {
                await formInstance.addHistoryEntry('Supervisors allocated by HOD', user.name);
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
    bulkAllocate
};
