import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Department } from "./Department.js";
// import { StudentBroadAreaSpecialization } from "./StudentBroadAreaSpecialization.js"; // To be created

const BroadAreaSpecialization = sequelize.define(
    "BroadAreaSpecialization",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        broad_area: {
            type: DataTypes.STRING,
        },
        department_id: {
            type: DataTypes.INTEGER,
        },
    },
    {
        tableName: "broad_area_specializations",
        timestamps: true,
        underscored: true,
    }
);

// Relations are defined in server-js/models/relations.js

// BroadAreaSpecialization.hasMany(StudentBroadAreaSpecialization, {
//   foreignKey: "specialization_id",
// });

export { BroadAreaSpecialization };
