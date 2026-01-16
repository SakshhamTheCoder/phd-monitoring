import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Department } from "../../models/Department.js";
import { Student } from "../../models/Student.js";
// import { StudentCourse } from "./StudentCourse.js"; // To be created if needed

const Course = sequelize.define(
    "Course",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        course_code: {
            type: DataTypes.STRING,
        },
        course_name: {
            type: DataTypes.STRING,
        },
        credits: {
            type: DataTypes.FLOAT,
        },
        department_id: {
            type: DataTypes.INTEGER,
        },
    },
    {
        tableName: "courses",
        timestamps: true,
        underscored: true,
    }
);

Course.belongsTo(Department, { foreignKey: "department_id" });

// Course.hasMany(StudentCourse, { foreignKey: 'course_id' });

// Advanced many-to-many with custom keys from PHP:
// belongsToMany(Student::class, 'student_courses', 'course_id', 'student_id', 'id', 'roll_no')
// This implies student_courses.student_id references students.roll_no
Course.belongsToMany(Student, {
    through: "student_courses",
    foreignKey: "course_id",
    otherKey: "student_id",
    targetKey: "roll_no", // References Student.roll_no instead of Student.id
    as: "students",
});

export { Course };
