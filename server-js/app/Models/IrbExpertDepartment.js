import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";

const IrbExpertDepartment = sequelize.define(
    "IrbExpertDepartment",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_form_id: {
            type: DataTypes.INTEGER,
        },
        expert_id: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_expert_departments",
        timestamps: true,
        underscored: true,
    }
);

// Relations are defined in server-js/models/relations.js

export { IrbExpertDepartment };
