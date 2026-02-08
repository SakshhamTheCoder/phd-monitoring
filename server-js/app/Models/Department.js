import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";
import Student from "./Student.js";
import { BroadAreaSpecialization } from "./BroadAreaSpecialization.js";
import PhdCoordinator from "./PhdCoordinator.js";

const Department = sequelize.define(
    "Department",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
        },
        code: {
            type: DataTypes.STRING,
        },
        hod_id: {
            type: DataTypes.INTEGER,
        },
        adordc_id: {
            type: DataTypes.INTEGER,
        },
    },
    {
        tableName: "departments",
        timestamps: true,
        underscored: true,
    }
);

// HOD relation
// Relations are defined in server-js/models/relations.js

Department.prototype.checkCoordinates = async function (facultyId) {
    return await PhdCoordinator.count({
        where: {
            department_id: this.id,
            faculty_id: facultyId,
        },
    }) > 0;
};

export { Department };
