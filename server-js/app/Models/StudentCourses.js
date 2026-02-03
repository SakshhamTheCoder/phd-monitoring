import { Model } from 'sequelize';
import sequelize from '../../config/database.js';

class StudentCourses extends Model {
    // Empty in PHP, so likely just an unused or base model in that context, 
    // or strictly a table mapping without extra logic.
}

StudentCourses.init({}, {
    sequelize,
    modelName: 'StudentCourses',
    tableName: 'student_courses_table', // Note: name mismatch/ambiguity with StudentCourse. 
    // In PHP it didn't define table, so it would default to 'student_courses' which conflicts with StudentCourse.php's explicit 'student_courses'.
    // Assuming 'student_courses' plural standard, but keeping consistent with potentially intended usage.
    // If it shares the table, it might be a duplicate or legacy. 
    // Creating it as a distinct model for now to match file existence.
    underscored: true,
});

export default StudentCourses;
