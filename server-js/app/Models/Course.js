import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Department } from "./Department.js";
import Student from "./Student.js";
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

// Relations are defined in server-js/models/relations.js

export { Course };
