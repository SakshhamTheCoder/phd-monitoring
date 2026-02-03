import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class SupervisorChangeForm extends Model {

    // --- Trait Logic: ModelCommonFormFields (Abbreviated/Inlined) ---
    getCommonFields() {
        return {
            student_id: this.student_id,
            status: this.status,
            stage: this.stage,
            completion: this.completion,
            steps: this.steps,
            current_step: this.current_step,
            maximum_step: this.maximum_step,
            student_lock: this.student_lock,
            hod_lock: this.hod_lock,
            supervisor_lock: this.supervisor_lock,
            dordc_lock: this.dordc_lock,
            adordc_lock: this.adordc_lock,
            dra_lock: this.dra_lock,
            external_lock: this.external_lock,
            director_lock: this.director_lock,
            phd_coordinator_lock: this.phd_coordinator_lock,
            doctoral_lock: this.doctoral_lock,
            student_comments: this.student_comments,
            hod_comments: this.hod_comments,
            supervisor_comments: this.supervisor_comments,
            dordc_comments: this.dordc_comments,
            adordc_comments: this.adordc_comments,
            external_comments: this.external_comments,
            dra_comments: this.dra_comments,
            director_comments: this.director_comments,
            doctoral_comments: this.doctoral_comments,
            phd_coordinator_comments: this.phd_coordinator_comments,
            supervisor_approval: this.supervisor_approval,
            phd_coordinator_approval: this.phd_coordinator_approval,
            hod_approval: this.hod_approval,
            dordc_approval: this.dordc_approval,
            adordc_approval: this.adordc_approval,
            external_approval: this.external_approval,
            doctoral_approval: this.doctoral_approval,
            dra_approval: this.dra_approval,
            director_approval: this.director_approval,
            history: this.history,
        };
    }

    async addHistoryEntry(action, user, comments = null, status = null) {
        const entry = { action, user, status, comment: comments, timestamp: new Date() };
        let history = this.history || [];
        if (!Array.isArray(history)) history = [];
        history.push(entry);
        this.history = history;
        return await this.save();
    }

    async fullCommonForm(user, extraData = []) {
        // ... (Standard trait implementation)
        const student = await this.getStudent();
        if (!student) throw new Error("Student not found");
        const studentUser = await student.getUser();
        const department = await student.getDepartment();
        const supervisors = await student.getSupervisors();
        const currentUserRole = user.current_role ? user.current_role.role : null;

        const commonJSON = {
            form_id: this.id,
            name: studentUser ? studentUser.name : null,
            roll_no: student.roll_no,
            email: studentUser ? studentUser.email : null,
            phone: studentUser ? studentUser.phone : null,
            department: department ? department.name : null,
            date_of_registration: student.date_of_registration,
            phd_title: student.phd_title,
            gender: studentUser ? studentUser.gender : null,
            cgpa: student.cgpa,
            role: currentUserRole,
            semester: this.semester,
            supervisors: supervisors ? await Promise.all(supervisors.map(async (sup) => {
                const supUser = await sup.getUser();
                const supDept = await sup.getDepartment();
                return {
                    name: supUser ? supUser.name : null,
                    designation: sup.designation,
                    department: supDept ? supDept.name : null
                };
            })) : [],
            status: this.status,
            stage: this.stage,
            comments: {
                student: this.student_comments,
                hod: this.hod_comments,
                supervisor: this.supervisor_comments,
                phd_coordinator: this.phd_coordinator_comments,
                dordc: this.dordc_comments,
                adordc: this.adordc_comments,
                dra: this.dra_comments,
                doctoral: this.doctoral_comments,
                external: this.external_comments,
                director: this.director_comments,
            },
            locks: {
                student: this.student_lock,
                hod: this.hod_lock,
                supervisor: this.supervisor_lock,
                phd_coordinator: this.phd_coordinator_lock,
                dordc: this.dordc_lock,
                adordc: this.adordc_lock,
                dra: this.dra_lock,
                doctoral: this.doctoral_lock,
                external: this.external_lock,
                director: this.director_lock,
            },
            approvals: {
                supervisor: this.supervisor_approval,
                phd_coordinator: this.phd_coordinator_approval,
                hod: this.hod_approval,
                dordc: this.dordc_approval,
                adordc: this.adordc_approval,
                dra: this.dra_approval,
                doctoral: this.doctoral_approval,
                external: this.external_approval,
                director: this.director_approval,
            },
            steps: this.steps,
            current_step: this.current_step,
            maximum_step: this.maximum_step,
            history: this.history,
            role: currentUserRole,
            created_at: this.created_at,
            updated_at: this.updated_at,
            department_id: department ? department.id : null,
            ...extraData
        };
        if (currentUserRole !== 'student') commonJSON.department_id = department ? department.id : null;
        return commonJSON;
    }
    // --- End Trait Logic ---

    async fullForm(user) {
        const commonJSON = await this.fullCommonForm(user);

        const { Faculty, Supervisor } = sequelize.models;

        const mapFaculty = async (codes) => {
            if (!codes || !Array.isArray(codes)) return [];
            return await Promise.all(codes.map(async (code) => {
                const faculty = await Faculty.findOne({
                    where: { faculty_code: code },
                    include: ['user', 'department']
                });
                if (!faculty) return null;
                return {
                    name: faculty.user ? faculty.user.name : null,
                    designation: faculty.designation,
                    department: faculty.department ? faculty.department.name : null,
                };
            }));
        };

        const toChangeData = await mapFaculty(this.to_change);
        const preferencesData = await mapFaculty(this.prefrences);
        const currentSupervisorsData = await mapFaculty(this.current_supervisors);
        const newSupervisorsData = await mapFaculty(this.new_supervisors);

        // date_of_allocation from Supervisor model
        const supervisorEntry = await Supervisor.findOne({ where: { student_id: this.student.roll_no } });
        const dateOfAllocation = supervisorEntry ? supervisorEntry.updated_at : null;

        const formData = Object.assign(commonJSON, {
            reason: this.reason,
            to_change: toChangeData.filter(d => d),
            prefrences: preferencesData.filter(d => d),
            current_supervisors: currentSupervisorsData.filter(d => d),
            new_supervisors: newSupervisorsData.filter(d => d),
            irb_submitted: this.irb_submitted,
            date_of_allocation: dateOfAllocation
        });

        // Add 'supervisors' (current supervisors of student again? logic seems redundant in PHP output but adhering to it)
        // PHP: $formData['supervisors'] = $this->student->supervisors->map(...)
        // overwrite 'supervisors' in commonJSON which was just names/depts?
        // PHP adds faculty_code too.
        const supervisors = await this.student.getSupervisors({ include: ['user', 'department'] });
        formData.supervisors = supervisors.map(sup => ({
            name: sup.user ? sup.user.name : null,
            designation: sup.designation,
            department: sup.department ? sup.department.name : null,
            faculty_code: sup.faculty_code
        }));

        return formData;
    }

    static associate(models) {
        SupervisorChangeForm.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
    }
}

