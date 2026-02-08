import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

/**
 * ThesisExtentionForm Model
 * Ported from PHP Laravel's App\Models\ThesisExtentionForm
 * 
 * Form for thesis extension requests with workflow approval
 */
class ThesisExtentionForm extends Model {

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
        const entry = { action, user, status, comment: comments, timestamp: new Date() };
        let history = this.history || [];
        if (!Array.isArray(history)) history = [];
        history.push(entry);
        this.history = history;
        return await this.save();
    }

    async fullCommonForm(user, extraData = {}) {
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
        
        return commonJSON;
    }
    // --- End Trait Logic ---

    /**
     * Get the full form data including common fields
     */
    async fullForm(user) {
        const commonJSON = await this.fullCommonForm(user);
        const student = await this.getStudent();
        
        // Get thesis extensions
        const thesisExtentions = await student.getThesisExtentions ? 
            await student.getThesisExtentions() : [];
        
        return {
            ...commonJSON,
            previous_extention_pdf: this.previous_extention_pdf,
            period_of_extention: this.period_of_extention,
            reason: this.reason,
            initial_status: student.initialStatus ? student.initialStatus() : null,
            date_of_irb: student.date_of_irb,
            date_of_synopsis: student.date_of_synopsis,
            previous_extensions: thesisExtentions,
            date_of_extention: thesisExtentions.length > 0 ? 
                thesisExtentions[0].created_at : null,
        };
    }

    /**
     * Association definitions
     */
    static associate(models) {
        ThesisExtentionForm.belongsTo(models.Student, { 
            foreignKey: 'student_id', 
            targetKey: 'roll_no', 
            as: 'student' 
        });
    }
}

ThesisExtentionForm.init({
    // Common form fields
    student_id: DataTypes.STRING,
    status: DataTypes.STRING,
    stage: DataTypes.STRING,
    completion: DataTypes.STRING,
    steps: DataTypes.JSON,
    current_step: DataTypes.INTEGER,
    maximum_step: DataTypes.INTEGER,
    semester: DataTypes.STRING,

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

    // Specific fields for thesis extension form
    previous_extention_pdf: DataTypes.STRING,
    period_of_extention: DataTypes.DATEONLY,
    reason: DataTypes.TEXT,
}, {
    sequelize,
    modelName: 'ThesisExtentionForm',
    tableName: 'thesis_extentions_form',
    underscored: true,
});

export default ThesisExtentionForm;
