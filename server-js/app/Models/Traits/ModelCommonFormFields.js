/**
 * ModelCommonFormFields
 * Ported from PHP: app/Models/Traits/ModelCommonFormFields.php
 * 
 * Common form fields and methods used by all form models
 * This is implemented as a mixin that can be applied to Sequelize models
 */

/**
 * Get common fields from a form instance
 */
export const getCommonFields = (instance) => {
    return {
        student_id: instance.student_id,
        status: instance.status,
        stage: instance.stage,
        completion: instance.completion,
        steps: instance.steps,
        current_step: instance.current_step,
        maximum_step: instance.maximum_step,
        student_lock: instance.student_lock,
        hod_lock: instance.hod_lock,
        supervisor_lock: instance.supervisor_lock,
        dordc_lock: instance.dordc_lock,
        adordc_lock: instance.adordc_lock,
        dra_lock: instance.dra_lock,
        external_lock: instance.external_lock,
        director_lock: instance.director_lock,
        phd_coordinator_lock: instance.phd_coordinator_lock,
        doctoral_lock: instance.doctoral_lock,
        student_comments: instance.student_comments,
        hod_comments: instance.hod_comments,
        supervisor_comments: instance.supervisor_comments,
        dordc_comments: instance.dordc_comments,
        adordc_comments: instance.adordc_comments,
        external_comments: instance.external_comments,
        dra_comments: instance.dra_comments,
        director_comments: instance.director_comments,
        doctoral_comments: instance.doctoral_comments,
        phd_coordinator_comments: instance.phd_coordinator_comments,
        supervisor_approval: instance.supervisor_approval,
        phd_coordinator_approval: instance.phd_coordinator_approval,
        hod_approval: instance.hod_approval,
        dordc_approval: instance.dordc_approval,
        adordc_approval: instance.adordc_approval,
        external_approval: instance.external_approval,
        doctoral_approval: instance.doctoral_approval,
        dra_approval: instance.dra_approval,
        director_approval: instance.director_approval,
        history: instance.history
    };
};

/**
 * Add a history entry to the form
 */
export const addHistoryEntry = async (instance, action, user, comments = null, status = null) => {
    const entry = {
        action,
        user,
        status,
        comment: comments,
        timestamp: new Date().toISOString()
    };

    let history = instance.history;
    if (!history || !Array.isArray(history)) {
        history = [];
    }
    history.push(entry);
    instance.history = history;
    await instance.save();
};

/**
 * Get full common form data for API response
 */
export const fullCommonForm = async (instance, user, extraData = {}) => {
    // Load student with relations if not already loaded
    let student = instance.student;
    if (!student && instance.getStudent) {
        student = await instance.getStudent({
            include: ['user', 'department', 'supervisors']
        });
    }

    const supervisors = student?.supervisors || [];
    const supervisorData = await Promise.all(
        supervisors.map(async (supervisor) => {
            const supUser = supervisor.user || (supervisor.getUser ? await supervisor.getUser() : null);
            const supDept = supervisor.department || (supervisor.getDepartment ? await supervisor.getDepartment() : null);
            return {
                name: supUser?.name || `${supUser?.first_name || ''} ${supUser?.last_name || ''}`.trim(),
                designation: supervisor.designation,
                department: supDept?.name
            };
        })
    );

    const arr = {
        form_id: instance.id,
        name: student?.user?.name || `${student?.user?.first_name || ''} ${student?.user?.last_name || ''}`.trim(),
        roll_no: student?.roll_no,
        email: student?.user?.email,
        phone: student?.user?.phone,
        department: student?.department?.name,
        date_of_registration: student?.date_of_registration,
        phd_title: student?.phd_title,
        gender: student?.user?.gender,
        cgpa: student?.cgpa,
        role: user?.current_role?.role,
        semester: instance.semester,
        supervisors: supervisorData,
        status: instance.status,
        stage: instance.stage,
        comments: {
            student: instance.student_comments,
            hod: instance.hod_comments,
            supervisor: instance.supervisor_comments,
            phd_coordinator: instance.phd_coordinator_comments,
            dordc: instance.dordc_comments,
            adordc: instance.adordc_comments,
            dra: instance.dra_comments,
            doctoral: instance.doctoral_comments,
            external: instance.external_comments,
            director: instance.director_comments
        },
        locks: {
            student: instance.student_lock,
            hod: instance.hod_lock,
            supervisor: instance.supervisor_lock,
            phd_coordinator: instance.phd_coordinator_lock,
            dordc: instance.dordc_lock,
            adordc: instance.adordc_lock,
            dra: instance.dra_lock,
            doctoral: instance.doctoral_lock,
            external: instance.external_lock,
            director: instance.director_lock
        },
        approvals: {
            supervisor: instance.supervisor_approval,
            phd_coordinator: instance.phd_coordinator_approval,
            hod: instance.hod_approval,
            dordc: instance.dordc_approval,
            adordc: instance.adordc_approval,
            dra: instance.dra_approval,
            doctoral: instance.doctoral_approval,
            external: instance.external_approval,
            director: instance.director_approval
        },
        steps: instance.steps,
        current_step: instance.current_step,
        maximum_step: instance.maximum_step,
        history: instance.history,
        created_at: instance.createdAt,
        updated_at: instance.updatedAt,
        ...extraData
    };

    // Add department_id for non-student roles
    if (user?.current_role?.role !== 'student') {
        arr.department_id = student?.department?.id;
    }

    return arr;
};

