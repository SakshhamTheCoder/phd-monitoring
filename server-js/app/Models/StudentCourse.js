import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

class StudentCourse extends Model {
    static associate(models) {
        StudentCourse.belongsTo(models.Student, { foreignKey: 'student_id', targetKey: 'roll_no', as: 'student' });
        StudentCourse.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course' });
    }
}

StudentCourse.init({
    student_id: DataTypes.STRING,
    course_id: DataTypes.INTEGER,
    status: DataTypes.STRING,
    semester: DataTypes.STRING,
    grade: DataTypes.STRING,
}, {
    sequelize,
    modelName: 'StudentCourse',
    tableName: 'student_courses',
    underscored: true,
});

export default StudentCourse;
