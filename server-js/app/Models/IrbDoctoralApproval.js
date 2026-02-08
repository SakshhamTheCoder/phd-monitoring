import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";

const IrbDoctoralApproval = sequelize.define(
    "IrbDoctoralApproval",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_sub_form_id: {
            type: DataTypes.INTEGER,
        },
        doctoral_id: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_doctoral_approvals",
        timestamps: true,
        underscored: true,
    }
);

// Relation to Faculty (Doctoral)
// Relations are defined in server-js/models/relations.js

export { IrbDoctoralApproval };