/**
 * Apply common form methods to a Sequelize model instance
 * Call this in the model's hooks or use it as a mixin
 */
export const applyCommonFormMethods = (Model) => {
    // Add instance methods
    Model.prototype.getCommonFields = function() {
        return getCommonFields(this);
    };

    Model.prototype.addHistoryEntry = async function(action, user, comments = null, status = null) {
        return addHistoryEntry(this, action, user, comments, status);
    };

    Model.prototype.fullCommonForm = async function(user, extraData = {}) {
        return fullCommonForm(this, user, extraData);
    };
};

/**
 * Common form field definitions for Sequelize models
 * Use this when defining form models
 */
export const commonFormFieldDefinitions = {
    student_id: {
        type: 'INTEGER',
        allowNull: false,
        references: { model: 'students', key: 'roll_no' }
    },
    completion: {
        type: 'ENUM',
        values: ['incomplete', 'complete'],
        defaultValue: 'incomplete'
    },
    status: {
        type: 'ENUM',
        values: ['draft', 'pending', 'approved', 'rejected'],
        defaultValue: 'pending'
    },
    stage: {
        type: 'ENUM',
        values: ['student', 'hod', 'phd_coordinator', 'supervisor', 'doctoral', 'external', 'adordc', 'dordc', 'dra', 'director', 'complete'],
        defaultValue: 'student'
    },
    history: { type: 'JSON', allowNull: true },
    steps: { type: 'JSON', allowNull: true },
    current_step: { type: 'INTEGER', defaultValue: 0 },
    maximum_step: { type: 'INTEGER', defaultValue: 0 },
    
    // Approval fields
    supervisor_approval: { type: 'BOOLEAN', defaultValue: false },
    phd_coordinator_approval: { type: 'BOOLEAN', defaultValue: false },
    hod_approval: { type: 'BOOLEAN', defaultValue: false },
    dordc_approval: { type: 'BOOLEAN', defaultValue: false },
    adordc_approval: { type: 'BOOLEAN', defaultValue: false },
    dra_approval: { type: 'BOOLEAN', defaultValue: false },
    director_approval: { type: 'BOOLEAN', defaultValue: false },
    external_approval: { type: 'BOOLEAN', defaultValue: false },
    doctoral_approval: { type: 'BOOLEAN', defaultValue: false },
    
    // Lock fields
    student_lock: { type: 'BOOLEAN', defaultValue: false },
    phd_coordinator_lock: { type: 'BOOLEAN', defaultValue: true },
    hod_lock: { type: 'BOOLEAN', defaultValue: true },
    supervisor_lock: { type: 'BOOLEAN', defaultValue: true },
    dordc_lock: { type: 'BOOLEAN', defaultValue: true },
    adordc_lock: { type: 'BOOLEAN', defaultValue: true },
    dra_lock: { type: 'BOOLEAN', defaultValue: true },
    director_lock: { type: 'BOOLEAN', defaultValue: true },
    doctoral_lock: { type: 'BOOLEAN', defaultValue: true },
    external_lock: { type: 'BOOLEAN', defaultValue: true },
    
    // Comment fields
    student_comments: { type: 'TEXT', allowNull: true },
    phd_coordinator_comments: { type: 'TEXT', allowNull: true },
    hod_comments: { type: 'TEXT', allowNull: true },
    supervisor_comments: { type: 'TEXT', allowNull: true },
    dordc_comments: { type: 'TEXT', allowNull: true },
    adordc_comments: { type: 'TEXT', allowNull: true },
    dra_comments: { type: 'TEXT', allowNull: true },
    director_comments: { type: 'TEXT', allowNull: true },
    external_comments: { type: 'TEXT', allowNull: true },
    doctoral_comments: { type: 'TEXT', allowNull: true }
};

export default {
    getCommonFields,
    addHistoryEntry,
    fullCommonForm,
    applyCommonFormMethods,
    commonFormFieldDefinitions
};
