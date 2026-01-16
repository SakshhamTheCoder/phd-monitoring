import { DataTypes } from "sequelize";
import sequelize from "../../database/connection.js";
import { Faculty } from "../../models/Faculty.js";
// import { ConstituteOfIRB } from "./ConstituteOfIRB.js"; // To be created

const ConstituteIrbSupervisorApproval = sequelize.define(
    "ConstituteIrbSupervisorApproval",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        irb_cons_form_id: {
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
        tableName: "constitute_irb_supervisor_approvals",
        timestamps: true,
        underscored: true,
    }
);

ConstituteIrbSupervisorApproval.belongsTo(Faculty, {
    foreignKey: "supervisor_id",
    targetKey: "faculty_code",
    as: "supervisor",
});

export { ConstituteIrbSupervisorApproval };
