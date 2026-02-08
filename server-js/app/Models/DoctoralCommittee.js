import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";
import Student from "./Student.js";

const DoctoralCommittee = sequelize.define(
    "DoctoralCommittee",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        faculty_id: {
            type: DataTypes.STRING, // Maps to faculty_code which is a string
        },
        student_id: {
            type: DataTypes.INTEGER,
        },
        type: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "doctoral_commitee", // Keeping the spelling exactly as in PHP
        timestamps: true,
        underscored: true,
    }
);

// Faculty relation
// belongsTo(Faculty::class, 'faculty_id', 'faculty_code')
// Relations are defined in server-js/models/relations.js

export { DoctoralCommittee };
