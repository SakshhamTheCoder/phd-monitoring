import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "./Faculty.js";
import { IrbSubForm } from "./IrbSubForm.js";

const IrbSupervisorApproval = sequelize.define(
    "IrbSupervisorApproval",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_sub_form_id: {
            type: DataTypes.INTEGER,
        },
        supervisor_id: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "irb_supervisor_approvals",
        timestamps: true,
        underscored: true,
    }
);

// Relations are defined in server-js/models/relations.js

export { IrbSupervisorApproval };
