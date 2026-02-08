import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import Student from "./Student.js";
import { Department } from "./Department.js";

const Forms = sequelize.define(
    "Forms",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        student_id: {
            type: DataTypes.STRING, // Maps to Student.roll_no as per PHP relations matches
        },
        form_type: {
            type: DataTypes.STRING,
        },
        form_name: {
            type: DataTypes.STRING,
        },
        department_id: {
            type: DataTypes.INTEGER,
        },
        student_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        supervisor_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        hod_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        phd_coordinator_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        dordc_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        dra_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        director_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        doctoral_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        stage: {
            type: DataTypes.STRING,
        },
        count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        max_count: {
            type: DataTypes.INTEGER,
            defaultValue: 1, // Assumption
        },
    },
    {
        tableName: "forms",
        timestamps: true,
        underscored: true,
        scopes: {
            studentAvailable: {
                where: {
                    student_available: true,
                },
            },
            supervisorAvailable: {
                where: {
                    supervisor_available: true,
                },
            },
        },
    }
);

// Student relation
// belongsTo(Student::class, 'student_id', 'roll_no')
// Relations are defined in server-js/models/relations.js

// Scopes wrapper for ease of use matching PHP
Forms.ofType = function (type) {
    return Forms.findAll({ where: { form_type: type } });
};

export { Forms };
