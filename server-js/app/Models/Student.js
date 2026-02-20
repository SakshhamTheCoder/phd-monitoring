import { Model, DataTypes } from 'sequelize';
import sequelize from '../../database/connection.js';

class Student extends Model {
    /*
     * Custom method to get formatted student data
     * Returns the structure expected by the frontend.
     * Assumes associations (user, department) are loaded.
     */
    getStudent() {
        return {
            name: this.user ? this.user.name : null,
            roll_no: this.roll_no,
            department: this.department ? this.department.name : null,
            date_of_registration: this.date_of_registration,
            date_of_irb: this.date_of_irb,
            date_of_synopsis: this.date_of_synopsis,
            phd_title: this.phd_title,
            fathers_name: this.fathers_name,
            address: this.address,
            current_status: this.current_status,
            cgpa: this.cgpa,
            overall_progress: this.overall_progress
        };
    }

    /*
     * Check IRB completion status
     */
    async checkIrbCompletionStatus() {
        // PHP: IrbSubForm::where('student_id', $this->roll_no)->first();
        const irbSubForm = await this.getIrbSubForm();

        if (irbSubForm && irbSubForm.status === 'approved' && irbSubForm.status === 'complete') {
            return true;
        }
        return false;
    }

    /*
     * Get supervisor update date
     */
    async supervisor_update_date(models) {
        // PHP: Supervisor::where('student_id', $this->roll_no)->orderBy('updated_at', 'desc')->first();
        // Requires Supervisor model reference. 
        // We can access it via the association if defined, or assume models passed/imported.
        // Using sequelize.models to avoid circular imports if possible
        const Supervisor = sequelize.models.Supervisor;
        if (!Supervisor) return null;

        const lastUpdate = await Supervisor.findOne({
            where: { student_id: this.roll_no },
            order: [['updated_at', 'DESC']]
        });
        return lastUpdate ? lastUpdate.updated_at : null;
    }

    /*
     * Check if faculty is in doctoral committee
     */
    async checkDoctoralCommittee(facultyId) {
        const committee = await this.getDoctoralCommittee({
            where: { faculty_code: facultyId }
        });
        return committee.length > 0;
    }

    /*
     * Check if faculty supervises this student
     */
    async checkSupervises(facultyId) {
        const supervisors = await this.getSupervisors({
            where: { faculty_code: facultyId }
        });
        return supervisors.length > 0;
    }

    /*
     * Get HOD of the student's department
     */
    async hod() {
        const dept = await this.getDepartment();
        // PHP: $this->department()->first()->hod()
        // In PHP relations, department() returns query, department returns model.
        // Here we assume dept is the model.
        if (dept) {
            // Assuming Department model has 'hod' method
            return await dept.hod();
        }
        return null;
    }

    /*
     * Check HOD
     */
    async checkHOD(facultyId) {
        const dept = await this.getDepartment();
        // PHP: $this->department->first()->hod_id == $facultyId;
        // The PHP code $this->department->first() implies hasMany?? 
        // But schema says belongsTo. Likely PHP code meant $this->department->hod_id or relation acts weirdly.
        // Assuming belongsTo, dept is the object.
        return dept && dept.hod_id == facultyId;
    }

    /*
     * Check Phd Coordinator
     */
    async checkPhdCoordinator(facultyId) {
        const dept = await this.getDepartment();
        if (!dept) return false;
        // PHP: $this->department->phdCoordinators->contains($facultyId);
        const coordinators = await dept.getPhdCoordinators({ where: { id: facultyId } });
        return coordinators.length > 0;
    }

    /*
     * Get initial status
     */
    async initialStatus() {
        const changes = await this.getStatusChanges({
            order: [['created_at', 'ASC']],
            limit: 1
        });

        const firstChange = changes[0];

        if (!firstChange) {
            return this.current_status;
        }
        return firstChange.type_of_change === 'full-time to part-time' ? 'full-time' : 'part-time';
    }

