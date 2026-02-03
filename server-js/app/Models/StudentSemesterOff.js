import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class StudentSemesterOff extends Model {
    /**
     * Get the semester off form associated with this entry.
     */
    async semesterOffForm() {
        // PHP: belongsTo(StudentSemesterOffForm::class, 'semester_off_id')
        // We can define the association but strict method parity might imply accessing it.
        // Sequelize lazy loading: getSemesterOffForm()
        return await this.getSemesterOffForm();
    }

    /**
     * Get the student associated with this entry.
     */
    async student() {
        return await this.getStudent();
    }

    static associate(models) {
        StudentSemesterOff.belongsTo(models.StudentSemesterOffForm, { foreignKey: 'semester_off_id', as: 'semesterOffForm' });
        StudentSemesterOff.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
        // Also used in Semester.js query:
        // Semester hasMany/includes StudentSemesterOff
        StudentSemesterOff.belongsTo(models.Semester, { foreignKey: 'semester_id', as: 'semester' });
    }
}

StudentSemesterOff.init({
    semester_off_id: DataTypes.INTEGER,
    student_id: DataTypes.STRING,
    semester_off_required: DataTypes.STRING, // Verify type if possible, assuming string/enum logic
    proof_pdf: DataTypes.STRING,
    reason: DataTypes.TEXT,
    semester_id: DataTypes.INTEGER,
}, {
    sequelize,
    modelName: 'StudentSemesterOff',
    tableName: 'student_semester_offs',
    underscored: true,
});

export default StudentSemesterOff;
