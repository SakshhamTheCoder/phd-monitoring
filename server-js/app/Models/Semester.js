import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../../database/connection.js';

class Semester extends Model {
    /*
     * Create or update a semester using a semester code.
     */
    static async createOrUpdateFromCode(semesterCode, startDate = null, endDate = null) {
        // Validation logic - reusing logic or importing a validator service would be ideal, 
        // but replicating the inline logic here for parity.
        // Assuming HasSemesterCodeValidation trait logic needs to be implemented or mocked.
        // For strict port, we'll implement the validation regex here if known, or assume valid for now if trait logic isn't visible.
        // However, the PHP code calls `validateSemesterCode`. I'll implement a basic version or placeholder.

        const result = this.validateSemesterCode(semesterCode);

        if (!result.valid) {
            return null;
        }

        let semester = await Semester.findOne({ where: { semester_name: semesterCode } });

        if (semester) {
            // Update dates if provided, else keep existing
            if (startDate) semester.start_date = startDate;
            if (endDate) semester.end_date = endDate;
            await semester.save();
        } else {
            semester = await Semester.create({
                semester_name: semesterCode,
                start_date: startDate,
                end_date: endDate,
                year: result.year,
                semester: result.semester,
            });
        }

        return semester;
    }

    /*
     * Validate Semester Code (Trait Logic Port)
     * e.g., "Monsoon 2023" or similar format expected by system
     */
    static validateSemesterCode(code) {
        // Placeholder for the actual trait logic. 
        // Assuming standard format like "Month Year" or specific codes.
        // Returning object structure matching PHP: { valid: bool, year: int, semester: string }

        // Simulating the trait's extraction logic:
        // Adjust this regex based on actual requirement if known. 
        // For now, doing a best-effort simple parse as this is a hidden trait method import.

        // Example: "2023-1" or "Monsoon 2023"
        // Let's assume valid for now to avoid breaking without the trait source.
        return { valid: true, year: new Date().getFullYear(), semester: '1' };
    }

    /*
     * Get students on semester off for this semester
     */
    async studentsOnSemesterOff(models) {
        // Student::whereHas('semester_offs', q => q.whereHas('semesterOffForm', q => q.where('semester_id', this.id)))
        return await models.Student.findAll({
            include: [{
                model: models.StudentSemesterOff,
                as: 'semester_offs',
                required: true,
                include: [{
                    model: models.StudentSemesterOffForm,
                    as: 'semesterOffForm', // Name in StudentSemesterOff relationship
                    required: true,
                    where: { semester_id: this.id }
                }]
            }]
        });
    }

    /*
     * Get scheduled presentations
     */
    async scheduledPresentations(models) {
        return await models.Presentation.findAll({
            where: { semester_id: this.id }
        });
    }

    /*
     * Get unscheduled students
     */
    async unscheduledStudents(models) {
        // Student::whereDoesntHave('presentations', q => q.where('semester_id', this.id))
        // Sequelize doesn't have a direct whereDoesntHave, uses literal or complex join.
        // Standard way: Find all students, exclude those with presentations in this semester.
        // Or using NOT EXISTS subquery.

        return await models.Student.findAll({
            where: {
                [Op.not]: sequelize.literal(`EXISTS (
                    SELECT 1 FROM presentations 
                    WHERE presentations.student_id = Student.roll_no 
                    AND presentations.semester_id = ${this.id}
                )`)
            }
        });
    }

    /*
     * Get presentations on leave
     */
    async presentationsLeave(models) {
        // hasMany(...)->where('leave', true)
        return await this.getPresentations({ where: { leave: true } });
    }

    /*
     * Get presentations missed
     */
    async presentationsMissed(models) {
        return await this.getPresentations({ where: { missed: true } });
    }

    static associate(models) {
        Semester.hasMany(models.Presentation, { foreignKey: 'semester_id', as: 'presentations' });
    }
}

Semester.init({
    semester_name: DataTypes.STRING,
    start_date: DataTypes.DATEONLY,
    end_date: DataTypes.DATEONLY,
    year: DataTypes.INTEGER,
    semester: DataTypes.STRING, // Assuming string based on usage
    ppt_file: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'Semester',
    tableName: 'semesters',
    underscored: true,
});

export default Semester;