    /*
     * Get forms with action_required flag computed
     */
    async forms() {
        // PHP: $this->hasMany(Forms::class...)->where('student_available', true)->get();
        const forms = await this.getForms({ where: { student_available: true } });

        return forms.map(form => {
            // Use plain object to append dynamic property not in schema
            const formJSON = form.toJSON();
            if (formJSON.stage === 'student') {
                formJSON.action_required = true;
            } else {
                formJSON.action_required = false;
            }
            return formJSON;
        });
    }

    /*
     * Get outside expert
     */
    async outsideExpert() {
        // PHP: $this->irbCommittees()->where('type', 'outside')...->first()?->member;
        const committees = await this.getIrbCommittees({
            where: {
                type: 'outside',
                member_type: 'OutsideExpert'
            },
            include: ['member'] // Polymorphic include
        });

        return (committees.length > 0 && committees[0].member) ? committees[0].member : null;
    }

    /*
     * Find student by User ID
     */
    static async findByUserId(userId) {
        return await Student.findOne({ where: { user_id: userId } });
    }

    /*
     * Handle hidden attributes for JSON serialization
     */
    toJSON() {
        const values = Object.assign({}, this.get());

        const hidden = [
            'created_at',
            'updated_at'
        ];

        hidden.forEach(field => {
            delete values[field];
        });

        // Ensure virtuals/formatted fields are not lost if needed, 
        // though standard Model behavior usually just dumps data values.

        return values;
    }

    static associate(models) {
        Student.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        Student.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
        Student.belongsTo(models.AreaOfSpecialization, { foreignKey: 'area_of_specialization_id', as: 'areaOfSpecialization' });

        // Many-to-Many
        Student.belongsToMany(models.Faculty, {
            through: 'supervisors',
            foreignKey: 'student_id',
            otherKey: 'faculty_id',
            as: 'supervisors'
        });
        Student.belongsToMany(models.Faculty, {
            through: 'doctoral_commitee',
            foreignKey: 'student_id',
            otherKey: 'faculty_id',
            as: 'doctoralCommittee'
        });

        // Has Many
        Student.hasMany(models.StudentStatusChange, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'statusChanges' });
        Student.hasMany(models.PHDObjective, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'objectives' });
        Student.hasMany(models.ResearchExtentions, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'researchExtentions' });
        Student.hasMany(models.ThesisExtension, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'thesisExtentions' });
        Student.hasMany(models.ThesisExtentionForm, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'thesisExtentionsForm' });
        Student.hasMany(models.StudentBroadAreaSpecialization, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'broad_area_specialization' });
        Student.hasMany(models.Publication, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'publications' });
        Student.hasMany(models.StudentSemesterOff, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'semester_offs' });
        Student.hasMany(models.Forms, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'forms' });
        Student.hasMany(models.Presentation, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'presentations' });
        Student.hasMany(models.IRBCommittee, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'irbCommittees' });

        // Has One
        Student.hasOne(models.ConstituteOfIRB, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'irbForm' });
        Student.hasOne(models.IrbSubForm, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'irbSubForm' });
        Student.hasOne(models.StudentStatusChangeForms, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'statusChangeForms' });
        Student.hasOne(models.ResearchExtentionsForm, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'researchExtentionsForm' });
        Student.hasOne(models.SupervisorChangeForm, { foreignKey: 'student_id', sourceKey: 'roll_no', as: 'supervisorChangeForm' });
    }
}

Student.init({
    user_id: DataTypes.INTEGER,
    roll_no: {
        type: DataTypes.STRING,
        primaryKey: true,
        autoIncrement: false,
        allowNull: false
    },
    department_id: DataTypes.INTEGER,
    // area_of_specialization_id: DataTypes.INTEGER,
    date_of_registration: DataTypes.DATEONLY,
    date_of_irb: DataTypes.DATEONLY,
    date_of_synopsis: DataTypes.DATEONLY,
    phd_title: DataTypes.STRING,
    fathers_name: DataTypes.STRING,
    address: DataTypes.TEXT,
    current_status: DataTypes.STRING,
    cgpa: DataTypes.FLOAT,
    overall_progress: DataTypes.FLOAT,
}, {
    sequelize,
    modelName: 'Student',
    tableName: 'students',
    underscored: true,
});

export default Student;
