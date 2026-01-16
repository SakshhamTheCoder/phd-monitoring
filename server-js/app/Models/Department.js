import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "../../models/Faculty.js";
import { Student } from "../../models/Student.js";
import { BroadAreaSpecialization } from "./BroadAreaSpecialization.js";
import { PhdCoordinator } from "./PhdCoordinator.js";

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
Department.belongsTo(Faculty, {
    foreignKey: "hod_id",
    targetKey: "faculty_code",
    as: "hod",
});

// ADORDC relation
Department.belongsTo(Faculty, {
    foreignKey: "adordc_id",
    targetKey: "faculty_code",
    as: "adordc",
});

Department.hasMany(Student, { foreignKey: "department_id" });

Department.hasMany(BroadAreaSpecialization, { foreignKey: "department_id" });

Department.hasMany(PhdCoordinator, {
    foreignKey: "department_id",
    as: "phdCoordinators",
});

Department.prototype.checkCoordinates = async function (facultyId) {
    return await PhdCoordinator.count({
        where: {
            department_id: this.id,
            faculty_id: facultyId,
        },
    }) > 0;
};

export { Department };
