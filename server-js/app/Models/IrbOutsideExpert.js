import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";

const IrbOutsideExpert = sequelize.define(
    "IrbOutsideExpert",
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
            type: DataTypes.INTEGER,
        },
    },
    {
        tableName: "irb_outside_experts",
        timestamps: true,
        underscored: true,
    }
);

export { IrbOutsideExpert };
