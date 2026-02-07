/**
 * SupervisorDoctoralChangeController
 * Ported from PHP: app/Http/Controllers/SupervisorDoctoralChangeController.php
 * 
 * Handles supervisor and doctoral committee changes
 */

import {
    SupervisorDoctoralChange,
    Supervisor,
    DoctoralCommittee,
    Faculty,
    OutsideExpert,
    Student,
    User
} from '../../Models/index.js';
import { Op } from 'sequelize';
import sequelize from '../../../database/connection.js';

/**
 * List all pending changes (for DORDC approval)
 */
export const listPendingChanges = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;

        if (!['dordc', 'admin'].includes(role)) {
            return res.status(403).json({
                message: 'You do not have permission to view pending changes'
            });
        }

        const changes = await SupervisorDoctoralChange.findAll({
            where: { status: 'pending' },
            include: [
                { model: Student, as: 'student', include: ['user', 'department'] },
                { model: User, as: 'requester' },
                { model: Faculty, as: 'oldFaculty', include: ['user'] },
                { model: Faculty, as: 'newFaculty', include: ['user'] },
                { model: OutsideExpert, as: 'outsideExpert' }
            ],
            order: [['created_at', 'DESC']]
        });

        const result = changes.map(change => {
            let oldMember = null;
            let newMember = null;

            if (change.old_faculty_code && change.oldFaculty) {
                oldMember = {
                    name: change.oldFaculty.user?.name || `${change.oldFaculty.user?.first_name} ${change.oldFaculty.user?.last_name}`,
                    email: change.oldFaculty.user?.email,
                    type: change.oldFaculty.type
                };
            }

            if (change.faculty_type === 'external' && change.outside_expert_id) {
                const expert = change.outsideExpert;
                newMember = {
                    name: `${expert?.first_name} ${expert?.last_name}`,
                    email: expert?.email,
                    type: 'external',
                    institution: expert?.institution
                };
            } else if (change.new_faculty_code && change.newFaculty) {
                newMember = {
                    name: change.newFaculty.user?.name || `${change.newFaculty.user?.first_name} ${change.newFaculty.user?.last_name}`,
                    email: change.newFaculty.user?.email,
                    type: change.newFaculty.type
                };
            }

            return {
                id: change.id,
                student_name: change.student?.user?.name || `${change.student?.user?.first_name} ${change.student?.user?.last_name}`,
                student_roll_no: change.student?.roll_no,
                department: change.student?.department?.name,
                change_type: change.change_type,
                member_type: change.member_type,
                faculty_type: change.faculty_type,
                old_member: oldMember,
                new_member: newMember,
                reason: change.reason,
                requested_by: change.requester?.name || `${change.requester?.first_name} ${change.requester?.last_name}`,
                requested_at: change.created_at
            };
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Propose a change (by HOD/PhD Coordinator)
 */
export const proposeChange = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;

        if (!['hod', 'phd_coordinator', 'admin', 'doctoral', 'dordc'].includes(role)) {
            return res.status(403).json({
                message: 'You do not have permission to propose changes'
            });
        }

        const {
            student_id,
            change_type,
            member_type,
            faculty_type,
            old_faculty_code,
            new_faculty_code,
            outside_expert_id,
            reason
        } = req.body;

        // Validation
        if (!student_id || !change_type || !member_type || !faculty_type) {
            return res.status(422).json({
                message: 'student_id, change_type, member_type, and faculty_type are required'
            });
        }

        if (!['add', 'remove', 'replace'].includes(change_type)) {
            return res.status(422).json({ message: 'Invalid change_type' });
        }

        if (!['supervisor', 'doctoral'].includes(member_type)) {
            return res.status(422).json({ message: 'Invalid member_type' });
        }

        if (!['internal', 'external'].includes(faculty_type)) {
            return res.status(422).json({ message: 'Invalid faculty_type' });
        }

        // Check if student exists
        const student = await Student.findOne({ where: { roll_no: student_id } });
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check department permission for HOD/PhD Coordinator
        if (['hod', 'phd_coordinator'].includes(role)) {
            if (student.department_id !== user.faculty?.department_id) {
                return res.status(403).json({
                    message: 'You can only manage students from your department'
                });
            }
        }

        // Validate based on change_type
        if (change_type === 'remove' && !old_faculty_code) {
            return res.status(422).json({
                message: 'old_faculty_code is required for remove operation'
            });
        }

        if (change_type === 'add') {
            if (faculty_type === 'external' && !outside_expert_id) {
                return res.status(422).json({
                    message: 'outside_expert_id is required for external faculty'
                });
            }
            if (faculty_type === 'internal' && !new_faculty_code) {
                return res.status(422).json({
                    message: 'new_faculty_code is required for internal faculty'
                });
            }
        }

        if (change_type === 'replace') {
            if (!old_faculty_code) {
                return res.status(422).json({
                    message: 'old_faculty_code is required for replace operation'
                });
            }
            if (faculty_type === 'external' && !outside_expert_id) {
                return res.status(422).json({
                    message: 'outside_expert_id is required for external faculty'
                });
            }
            if (faculty_type === 'internal' && !new_faculty_code) {
                return res.status(422).json({
                    message: 'new_faculty_code is required for internal faculty'
                });
            }
        }

        // Admin, doctoral, and dordc can apply changes directly
        if (['admin', 'doctoral', 'dordc'].includes(role)) {
            const transaction = await sequelize.transaction();
            try {
                const change = await SupervisorDoctoralChange.create({
                    student_id,
                    change_type,
                    member_type,
                    faculty_type,
                    old_faculty_code,
                    new_faculty_code,
                    outside_expert_id,
                    reason,
                    requested_by: user.id,
                    status: 'approved',
                    approved_by: user.id,
                    approved_at: new Date()
                }, { transaction });

                // Apply the change immediately
                if (member_type === 'supervisor') {
                    await applySupervisorChange(change, transaction);
                } else {
                    await applyDoctoralChange(change, transaction);
                }

                await transaction.commit();

                return res.status(201).json({
                    success: true,
                    message: `Change applied successfully (${role} direct change)`,
                    data: change
                });
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        }

        // For HOD/PhD Coordinator, create pending change request
        const change = await SupervisorDoctoralChange.create({
            student_id,
            change_type,
            member_type,
            faculty_type,
            old_faculty_code,
            new_faculty_code,
            outside_expert_id,
            reason,
            requested_by: user.id,
            status: 'pending'
        });

        return res.status(201).json({
            success: true,
            message: 'Change request submitted successfully. Awaiting DORDC approval.',
            data: change
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Approve a change (by DORDC)
 */
export const approveChange = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;
        const { changeId } = req.params;

        if (!['dordc', 'admin'].includes(role)) {
            return res.status(403).json({
                message: 'You do not have permission to approve changes'
            });
        }

        const change = await SupervisorDoctoralChange.findByPk(changeId);
        if (!change) {
            return res.status(404).json({ message: 'Change request not found' });
        }

        if (change.status !== 'pending') {
            return res.status(422).json({
                message: 'This change request has already been processed'
            });
        }

        const transaction = await sequelize.transaction();
        try {
            // Apply the change based on type
            if (change.member_type === 'supervisor') {
                await applySupervisorChange(change, transaction);
            } else {
                await applyDoctoralChange(change, transaction);
            }

            // Update change status
            change.status = 'approved';
            change.approved_by = user.id;
            change.approved_at = new Date();
            await change.save({ transaction });

            await transaction.commit();

            return res.status(200).json({
                success: true,
                message: 'Change approved and applied successfully'
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Reject a change (by DORDC)
 */
export const rejectChange = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;
        const { changeId } = req.params;
        const { rejection_reason } = req.body;

        if (!['dordc', 'admin'].includes(role)) {
            return res.status(403).json({
                message: 'You do not have permission to reject changes'
            });
        }

        if (!rejection_reason) {
            return res.status(422).json({ message: 'rejection_reason is required' });
        }

        const change = await SupervisorDoctoralChange.findByPk(changeId);
        if (!change) {
            return res.status(404).json({ message: 'Change request not found' });
        }

        if (change.status !== 'pending') {
            return res.status(422).json({
                message: 'This change request has already been processed'
            });
        }

        change.status = 'rejected';
        change.approved_by = user.id;
        change.approved_at = new Date();
        change.rejection_reason = rejection_reason;
        await change.save();

        return res.status(200).json({
            success: true,
            message: 'Change rejected successfully'
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

/**
 * Get pending changes for a specific student
 */
export const getStudentPendingChanges = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;
        const { studentId } = req.params;

        const student = await Student.findOne({ where: { roll_no: studentId } });
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check permissions
        if (['hod', 'phd_coordinator'].includes(role)) {
            if (student.department_id !== user.faculty?.department_id) {
                return res.status(403).json({
                    message: 'You can only view students from your department'
                });
            }
        } else if (!['dordc', 'admin'].includes(role)) {
            return res.status(403).json({
                message: 'You do not have permission to view changes'
            });
        }

        const changes = await SupervisorDoctoralChange.findAll({
            where: {
                student_id: studentId,
                status: 'pending'
            },
            include: [
                { model: Faculty, as: 'oldFaculty', include: ['user'] },
                { model: Faculty, as: 'newFaculty', include: ['user'] },
                { model: OutsideExpert, as: 'outsideExpert' },
                { model: User, as: 'requester' }
            ],
            order: [['created_at', 'DESC']]
        });

        const result = changes.map(change => {
            let oldMember = null;
            let newMember = null;

            if (change.old_faculty_code && change.oldFaculty) {
                oldMember = {
                    name: change.oldFaculty.user?.name || `${change.oldFaculty.user?.first_name} ${change.oldFaculty.user?.last_name}`,
                    email: change.oldFaculty.user?.email
                };
            }

            if (change.faculty_type === 'external' && change.outside_expert_id) {
                const expert = change.outsideExpert;
                newMember = {
                    name: `${expert?.first_name} ${expert?.last_name}`,
                    email: expert?.email,
                    institution: expert?.institution
                };
            } else if (change.new_faculty_code && change.newFaculty) {
                newMember = {
                    name: change.newFaculty.user?.name || `${change.newFaculty.user?.first_name} ${change.newFaculty.user?.last_name}`,
                    email: change.newFaculty.user?.email
                };
            }

            return {
                id: change.id,
                change_type: change.change_type,
                member_type: change.member_type,
                faculty_type: change.faculty_type,
                old_member: oldMember,
                new_member: newMember,
                reason: change.reason,
                requested_by: change.requester?.name || `${change.requester?.first_name} ${change.requester?.last_name}`,
                requested_at: change.created_at
            };
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Legacy form-based endpoints for compatibility ---

export const listFilters = async (req, res) => {
    try {
        return res.status(200).json([]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const listForm = async (req, res) => {
    // Redirect to listPendingChanges
    return listPendingChanges(req, res);
};

export const createForm = async (req, res) => {
    // Redirect to proposeChange
    return proposeChange(req, res);
};

export const loadForm = async (req, res) => {
    try {
        const { form_id } = req.params;
        const change = await SupervisorDoctoralChange.findByPk(form_id, {
            include: [
                { model: Student, as: 'student', include: ['user', 'department'] },
                { model: Faculty, as: 'oldFaculty', include: ['user'] },
                { model: Faculty, as: 'newFaculty', include: ['user'] },
                { model: OutsideExpert, as: 'outsideExpert' }
            ]
        });

        if (!change) {
            return res.status(404).json({ message: 'Form not found' });
        }

        return res.status(200).json({ form: change });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const submit = async (req, res) => {
    // Redirect based on approval flag
    const { approval } = req.body;
    if (approval === true) {
        req.params.changeId = req.params.form_id;
        return approveChange(req, res);
    } else if (approval === false) {
        req.params.changeId = req.params.form_id;
        return rejectChange(req, res);
    }

    return res.status(422).json({ message: 'approval (true/false) is required' });
};

export const bulkSubmit = async (req, res) => {
    try {
        const user = req.user;
        const role = user.current_role?.role;
        const { form_ids } = req.body;

        if (!['hod', 'phd_coordinator', 'dra', 'dordc', 'director'].includes(role)) {
            return res.status(403).json({ message: 'You are not authorized' });
        }

        if (!form_ids || !Array.isArray(form_ids)) {
            return res.status(422).json({ message: 'form_ids array is required' });
        }

        for (const formId of form_ids) {
            req.params.changeId = formId;
            req.body.approval = true;
            await approveChange(req, { status: () => ({ json: () => {} }) });
        }

        return res.status(200).json({ message: 'Forms submitted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- Helper Functions ---

/**
 * Apply supervisor change
 */
const applySupervisorChange = async (change, transaction) => {
    if (change.change_type === 'add') {
        const facultyCode = await getFacultyCode(change);
        await Supervisor.create({
            student_id: change.student_id,
            faculty_id: facultyCode,
            type: change.faculty_type
        }, { transaction });
    } else if (change.change_type === 'remove') {
        await Supervisor.destroy({
            where: {
                student_id: change.student_id,
                faculty_id: change.old_faculty_code
            },
            transaction
        });
    } else if (change.change_type === 'replace') {
        const supervisor = await Supervisor.findOne({
            where: {
                student_id: change.student_id,
                faculty_id: change.old_faculty_code
            }
        });

        if (supervisor) {
            const facultyCode = await getFacultyCode(change);
            supervisor.faculty_id = facultyCode;
            supervisor.type = change.faculty_type;
            await supervisor.save({ transaction });
        }
    }
};

/**
 * Apply doctoral committee change
 */
const applyDoctoralChange = async (change, transaction) => {
    if (change.change_type === 'add') {
        const facultyCode = await getFacultyCode(change);
        await DoctoralCommittee.create({
            student_id: change.student_id,
            faculty_id: facultyCode,
            type: change.faculty_type
        }, { transaction });
    } else if (change.change_type === 'remove') {
        await DoctoralCommittee.destroy({
            where: {
                student_id: change.student_id,
                faculty_id: change.old_faculty_code
            },
            transaction
        });
    } else if (change.change_type === 'replace') {
        const doctoral = await DoctoralCommittee.findOne({
            where: {
                student_id: change.student_id,
                faculty_id: change.old_faculty_code
            }
        });

        if (doctoral) {
            const facultyCode = await getFacultyCode(change);
            doctoral.faculty_id = facultyCode;
            doctoral.type = change.faculty_type;
            await doctoral.save({ transaction });
        }
    }
};

/**
 * Get faculty code (create faculty from outside expert if needed)
 */
const getFacultyCode = async (change) => {
    if (change.faculty_type === 'external' && change.outside_expert_id) {
        const expert = await OutsideExpert.findByPk(change.outside_expert_id);
        if (expert && expert.getFaculty) {
            const faculty = await expert.getFaculty();
            return faculty?.faculty_code;
        }
    }

    return change.new_faculty_code;
};

export default {
    listPendingChanges,
    proposeChange,
    approveChange,
    rejectChange,
    getStudentPendingChanges,
    listFilters,
    listForm,
    createForm,
    loadForm,
    submit,
    bulkSubmit
};
