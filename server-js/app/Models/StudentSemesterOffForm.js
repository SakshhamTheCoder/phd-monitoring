import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class StudentSemesterOffForm extends Model {

    // --- Trait Logic: ModelCommonFormFields ---

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
        const entry = {
            action: action,
            user: user, // PHP saves user object or ID? logic suggests full object stored in JSON? 
            // In PHP 'user' => $user implies the whole model if not cast.
            // But usually this goes into a JSON column. Storing whole user object is heavy. 
            // However, porting strictly:
            status: status,
            comment: comments,
            timestamp: new Date(),
        };

        let history = this.history;
        if (!history || !Array.isArray(history)) {
            history = [];
        }

        history.push(entry);

        // Explicitly set for Sequelize to detect change in JSON type
        this.history = history;
        // changed('history', true); // Might be needed
        return await this.save();
    }

    async fullCommonForm(user, extraData = []) {
        // Need access to student, department etc.
        // Assuming 'student' is eager loaded or we await it.
        // The PHP code assumes $this->student is available.
        const student = await this.getStudent();
        if (!student) throw new Error("Student not found for form");

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

        if (currentUserRole !== 'student') {
            commonJSON.department_id = department ? department.id : null;
        }

        return commonJSON;
    }

    // --- End Trait Logic ---

    // Constructor logic for fillable merging is standard sequelize init.

    /**
     * Get the full form data including common fields.
     */
    async fullForm(user) {
        // Must await fullCommonForm because it does DB calls in JS port
        const commonJSON = await this.fullCommonForm(user);

        const previousOffs = await this.student.getSemester_offs(); // Access relation

        return Object.assign(commonJSON, {
            previous_approval_pdf: this.previous_approval_pdf,
            semester_off_required: this.semester_off_required,
            proof_pdf: this.proof_pdf,
            reason: this.reason,
            previous_off: previousOffs // student->semester_offs
        });
    }

    static associate(models) {
        StudentSemesterOffForm.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
    }
}

StudentSemesterOffForm.init({
    // Common fields
    student_id: DataTypes.STRING,
    status: DataTypes.STRING,
    stage: DataTypes.STRING,
    completion: DataTypes.STRING,
    steps: DataTypes.JSON, // array in PHP
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

    history: DataTypes.JSON, // array in PHP

    // Specific fields
    previous_approval_pdf: DataTypes.STRING,
    semester_off_required: DataTypes.BOOLEAN, // or string?
    proof_pdf: DataTypes.STRING,
    reason: DataTypes.TEXT,
    semester_id: DataTypes.INTEGER,
}, {
    sequelize,
    modelName: 'StudentSemesterOffForm',
    tableName: 'student_semester_off_forms',
    underscored: true,
});

export default StudentSemesterOffForm;