SupervisorChangeForm.init({
    // Common fields
    student_id: DataTypes.STRING,
    status: DataTypes.STRING,
    stage: DataTypes.STRING,
    completion: DataTypes.STRING,
    steps: DataTypes.JSON,
    current_step: DataTypes.INTEGER,
    maximum_step: DataTypes.INTEGER,

    // Locks
    student_lock: DataTypes.BOOLEAN,
    hod_lock: DataTypes.BOOLEAN,
    supervisor_lock: DataTypes.BOOLEAN,
    dordc_lock: DataTypes.BOOLEAN,
    adordc_lock: DataTypes.BOOLEAN,
    dra_lock: DataTypes.BOOLEAN,
    external_lock: DataTypes.BOOLEAN,
    director_lock: DataTypes.BOOLEAN,
    phd_coordinator_lock: DataTypes.BOOLEAN,
    doctoral_lock: DataTypes.BOOLEAN,

    // Comments
    student_comments: DataTypes.TEXT,
    hod_comments: DataTypes.TEXT,
    supervisor_comments: DataTypes.TEXT,
    dordc_comments: DataTypes.TEXT,
    adordc_comments: DataTypes.TEXT,
    external_comments: DataTypes.TEXT,
    dra_comments: DataTypes.TEXT,
    director_comments: DataTypes.TEXT,
    doctoral_comments: DataTypes.TEXT,
    phd_coordinator_comments: DataTypes.TEXT,

    // Approvals
    supervisor_approval: DataTypes.STRING,
    phd_coordinator_approval: DataTypes.STRING,
    hod_approval: DataTypes.STRING,
    dordc_approval: DataTypes.STRING,
    adordc_approval: DataTypes.STRING,
    external_approval: DataTypes.STRING,
    doctoral_approval: DataTypes.STRING,
    dra_approval: DataTypes.STRING,
    director_approval: DataTypes.STRING,

    history: DataTypes.JSON,

    // Specific fields
    reason: DataTypes.TEXT,
    to_change: DataTypes.JSON,
    prefrences: DataTypes.JSON,
    current_supervisors: DataTypes.JSON,
    new_supervisors: DataTypes.JSON,
    irb_submitted: DataTypes.BOOLEAN, // or string? PHP doesn't specify check, likely boolean or string
}, {
    sequelize,
    modelName: 'SupervisorChangeForm',
    tableName: 'supervisor_change_forms',
    underscored: true,
});

export default SupervisorChangeForm;
